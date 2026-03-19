// PACT — Deploy Approval Example
// A CI/CD agent surfaces deployment decisions. The protocol classifies them
// based on stakes and trust, learns from approval patterns, and discovers
// the principal's boundaries when they push back.

import { HandoffProtocol } from "../src/handoff.js";

const protocol = new HandoffProtocol({ defaultTrustScore: 30 });

const log = (msg: string) => console.log(`  ${msg}`);
const heading = (msg: string) => console.log(`\n━━ ${msg} ━━`);

// ── Scene 1: Low-stakes deploy (auto-approved) ──

heading("Scene 1: Config change to staging");

const staging = protocol.surface({
  agentId: "deploy-bot",
  title: "Deploy config change to staging",
  summary: "Updated feature flag defaults. No code changes. Staging only.",
  proposedAction: "Deploy commit abc123 to staging",
  scope: { domain: "deploys", environment: "staging" },
  stakes: "low",
  confidence: 0.95,
});

log(`Status: ${staging.status}`);
log(`Urgency: ${staging.urgency}`);
log(`→ Auto-approved. Agent proceeds immediately.`);

// ── Scene 2: High-stakes deploy (blocked) ──

heading("Scene 2: Production deploy");

const prod = protocol.surface({
  agentId: "deploy-bot",
  title: "Deploy v2.3.1 to production",
  summary: "New release with payment flow changes. 847 files changed, all tests passing.",
  proposedAction: "Deploy tag v2.3.1 to production cluster",
  scope: { domain: "deploys", environment: "production" },
  stakes: "high",
  confidence: 0.88,
  evidence: [
    { type: "data", title: "Test suite", detail: "342 tests passing, 0 failures", confidence: 1.0 },
    { type: "data", title: "Diff size", detail: "847 files, +12K/-3K lines", confidence: 1.0 },
    { type: "data", title: "Rollback plan", detail: "Previous tag v2.3.0 tagged and ready", confidence: 0.95 },
  ],
  alternatives: [
    {
      title: "Canary deploy",
      summary: "Roll out to 5% of traffic first",
      reasoning: "Large diff warrants gradual rollout",
      confidence: 0.7,
    },
  ],
});

log(`Status: ${prod.status}`);
log(`Urgency: ${prod.urgency}`);
log(`→ Blocked. Waiting for principal.`);

// Principal approves
const resolved = protocol.resolve({
  decisionId: prod.id,
  action: "approved",
  note: "Ship it. Tests look clean.",
});
log(`Principal: approved — "${resolved.resolution!.note}"`);

const agent = protocol.getAgent("deploy-bot")!;
log(`Trust: ${agent.trustScore} (${agent.trustLevel})`);

// ── Scene 3: Building a pattern ──

heading("Scene 3: Building approval pattern (4 more production deploys)");

for (let i = 2; i <= 5; i++) {
  const d = protocol.surface({
    agentId: "deploy-bot",
    title: `Deploy v2.3.${i} to production`,
    summary: `Release ${i}: bug fixes and performance improvements.`,
    proposedAction: `Deploy tag v2.3.${i} to production cluster`,
    scope: { domain: "deploys", environment: "production" },
    stakes: "high",
    confidence: 0.9,
  });

  protocol.resolve({
    decisionId: d.id,
    action: "approved",
  });
}

const afterPattern = protocol.getAgent("deploy-bot")!;
log(`5 production deploys approved. Trust: ${afterPattern.trustScore} (${afterPattern.trustLevel})`);

// ── Scene 4: Pattern detection ──

heading("Scene 4: Pattern detection fires");

const patterns = protocol.detectPatterns();
log(`Patterns detected: ${patterns.length}`);

for (const p of patterns) {
  const scopeStr = Object.entries(p.scope).map(([k, v]) => `${k}=${v}`).join(", ");
  log(`  Scope: { ${scopeStr} }`);
  log(`  ${p.evidence.approved}/${p.evidence.total} approved, ${p.evidence.rejected} rejected`);

  const meta = protocol.surfaceMetaDecision(p, "deploy-bot");
  if (meta) {
    log(`  Meta-decision surfaced: "${meta.title}"`);

    // ── Scene 5: Principal pushes back ──

    heading("Scene 5: Principal rejects auto-approve for production");

    protocol.resolve({
      decisionId: meta.id,
      action: "rejected",
      note: "No. Production deploys always need my approval.",
    });

    log(`Principal rejected the meta-decision.`);
    log(`→ The protocol learned: production deploys are NOT auto-approvable.`);
  }
}

// ── Final state ──

heading("Final state");

const final = protocol.getAgent("deploy-bot")!;
log(`Trust: ${final.trustScore} (${final.trustLevel})`);
log(`Approved: ${final.approvedCount}, Rejected: ${final.rejectedCount}`);
log(`Total decisions: ${final.totalDecisions}`);
log(``);
log(`The agent is trusted overall, but production deploys still require approval.`);
log(`Next production deploy → high stakes + ${final.trustLevel} trust → "${protocol.surface({
  agentId: "deploy-bot",
  title: "Deploy v2.4.0 to production",
  summary: "Next release.",
  proposedAction: "Deploy v2.4.0",
  scope: { domain: "deploys", environment: "production" },
  stakes: "high",
  confidence: 0.9,
}).urgency}" — the principal stays in the loop.`);

console.log("\n✓ Deploy approval example complete\n");
