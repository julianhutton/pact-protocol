// PACT v0.1 — Reference Implementation

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  Decision,
  AgentTrustState,
  Rule,
  Continuation,
  SurfaceInput,
  ResolveInput,
  RuleResult,
  PatternResult,
  TrustLevel,
  Urgency,
  Stakes,
  EventMap,
  DecisionSurfacedEvent,
  DecisionResolvedEvent,
  ContinuationStatus,
} from "./types.js";

// ── Configuration ──

export interface PactConfig {
  defaultTrustScore?: number;
  continuationExpiryMs?: number;
  patternMinDecisions?: number;
  patternApprovalThreshold?: number;
  patternLookbackMs?: number;
}

const DEFAULTS = {
  defaultTrustScore: 60,
  continuationExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
  patternMinDecisions: 5,
  patternApprovalThreshold: 0.8,
  patternLookbackMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// ── Typed EventEmitter ──

type Listener<T> = (payload: T) => void;

class TypedEmitter {
  private ee = new EventEmitter();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this.ee.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this.ee.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return this.ee.emit(event, payload);
  }
}

// ── Core Protocol ──

export class Pact {
  private config: Required<PactConfig>;
  private decisions = new Map<string, Decision>();
  private agents = new Map<string, AgentTrustState>();
  private rules = new Map<string, Rule>();
  private continuations = new Map<string, Continuation>();

  public events = new TypedEmitter();

  constructor(config: PactConfig = {}) {
    this.config = { ...DEFAULTS, ...config };
  }

  // ── Agent Management ──

  getOrCreateAgent(agentId: string): AgentTrustState {
    let agent = this.agents.get(agentId);
    if (!agent) {
      agent = {
        agentId,
        trustScore: this.config.defaultTrustScore,
        trustLevel: this.computeTrustLevel(this.config.defaultTrustScore),
        totalDecisions: 0,
        approvedCount: 0,
        rejectedCount: 0,
        editedCount: 0,
        consecutiveApprovals: 0,
      };
      this.agents.set(agentId, agent);
    }
    return agent;
  }

  getAgent(agentId: string): AgentTrustState | undefined {
    return this.agents.get(agentId);
  }

  setAgentTrust(agentId: string, trustScore: number): void {
    const agent = this.getOrCreateAgent(agentId);
    agent.trustScore = clamp(trustScore, 0, 100);
    agent.trustLevel = this.computeTrustLevel(agent.trustScore);
  }

  // ── Phase 1: Surface ──

  surface(input: SurfaceInput): Decision {
    const agent = this.getOrCreateAgent(input.agentId);
    const { urgency, autoApproved, resolutionNote } = this.classify(input.scope, input.stakes, agent.trustLevel);

    const decision: Decision = {
      id: randomUUID(),
      agentId: input.agentId,
      scope: input.scope,
      stakes: input.stakes,
      urgency,
      status: autoApproved ? "approved" : "pending",
      title: input.title,
      summary: input.summary,
      proposedAction: input.proposedAction,
      confidence: input.confidence,
      reasoning: input.reasoning,
      evidence: input.evidence,
      alternatives: input.alternatives,
      createdAt: new Date(),
      isMeta: input.isMeta,
    };

    if (autoApproved) {
      decision.resolutionNote = resolutionNote;
      decision.resolvedAt = new Date();
      decision.resolution = { action: "approved", note: resolutionNote };
    }

    this.decisions.set(decision.id, decision);

    // Emit decision:surfaced
    const surfacedEvent: DecisionSurfacedEvent = {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      proposedAction: decision.proposedAction,
      scope: decision.scope,
      urgency: decision.urgency,
      confidence: decision.confidence,
      agentId: decision.agentId,
      reasoning: decision.reasoning,
      alternatives: decision.alternatives?.map((a) => ({ title: a.title, summary: a.summary })),
    };
    this.events.emit("decision:surfaced", surfacedEvent);

    return decision;
  }

  // ── Phase 2: Classify ──

