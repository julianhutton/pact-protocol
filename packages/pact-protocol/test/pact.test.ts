// PACT Exerciser — tests all spec requirements (vitest)

import { describe, it, expect } from "vitest";
import { Pact } from "../src/pact.js";
import type { Decision, Stakes, TrustLevel } from "../src/types.js";

function makeDecision(
  hp: Pact,
  agentId: string,
  stakes: Stakes,
  scope: Record<string, string> = { goal: "test", category: "exercise" }
): Decision {
  return hp.surface({
    agentId,
    title: `Test ${stakes} decision`,
    summary: "Test summary",
    proposedAction: "Do the thing",
    scope,
    stakes,
    confidence: 0.8,
  });
}

// ════════════════════════════════════════════════════════════════
//  1. Classification Matrix — all 9 cells
// ════════════════════════════════════════════════════════════════

describe("Classification Matrix — 9 cells", () => {
  const matrixTests: { trust: number; level: TrustLevel; stakes: Stakes; expected: string }[] = [
    // Supervised (0-20)
    { trust: 10, level: "supervised", stakes: "high",   expected: "blocked" },
    { trust: 10, level: "supervised", stakes: "medium", expected: "request" },
    { trust: 10, level: "supervised", stakes: "low",    expected: "inform" },
    // Guided (21-50)
    { trust: 35, level: "guided", stakes: "high",   expected: "blocked" },
    { trust: 35, level: "guided", stakes: "medium", expected: "inform" },
    { trust: 35, level: "guided", stakes: "low",    expected: "auto-approve" },
    // Autonomous (51-100)
    { trust: 75, level: "autonomous", stakes: "high",   expected: "request" },
    { trust: 75, level: "autonomous", stakes: "medium", expected: "auto-approve" },
    { trust: 75, level: "autonomous", stakes: "low",    expected: "auto-approve" },
  ];

  for (const t of matrixTests) {
    if (t.expected === "auto-approve") {
      it(`${t.level}/${t.stakes}: auto-approved (status=approved, urgency=inform)`, () => {
        const hp = new Pact({ defaultTrustScore: t.trust });
        const d = makeDecision(hp, "agent-1", t.stakes);
        expect(d.status).toBe("approved");
        expect(d.urgency).toBe("inform");
      });

      it(`${t.level}/${t.stakes}: auto-approve has resolutionNote`, () => {
        const hp = new Pact({ defaultTrustScore: t.trust });
        const d = makeDecision(hp, "agent-1", t.stakes);
        expect(d.resolutionNote).toBeDefined();
      });
    } else {
      it(`${t.level}/${t.stakes}: urgency=${t.expected}, status=pending`, () => {
        const hp = new Pact({ defaultTrustScore: t.trust });
        const d = makeDecision(hp, "agent-1", t.stakes);
        expect(d.urgency).toBe(t.expected);
        expect(d.status).toBe("pending");
      });
    }
  }
});

// ════════════════════════════════════════════════════════════════
//  2. Trust Scoring — deltas and boundary crossings
// ════════════════════════════════════════════════════════════════

