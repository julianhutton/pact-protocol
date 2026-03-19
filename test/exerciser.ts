// Handoff Protocol Exerciser — tests all spec requirements

import { HandoffProtocol } from "../src/handoff.js";
import type { Decision, Stakes, TrustLevel } from "../src/types.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  PASS  ${description}`);
    passed++;
  } else {
    console.log(`  FAIL  ${description}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

function makeDecision(
  hp: HandoffProtocol,
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

section("Classification Matrix — 9 cells");

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
  const hp = new HandoffProtocol({ defaultTrustScore: t.trust });
  const d = makeDecision(hp, "agent-1", t.stakes);

  if (t.expected === "auto-approve") {
    assert(d.status === "approved" && d.urgency === "inform",
      `${t.level}/${t.stakes}: auto-approved (status=approved, urgency=inform)`);
    assert(d.resolutionNote !== undefined,
      `${t.level}/${t.stakes}: auto-approve has resolutionNote`);
  } else {
    assert(d.urgency === t.expected && d.status === "pending",
      `${t.level}/${t.stakes}: urgency=${t.expected}, status=pending`);
  }
}

// ════════════════════════════════════════════════════════════════
//  2. Trust Scoring — deltas and boundary crossings
// ════════════════════════════════════════════════════════════════

section("Trust Scoring");

{
  // Start at 20 (supervised, boundary)
  const hp = new HandoffProtocol({ defaultTrustScore: 20 });
  const agent = hp.getOrCreateAgent("trust-test");
  assert(agent.trustLevel === "supervised", "Score 20 is supervised (boundary)");

  // Approve → +2 → 22 → guided
  const d1 = makeDecision(hp, "trust-test", "medium");
  hp.resolve({ decisionId: d1.id, action: "approved" });
  const a1 = hp.getAgent("trust-test")!;
  assert(a1.trustScore === 22, "Approve +2: 20 → 22");
  assert(a1.trustLevel === "guided", "Score 22 crosses into guided");
  assert(a1.consecutiveApprovals === 1, "consecutiveApprovals = 1");

  // Edited → +1 → 23
  const d2 = makeDecision(hp, "trust-test", "medium");
  hp.resolve({ decisionId: d2.id, action: "edited", editedContent: "modified" });
  const a2 = hp.getAgent("trust-test")!;
  assert(a2.trustScore === 23, "Edit +1: 22 → 23");
  assert(a2.consecutiveApprovals === 0, "Edit resets consecutiveApprovals");

  // Rejected → -5 → 18 → supervised
  const d3 = makeDecision(hp, "trust-test", "medium");
  hp.resolve({ decisionId: d3.id, action: "rejected" });
  const a3 = hp.getAgent("trust-test")!;
  assert(a3.trustScore === 18, "Reject -5: 23 → 18");
  assert(a3.trustLevel === "supervised", "Score 18 back to supervised");
  assert(a3.consecutiveApprovals === 0, "Reject resets consecutiveApprovals");

  // Snooze → no change
  const d4 = makeDecision(hp, "trust-test", "medium");
  hp.resolve({ decisionId: d4.id, action: "snoozed" });
  const a4 = hp.getAgent("trust-test")!;
  assert(a4.trustScore === 18, "Snooze: score unchanged at 18");
}

// Boundary at 50
{
  const hp = new HandoffProtocol({ defaultTrustScore: 50 });
  const agent = hp.getOrCreateAgent("boundary-50");
  assert(agent.trustLevel === "guided", "Score 50 is guided (boundary)");

  const d = makeDecision(hp, "boundary-50", "high");
  hp.resolve({ decisionId: d.id, action: "approved" });
  const a = hp.getAgent("boundary-50")!;
  assert(a.trustScore === 52, "Approve: 50 → 52");
  assert(a.trustLevel === "autonomous", "Score 52 crosses into autonomous");
}

// Clamp at 0
{
  const hp = new HandoffProtocol({ defaultTrustScore: 2 });
  const d = makeDecision(hp, "clamp-test", "medium");
  hp.resolve({ decisionId: d.id, action: "rejected" });
  const a = hp.getAgent("clamp-test")!;
  assert(a.trustScore === 0, "Trust clamped at 0 (2 - 5 = 0)");
}

// Clamp at 100
{
  const hp = new HandoffProtocol({ defaultTrustScore: 99 });
  const d = makeDecision(hp, "clamp-max", "high");
  hp.resolve({ decisionId: d.id, action: "approved" });
  const a = hp.getAgent("clamp-max")!;
  assert(a.trustScore === 100, "Trust clamped at 100 (99 + 2 = 100)");
}

// ════════════════════════════════════════════════════════════════
//  3. Rule Matching — wildcard, specificity, always-request ties
// ════════════════════════════════════════════════════════════════

section("Rule Matching");

{
  const hp = new HandoffProtocol({ defaultTrustScore: 10 }); // supervised

  // Add rules with different specificity
  hp.addRule({
    type: "auto-approve",
    scope: { category: "pricing" }, // specificity 1
    active: true,
  });

  hp.addRule({
    type: "always-request",
    scope: { goal: "revenue", category: "pricing" }, // specificity 2
    active: true,
  });

  // Specific scope should match the more specific rule
  const result1 = hp.checkRules({ goal: "revenue", category: "pricing" });
  assert(result1?.type === "always-request", "Specificity 2 beats specificity 1");

  // Different goal → only the single-dimension rule matches
  const result2 = hp.checkRules({ goal: "growth", category: "pricing" });
  assert(result2?.type === "auto-approve", "Wildcard: category-only rule matches any goal");

  // No match
  const result3 = hp.checkRules({ goal: "growth", category: "analytics" });
  assert(result3 === null, "No rule matches different category");
}

// Always-request wins ties at same specificity
{
  const hp = new HandoffProtocol({ defaultTrustScore: 10 });

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
  assert(result?.type === "always-request", "always-request wins ties at same specificity");
}

// Rule overrides classification matrix
{
  const hp = new HandoffProtocol({ defaultTrustScore: 10 }); // supervised
  hp.addRule({
    type: "auto-approve",
    scope: { category: "routine" },
    active: true,
  });

  // Normally supervised + high = blocked, but rule overrides
  const d = hp.surface({
    agentId: "rule-override",
    title: "Test",
    summary: "Test",
    proposedAction: "Do it",
    scope: { category: "routine" },
    stakes: "high",
    confidence: 0.9,
  });
  assert(d.status === "approved" && d.urgency === "inform",
    "Auto-approve rule overrides classification matrix");
}

// ════════════════════════════════════════════════════════════════
//  4. Pattern Detection
// ════════════════════════════════════════════════════════════════

section("Pattern Detection");

// Edited counts as approval
{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    patternMinDecisions: 5,
    patternApprovalThreshold: 0.8,
  });
  const scope = { goal: "ops", category: "deploy" };

  // 3 approved + 2 edited = 5 total, 100% approval (edited counts), 0 rejected
  for (let i = 0; i < 3; i++) {
    const d = makeDecision(hp, "pattern-agent", "medium", scope);
    hp.resolve({ decisionId: d.id, action: "approved" });
  }
  for (let i = 0; i < 2; i++) {
    const d = makeDecision(hp, "pattern-agent", "medium", scope);
    hp.resolve({ decisionId: d.id, action: "edited", editedContent: "tweaked" });
  }

  const patterns = hp.detectPatterns();
  assert(patterns.length === 1, "Pattern detected: 3 approved + 2 edited meets threshold");
  assert(patterns[0].evidence.approved === 5, "Edited decisions counted as approvals");
}

// Zero rejections required
{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    patternMinDecisions: 5,
    patternApprovalThreshold: 0.8,
  });
  const scope = { goal: "ops", category: "risky" };

  for (let i = 0; i < 5; i++) {
    const d = makeDecision(hp, "reject-agent", "medium", scope);
    hp.resolve({ decisionId: d.id, action: "approved" });
  }
  // Add one rejection
  const dR = makeDecision(hp, "reject-agent", "medium", scope);
  hp.resolve({ decisionId: dR.id, action: "rejected" });

  const patterns = hp.detectPatterns();
  const matching = patterns.filter(
    (p) => p.scope.goal === "ops" && p.scope.category === "risky"
  );
  assert(matching.length === 0, "No pattern when any rejection exists");
}

// Meta-decisions excluded from pattern detection
{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    patternMinDecisions: 3,
    patternApprovalThreshold: 0.8,
  });
  const scope = { goal: "meta", category: "rules" };

  // Surface 3 meta-decisions (marked isMeta)
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
  assert(matching.length === 0, "Meta-decisions excluded from pattern detection");
}

// ════════════════════════════════════════════════════════════════
//  5. Auto-approve Flow (pattern → meta-decision → rule)
// ════════════════════════════════════════════════════════════════

section("Auto-approve Flow");

{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    patternMinDecisions: 5,
    patternApprovalThreshold: 0.8,
  });
  const scope = { goal: "ops", category: "monitoring" };

  // Create enough approvals to trigger pattern
  for (let i = 0; i < 6; i++) {
    const d = makeDecision(hp, "flow-agent", "medium", scope);
    hp.resolve({ decisionId: d.id, action: "approved" });
  }

  const patterns = hp.detectPatterns();
  assert(patterns.length >= 1, "Pattern detected after 6 approvals");

  // Surface meta-decision
  const meta = hp.surfaceMetaDecision(patterns[0], "flow-agent");
  assert(meta !== null, "Meta-decision surfaced");
  assert(meta!.isMeta === true, "Meta-decision is flagged as meta");

  // Principal approves meta-decision
  hp.resolve({ decisionId: meta!.id, action: "approved" });

  // Create rule from approved meta-decision
  const rule = hp.createRuleFromMetaDecision(meta!.id);
  assert(rule !== null, "Rule created from approved meta-decision");
  assert(rule!.type === "auto-approve", "Rule type is auto-approve");

  // Now decisions in this scope should be auto-approved
  const autoD = makeDecision(hp, "flow-agent", "high", scope);
  assert(autoD.status === "approved", "Decision auto-approved by new rule");
  assert(autoD.urgency === "inform", "Auto-approved decision has urgency=inform");

  // No duplicate meta-decision for same scope
  const meta2 = hp.surfaceMetaDecision(patterns[0], "flow-agent");
  assert(meta2 === null, "No duplicate meta-decision when rule already exists");
}

// ════════════════════════════════════════════════════════════════
//  6. Continuations — create, resume, expire
// ════════════════════════════════════════════════════════════════

section("Continuations");

{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    continuationExpiryMs: 24 * 60 * 60 * 1000,
  });

  // Create a blocking decision
  const d = makeDecision(hp, "cont-agent", "high");
  assert(d.urgency === "blocked", "High-stakes supervised decision is blocked");

  // Create continuation
  const cont = hp.createContinuation(d.id, "cont-agent", {
    originalPrompt: "Deploy to production",
    workflowStep: "pre-deploy-check",
    findings: ["All tests pass", "No breaking changes"],
  });
  assert(cont.status === "waiting", "Continuation created with status=waiting");
  assert(cont.decisionId === d.id, "Continuation linked to decision");

  // Resolve the decision
  hp.resolve({ decisionId: d.id, action: "approved" });

  // Resume continuation
  const result = hp.resumeContinuation(d.id);
  assert(result !== null, "Continuation resumed after decision resolved");
  assert(result!.continuation.status === "resumed", "Continuation status = resumed");
  assert(result!.decision.status === "approved", "Decision is approved");
  assert(
    (result!.continuation.workflowContext as Record<string, unknown>).originalPrompt === "Deploy to production",
    "Workflow context preserved"
  );
}

// Expiration
{
  const hp = new HandoffProtocol({
    defaultTrustScore: 10,
    continuationExpiryMs: 100, // 100ms for testing
  });

  const d = makeDecision(hp, "expire-agent", "high");
  const cont = hp.createContinuation(d.id, "expire-agent", {
    originalPrompt: "Old task",
  });

  // Manually backdate the continuation
  cont.createdAt = new Date(Date.now() - 200);

  hp.resolve({ decisionId: d.id, action: "approved" });
  const result = hp.resumeContinuation(d.id);
  assert(result === null, "Expired continuation returns null");

  const updated = hp.getContinuation(cont.id);
  assert(updated?.status === "expired", "Expired continuation status = expired");
}

// ════════════════════════════════════════════════════════════════
//  7. Events
// ════════════════════════════════════════════════════════════════

section("Events");

{
  const hp = new HandoffProtocol({ defaultTrustScore: 10 });

  let surfacedCount = 0;
  let resolvedCount = 0;
  let lastSurfaced: unknown = null;
  let lastResolved: unknown = null;

  hp.events.on("decision:surfaced", (e) => {
    surfacedCount++;
    lastSurfaced = e;
  });
  hp.events.on("decision:resolved", (e) => {
    resolvedCount++;
    lastResolved = e;
  });

  const d = makeDecision(hp, "event-agent", "medium");
  assert(surfacedCount === 1, "decision:surfaced emitted on surface");

  hp.resolve({ decisionId: d.id, action: "approved" });
  assert(resolvedCount === 1, "decision:resolved emitted on resolve");

  // Auto-approved decisions also emit surfaced
  const hp2 = new HandoffProtocol({ defaultTrustScore: 75 });
  let autoSurfaced = 0;
  hp2.events.on("decision:surfaced", () => autoSurfaced++);
  makeDecision(hp2, "auto-agent", "low"); // autonomous + low = auto-approve
  assert(autoSurfaced === 1, "decision:surfaced emitted for auto-approved decision");
}

// ════════════════════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