  private classify(
    scope: Record<string, string>,
    stakes: Stakes,
    trustLevel: TrustLevel
  ): { urgency: Urgency; autoApproved: boolean; resolutionNote?: string } {
    // Step 1: Check rules
    const ruleResult = this.checkRules(scope);
    if (ruleResult) {
      if (ruleResult.type === "auto-approve") {
        return { urgency: "inform", autoApproved: true, resolutionNote: "Auto-approved by rule" };
      }
      if (ruleResult.type === "always-request") {
        return { urgency: "request", autoApproved: false };
      }
      if (ruleResult.type === "adjust-stakes" && ruleResult.stakes) {
        stakes = ruleResult.stakes;
      }
    }

    // Step 2: Classification matrix
    const matrixResult = this.classifyMatrix(trustLevel, stakes);
    if (matrixResult === null) {
      return { urgency: "inform", autoApproved: true, resolutionNote: "Auto-approved by trust matrix" };
    }
    return { urgency: matrixResult, autoApproved: false };
  }

  private classifyMatrix(trustLevel: TrustLevel, stakes: Stakes): Urgency | null {
    if (stakes === "high") {
      if (trustLevel === "autonomous") return "request";
      return "blocked";
    }
    if (stakes === "medium") {
      if (trustLevel === "supervised") return "request";
      if (trustLevel === "guided") return "inform";
      return null; // autonomous → auto-approve
    }
    // low
    if (trustLevel === "supervised") return "inform";
    return null; // guided or autonomous → auto-approve
  }

  // ── Phase 3: Resolve ──

  resolve(input: ResolveInput): Decision {
    const decision = this.decisions.get(input.decisionId);
    if (!decision) throw new Error(`Decision ${input.decisionId} not found`);
    if (decision.status !== "pending") throw new Error(`Decision ${input.decisionId} is not pending`);

    decision.resolution = {
      action: input.action,
      note: input.note,
      editedContent: input.editedContent,
    };
    decision.status = input.action === "snoozed" ? "snoozed" : input.action;
    decision.resolvedAt = new Date();

    // Update trust (skip snooze)
    if (input.action !== "snoozed") {
      this.updateTrust(decision.agentId, input.action);
    }

    // Emit decision:resolved
    const resolvedEvent: DecisionResolvedEvent = {
      id: decision.id,
      title: decision.title,
      action: input.action,
      note: input.note,
    };
    this.events.emit("decision:resolved", resolvedEvent);

    return decision;
  }

  // ── Phase 4: Learn ──

  private updateTrust(agentId: string, action: "approved" | "rejected" | "edited"): void {
    const agent = this.getOrCreateAgent(agentId);

    let delta = 0;
    if (action === "approved") {
      delta = 2;
      agent.consecutiveApprovals += 1;
    } else if (action === "edited") {
      delta = 1;
      agent.consecutiveApprovals = 0;
    } else if (action === "rejected") {
      delta = -5;
      agent.consecutiveApprovals = 0;
    }

    agent.trustScore = clamp(agent.trustScore + delta, 0, 100);
    agent.trustLevel = this.computeTrustLevel(agent.trustScore);

    if (action === "approved") agent.approvedCount += 1;
    if (action === "rejected") agent.rejectedCount += 1;
    if (action === "edited") agent.editedCount += 1;
    agent.totalDecisions += 1;
  }

  detectPatterns(): PatternResult[] {
    const cutoff = new Date(Date.now() - this.config.patternLookbackMs);
    const resolved = Array.from(this.decisions.values()).filter(
      (d) =>
        d.resolvedAt &&
        d.resolvedAt >= cutoff &&
        d.status !== "pending" &&
        d.status !== "snoozed" &&
        !d.isMeta
    );

    // Group by exact scope (JSON key)
    const groups = new Map<string, Decision[]>();
    for (const d of resolved) {
      const key = scopeKey(d.scope);
      const group = groups.get(key) ?? [];
      group.push(d);
      groups.set(key, group);
    }

    const patterns: PatternResult[] = [];
    for (const [key, decisions] of groups) {
      if (decisions.length < this.config.patternMinDecisions) continue;

      const approved = decisions.filter((d) => d.status === "approved" || d.status === "edited").length;
      const rejected = decisions.filter((d) => d.status === "rejected").length;

      if (approved / decisions.length >= this.config.patternApprovalThreshold && rejected === 0) {
        patterns.push({
          scope: decisions[0].scope,
          suggestedAction: "auto-approve",
          evidence: { total: decisions.length, approved, rejected },
        });
      }
    }
    return patterns;
  }