describe("Trust Scoring", () => {
  it("approve +2, boundary crossing to guided, consecutiveApprovals", () => {
    const hp = new Pact({ defaultTrustScore: 20 });
    const agent = hp.getOrCreateAgent("trust-test");
    expect(agent.trustLevel).toBe("supervised");

    const d1 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d1.id, action: "approved" });
    const a1 = hp.getAgent("trust-test")!;
    expect(a1.trustScore).toBe(22);
    expect(a1.trustLevel).toBe("guided");
    expect(a1.consecutiveApprovals).toBe(1);
  });

  it("edit +1, resets consecutiveApprovals", () => {
    const hp = new Pact({ defaultTrustScore: 20 });
    hp.getOrCreateAgent("trust-test");

    const d1 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d1.id, action: "approved" });

    const d2 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d2.id, action: "edited", editedContent: "modified" });
    const a2 = hp.getAgent("trust-test")!;
    expect(a2.trustScore).toBe(23);
    expect(a2.consecutiveApprovals).toBe(0);
  });

  it("reject -5, back to supervised, resets consecutiveApprovals", () => {
    const hp = new Pact({ defaultTrustScore: 20 });
    hp.getOrCreateAgent("trust-test");

    const d1 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d1.id, action: "approved" });
    const d2 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d2.id, action: "edited", editedContent: "modified" });

    const d3 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d3.id, action: "rejected" });
    const a3 = hp.getAgent("trust-test")!;
    expect(a3.trustScore).toBe(18);
    expect(a3.trustLevel).toBe("supervised");
    expect(a3.consecutiveApprovals).toBe(0);
  });

  it("snooze: score unchanged", () => {
    const hp = new Pact({ defaultTrustScore: 20 });
    hp.getOrCreateAgent("trust-test");

    const d1 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d1.id, action: "approved" });
    const d2 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d2.id, action: "edited", editedContent: "modified" });
    const d3 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d3.id, action: "rejected" });

    const d4 = makeDecision(hp, "trust-test", "medium");
    hp.resolve({ decisionId: d4.id, action: "snoozed" });
    const a4 = hp.getAgent("trust-test")!;
    expect(a4.trustScore).toBe(18);
  });

  it("boundary at 50: guided → autonomous", () => {
    const hp = new Pact({ defaultTrustScore: 50 });
    const agent = hp.getOrCreateAgent("boundary-50");
    expect(agent.trustLevel).toBe("guided");

    const d = makeDecision(hp, "boundary-50", "high");
    hp.resolve({ decisionId: d.id, action: "approved" });
    const a = hp.getAgent("boundary-50")!;
    expect(a.trustScore).toBe(52);
    expect(a.trustLevel).toBe("autonomous");
  });

  it("clamp at 0", () => {
    const hp = new Pact({ defaultTrustScore: 2 });
    const d = makeDecision(hp, "clamp-test", "medium");
    hp.resolve({ decisionId: d.id, action: "rejected" });
    const a = hp.getAgent("clamp-test")!;
    expect(a.trustScore).toBe(0);
  });

  it("clamp at 100", () => {
    const hp = new Pact({ defaultTrustScore: 99 });
    const d = makeDecision(hp, "clamp-max", "high");
    hp.resolve({ decisionId: d.id, action: "approved" });
    const a = hp.getAgent("clamp-max")!;
    expect(a.trustScore).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════════
//  3. Rule Matching — wildcard, specificity, always-request ties
// ════════════════════════════════════════════════════════════════

describe("Rule Matching", () => {
  it("specificity 2 beats specificity 1", () => {
    const hp = new Pact({ defaultTrustScore: 10 });

    hp.addRule({
      type: "auto-approve",
      scope: { category: "pricing" },
      active: true,
    });
    hp.addRule({
      type: "always-request",
      scope: { goal: "revenue", category: "pricing" },
      active: true,
    });

    const result1 = hp.checkRules({ goal: "revenue", category: "pricing" });
    expect(result1?.type).toBe("always-request");
  });

  it("wildcard: category-only rule matches any goal", () => {
    const hp = new Pact({ defaultTrustScore: 10 });

    hp.addRule({
      type: "auto-approve",
      scope: { category: "pricing" },
      active: true,
    });
    hp.addRule({
      type: "always-request",
      scope: { goal: "revenue", category: "pricing" },
      active: true,
    });

    const result2 = hp.checkRules({ goal: "growth", category: "pricing" });
    expect(result2?.type).toBe("auto-approve");
  });

  it("no rule matches different category", () => {
    const hp = new Pact({ defaultTrustScore: 10 });

    hp.addRule({
      type: "auto-approve",
      scope: { category: "pricing" },
      active: true,
    });

    const result3 = hp.checkRules({ goal: "growth", category: "analytics" });
    expect(result3).toBeNull();
  });

  it("always-request wins ties at same specificity", () => {
    const hp = new Pact({ defaultTrustScore: 10 });

    hp.addRule({
      type: "auto-approve",
      scope: { category: "deploy" },
      active: true,
    });
    hp.addRule({
      type: "always-request",
      scope: { category: "deploy" },
      active: true,
    });

    const result = hp.checkRules({ category: "deploy" });
    expect(result?.type).toBe("always-request");
  });

  it("auto-approve rule overrides classification matrix", () => {
    const hp = new Pact({ defaultTrustScore: 10 });
    hp.addRule({
      type: "auto-approve",
      scope: { category: "routine" },
      active: true,
    });

    const d = hp.surface({
      agentId: "rule-override",
      title: "Test",
      summary: "Test",
      proposedAction: "Do it",
      scope: { category: "routine" },
      stakes: "high",
      confidence: 0.9,
    });
    expect(d.status).toBe("approved");
    expect(d.urgency).toBe("inform");
  });
});

// ════════════════════════════════════════════════════════════════
//  4. Pattern Detection
// ════════════════════════════════════════════════════════════════

describe("Pattern Detection", () => {
  it("edited counts as approval for pattern detection", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      patternMinDecisions: 5,
      patternApprovalThreshold: 0.8,
    });
    const scope = { goal: "ops", category: "deploy" };

    for (let i = 0; i < 3; i++) {
      const d = makeDecision(hp, "pattern-agent", "medium", scope);
      hp.resolve({ decisionId: d.id, action: "approved" });
    }
    for (let i = 0; i < 2; i++) {
      const d = makeDecision(hp, "pattern-agent", "medium", scope);
      hp.resolve({ decisionId: d.id, action: "edited", editedContent: "tweaked" });
    }

    const patterns = hp.detectPatterns();
    expect(patterns.length).toBe(1);
    expect(patterns[0].evidence.approved).toBe(5);
  });

  it("no pattern when any rejection exists", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      patternMinDecisions: 5,
      patternApprovalThreshold: 0.8,
    });
    const scope = { goal: "ops", category: "risky" };

    for (let i = 0; i < 5; i++) {
      const d = makeDecision(hp, "reject-agent", "medium", scope);
      hp.resolve({ decisionId: d.id, action: "approved" });
    }
    const dR = makeDecision(hp, "reject-agent", "medium", scope);
    hp.resolve({ decisionId: dR.id, action: "rejected" });

    const patterns = hp.detectPatterns();
    const matching = patterns.filter(
      (p) => p.scope.goal === "ops" && p.scope.category === "risky"
    );
    expect(matching.length).toBe(0);
  });

  it("meta-decisions excluded from pattern detection", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      patternMinDecisions: 3,
      patternApprovalThreshold: 0.8,
    });
    const scope = { goal: "meta", category: "rules" };

    for (let i = 0; i < 3; i++) {
      const d = hp.surface({
        agentId: "meta-agent",
        title: "Meta decision",
        summary: "Meta",
        proposedAction: "Create rule",
        scope,
        stakes: "medium",
        confidence: 0.9,
        isMeta: true,
      });
      hp.resolve({ decisionId: d.id, action: "approved" });
    }

    const patterns = hp.detectPatterns();
    const matching = patterns.filter(
      (p) => p.scope.goal === "meta" && p.scope.category === "rules"
    );
    expect(matching.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
//  5. Auto-approve Flow (pattern → meta-decision → rule)
// ════════════════════════════════════════════════════════════════

describe("Auto-approve Flow", () => {
  it("full flow: pattern → meta-decision → rule → auto-approve", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      patternMinDecisions: 5,
      patternApprovalThreshold: 0.8,
    });
    const scope = { goal: "ops", category: "monitoring" };

    for (let i = 0; i < 6; i++) {
      const d = makeDecision(hp, "flow-agent", "medium", scope);
      hp.resolve({ decisionId: d.id, action: "approved" });
    }

    const patterns = hp.detectPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    const meta = hp.surfaceMetaDecision(patterns[0], "flow-agent");
    expect(meta).not.toBeNull();
    expect(meta!.isMeta).toBe(true);

    hp.resolve({ decisionId: meta!.id, action: "approved" });

    const rule = hp.createRuleFromMetaDecision(meta!.id);
    expect(rule).not.toBeNull();
    expect(rule!.type).toBe("auto-approve");

    const autoD = makeDecision(hp, "flow-agent", "high", scope);
    expect(autoD.status).toBe("approved");
    expect(autoD.urgency).toBe("inform");

    const meta2 = hp.surfaceMetaDecision(patterns[0], "flow-agent");
    expect(meta2).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════
//  6. Continuations — create, resume, expire
// ════════════════════════════════════════════════════════════════

describe("Continuations", () => {
  it("create, resolve, resume continuation", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      continuationExpiryMs: 24 * 60 * 60 * 1000,
    });

    const d = makeDecision(hp, "cont-agent", "high");
    expect(d.urgency).toBe("blocked");

    const cont = hp.createContinuation(d.id, "cont-agent", {
      originalPrompt: "Deploy to production",
      workflowStep: "pre-deploy-check",
      findings: ["All tests pass", "No breaking changes"],
    });
    expect(cont.status).toBe("waiting");
    expect(cont.decisionId).toBe(d.id);

    hp.resolve({ decisionId: d.id, action: "approved" });

    const result = hp.resumeContinuation(d.id);
    expect(result).not.toBeNull();
    expect(result!.continuation.status).toBe("resumed");
    expect(result!.decision.status).toBe("approved");
    expect(
      (result!.continuation.workflowContext as Record<string, unknown>).originalPrompt
    ).toBe("Deploy to production");
  });

  it("expired continuation returns null", () => {
    const hp = new Pact({
      defaultTrustScore: 10,
      continuationExpiryMs: 100,
    });

    const d = makeDecision(hp, "expire-agent", "high");
    const cont = hp.createContinuation(d.id, "expire-agent", {
      originalPrompt: "Old task",
    });

    cont.createdAt = new Date(Date.now() - 200);

    hp.resolve({ decisionId: d.id, action: "approved" });
    const result = hp.resumeContinuation(d.id);
    expect(result).toBeNull();

    const updated = hp.getContinuation(cont.id);
    expect(updated?.status).toBe("expired");
  });
});

// ════════════════════════════════════════════════════════════════
//  7. Events
// ════════════════════════════════════════════════════════════════

describe("Events", () => {
  it("decision:surfaced emitted on surface", () => {
    const hp = new Pact({ defaultTrustScore: 10 });
    let surfacedCount = 0;
    hp.events.on("decision:surfaced", () => { surfacedCount++; });

    makeDecision(hp, "event-agent", "medium");
    expect(surfacedCount).toBe(1);
  });

  it("decision:resolved emitted on resolve", () => {
    const hp = new Pact({ defaultTrustScore: 10 });
    let resolvedCount = 0;
    hp.events.on("decision:resolved", () => { resolvedCount++; });

    const d = makeDecision(hp, "event-agent", "medium");
    hp.resolve({ decisionId: d.id, action: "approved" });
    expect(resolvedCount).toBe(1);
  });

  it("decision:surfaced emitted for auto-approved decision", () => {
    const hp = new Pact({ defaultTrustScore: 75 });
    let autoSurfaced = 0;
    hp.events.on("decision:surfaced", () => autoSurfaced++);

    makeDecision(hp, "auto-agent", "low");
    expect(autoSurfaced).toBe(1);
  });
});
