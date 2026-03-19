// Handoff Protocol v0.1 — Type Definitions

export type Stakes = "high" | "medium" | "low";
export type Urgency = "inform" | "request" | "blocked";
export type TrustLevel = "supervised" | "guided" | "autonomous";
export type DecisionStatus = "pending" | "approved" | "rejected" | "edited" | "snoozed" | "expired";
export type ResolutionAction = "approved" | "rejected" | "edited" | "snoozed";
export type RuleType = "auto-approve" | "always-request" | "adjust-stakes";
export type ContinuationStatus = "waiting" | "resumed" | "expired";

export interface Evidence {
  type: string;
  title: string;
  detail: string;
  source?: string;
  confidence: number;
}

export interface Alternative {
  title: string;
  summary: string;
  reasoning: string;
  confidence: number;
}

export interface Resolution {
  action: ResolutionAction;
  note?: string;
  editedContent?: string;
}

export interface Decision {
  id: string;
  agentId: string;
  scope: Record<string, string>;
  stakes: Stakes;
  urgency: Urgency;
  status: DecisionStatus;

  title: string;
  summary: string;
  proposedAction: string;
  confidence: number;

  reasoning?: string;
  evidence?: Evidence[];
  alternatives?: Alternative[];

  createdAt: Date;
  resolvedAt?: Date;
  snoozedUntil?: Date;

  resolution?: Resolution;
  resolutionNote?: string;
  isMeta?: boolean;
}

export interface AgentTrustState {
  agentId: string;
  trustScore: number;
  trustLevel: TrustLevel;

  totalDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  editedCount: number;
  consecutiveApprovals: number;
}

export interface Rule {
  id: string;
  type: RuleType;
  scope: Record<string, string>;
  adjustedStakes?: Stakes;
  sourceDecisionId?: string;
  active: boolean;
  createdAt: Date;
}

export interface Continuation {
  id: string;
  decisionId: string;
  agentId: string;
  status: ContinuationStatus;
  workflowContext: Record<string, unknown>;
  createdAt: Date;
  resumedAt?: Date;
}

export interface SurfaceInput {
  agentId: string;
  title: string;
  summary: string;
  proposedAction: string;
  scope: Record<string, string>;
  stakes: Stakes;
  confidence: number;
  reasoning?: string;
  evidence?: Evidence[];
  alternatives?: Alternative[];
  isMeta?: boolean;
}

export interface ResolveInput {
  decisionId: string;
  action: ResolutionAction;
  note?: string;
  editedContent?: string;
}

export interface RuleResult {
  type: "auto-approve" | "always-request" | "adjust-stakes";
  stakes?: Stakes;
}

export interface PatternResult {
  scope: Record<string, string>;
  suggestedAction: "auto-approve";
  evidence: { total: number; approved: number; rejected: number };
}

// Events
export interface DecisionSurfacedEvent {
  id: string;
  title: string;
  summary: string;
  proposedAction: string;
  scope: Record<string, string>;
  urgency: Urgency;
  confidence: number;
  agentId: string;
  reasoning?: string;
  alternatives?: { title: string; summary: string }[];
}

export interface DecisionResolvedEvent {
  id: string;
  title: string;
  action: ResolutionAction;
  note?: string;
}

export interface EventMap {
  "decision:surfaced": DecisionSurfacedEvent;
  "decision:resolved": DecisionResolvedEvent;
}