  surfaceMetaDecision(pattern: PatternResult, agentId: string): Decision | null {
    const sk = scopeKey(pattern.scope);

    // Check if rule already exists for this scope
    for (const rule of this.rules.values()) {
      if (rule.active && scopeKey(rule.scope) === sk) return null;
    }

    // Check if a meta-decision is already pending for this scope
    for (const d of this.decisions.values()) {
      if (d.isMeta && d.status === "pending" && scopeKey(d.scope) === sk) return null;
    }

    return this.surface({
      agentId,
      title: `Auto-approve rule: ${sk}`,
      summary: `You've approved ${pattern.evidence.approved} out of ${pattern.evidence.total} decisions in this scope. Want to auto-approve these going forward?`,
      proposedAction: `Create auto-approve rule for scope ${sk}`,
      scope: pattern.scope,
      stakes: "medium",
      confidence: pattern.evidence.approved / pattern.evidence.total,
      isMeta: true,
    });
  }

  createRuleFromMetaDecision(metaDecisionId: string): Rule | null {
    const decision = this.decisions.get(metaDecisionId);
    if (!decision || decision.status !== "approved") return null;

    const rule: Rule = {
      id: randomUUID(),
      type: "auto-approve",
      scope: { ...decision.scope },
      sourceDecisionId: metaDecisionId,
      active: true,
      createdAt: new Date(),
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  // ── Rule Matching ──

  checkRules(scope: Record<string, string>): RuleResult | null {
    const activeRules = Array.from(this.rules.values()).filter((r) => r.active);
    const matches: { rule: Rule; specificity: number }[] = [];

    for (const rule of activeRules) {
      if (matchesScope(rule.scope, scope)) {
        matches.push({ rule, specificity: countDefinedDimensions(rule.scope) });
      }
    }

    if (matches.length === 0) return null;

    // Sort: most specific first, always-request wins ties
    matches.sort((a, b) => {
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      // always-request wins ties
      if (a.rule.type === "always-request" && b.rule.type !== "always-request") return -1;
      if (b.rule.type === "always-request" && a.rule.type !== "always-request") return 1;
      return 0;
    });

    const best = matches[0].rule;
    switch (best.type) {
      case "auto-approve":
        return { type: "auto-approve" };
      case "always-request":
        return { type: "always-request" };
      case "adjust-stakes":
        return { type: "adjust-stakes", stakes: best.adjustedStakes };
      default:
        return null;
    }
  }

  // ── Continuations ──

  createContinuation(
    decisionId: string,
    agentId: string,
    workflowContext: Record<string, unknown>
  ): Continuation {
    const continuation: Continuation = {
      id: randomUUID(),
      decisionId,
      agentId,
      status: "waiting",
      workflowContext,
      createdAt: new Date(),
    };
    this.continuations.set(continuation.id, continuation);
    return continuation;
  }

  resumeContinuation(
    decisionId: string
  ): { continuation: Continuation; decision: Decision } | null {
    const continuation = Array.from(this.continuations.values()).find(
      (c) => c.decisionId === decisionId && c.status === "waiting"
    );
    if (!continuation) return null;

    // Check expiration
    const elapsed = Date.now() - continuation.createdAt.getTime();
    if (elapsed > this.config.continuationExpiryMs) {
      continuation.status = "expired";
      return null;
    }

    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    continuation.status = "resumed";
    continuation.resumedAt = new Date();
    return { continuation, decision };
  }

  // ── Rules Management ──

  addRule(rule: Omit<Rule, "id" | "createdAt">): Rule {
    const full: Rule = {
      ...rule,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.rules.set(full.id, full);
    return full;
  }

  // ── Query Helpers ──

  getDecision(id: string): Decision | undefined {
    return this.decisions.get(id);
  }

  getAllDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }

  getContinuation(id: string): Continuation | undefined {
    return this.continuations.get(id);
  }

  getRule(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  // ── Internal ──

  private computeTrustLevel(score: number): TrustLevel {
    if (score > 50) return "autonomous";
    if (score > 20) return "guided";
    return "supervised";
  }
}

// ── Utility Functions ──

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function scopeKey(scope: Record<string, string>): string {
  const sorted = Object.keys(scope).sort();
  return sorted.map((k) => `${k}=${scope[k]}`).join("|");
}

function matchesScope(ruleScope: Record<string, string>, decisionScope: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(ruleScope)) {
    if (value === undefined || value === null) continue; // wildcard
    if (decisionScope[key] !== value) return false;
  }
  return true;
}

function countDefinedDimensions(scope: Record<string, string>): number {
  return Object.values(scope).filter((v) => v !== undefined && v !== null).length;
}
