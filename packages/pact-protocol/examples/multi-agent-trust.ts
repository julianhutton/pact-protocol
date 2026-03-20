// PACT — Multi-Agent Trust Verification
//
// An orchestrator agent needs to delegate a sensitive task. It checks multiple
// worker agents' trust records, then surfaces a recommendation to the human
// principal. The principal approves delegation to the most trusted worker.
//
// This example demonstrates the "Agents that trust" narrative:
// agents earning trust through structured human feedback, then other agents
// querying that trust to make delegation decisions.

import { Pact } from "../src/pact.js";

const protocol = new Pact({ defaultTrustScore: 30 });

const log = (msg: string) => console.log(`  ${msg}`);
const heading = (msg: string) => console.log(`\n━━ ${msg} ━━`);

// ── Scene 1: Three worker agents build trust histories ──

heading("Scene 1: Worker agents build trust histories");

const agents = [
  { id: "worker-alpha", domain: "data-pipeline", successRate: 1.0 },
  { id: "worker-beta", domain: "data-pipeline", successRate: 0.6 },
  { id: "worker-gamma", domain: "data-pipeline", successRate: 0.9 },
];

for (const agent of agents) {
  for (let i = 0; i < 10; i++) {
    const d = protocol.surface({
      agentId: agent.id,
      title: `${agent.id}: Process batch ${i + 1}`,
      summary: `Data pipeline batch processing task ${i + 1}.`,
      proposedAction: `Execute batch ${i + 1}`,
      scope: { domain: agent.domain, task: "batch-processing" },
      stakes: "medium",
      confidence: 0.85,
    });

    // Only resolve pending decisions (auto-approved ones are already resolved)
    if (d.status === "pending") {
      const action = Math.random() < agent.successRate ? "approved" : "rejected";
      protocol.resolve({ decisionId: d.id, action });
    }
  }
}

for (const agent of agents) {
  const state = protocol.getAgent(agent.id)!;
  log(`${agent.id}: trust=${state.trustScore} (${state.trustLevel}), approved=${state.approvedCount}, rejected=${state.rejectedCount}`);
}

// ── Scene 2: Orchestrator evaluates workers for a high-stakes task ──

heading("Scene 2: Orchestrator evaluates workers for sensitive task");

log("Task: Migrate production database (high stakes)");
log("Orchestrator checks each worker's trust record...\n");

const candidates = agents.map((a) => {
  const state = protocol.getAgent(a.id)!;
  return {
    agentId: a.id,
    trustScore: state.trustScore,
    trustLevel: state.trustLevel,
    approved: state.approvedCount,
    rejected: state.rejectedCount,
    total: state.totalDecisions,
  };
});

// Rank by trust score
candidates.sort((a, b) => b.trustScore - a.trustScore);

for (const c of candidates) {
  const bar = "█".repeat(Math.floor(c.trustScore / 5)) + "░".repeat(20 - Math.floor(c.trustScore / 5));
  log(`${c.agentId}: [${bar}] ${c.trustScore} (${c.trustLevel})`);
  log(`  ${c.approved} approved / ${c.rejected} rejected / ${c.total} total`);
}

const best = candidates[0];
const worst = candidates[candidates.length - 1];

// ── Scene 3: Orchestrator surfaces delegation recommendation ──

heading("Scene 3: Orchestrator surfaces delegation recommendation");

const delegation = protocol.surface({
  agentId: "orchestrator",
  title: "Delegate database migration",
  summary: `Recommending ${best.agentId} (trust: ${best.trustScore}) for production database migration. ${best.agentId} has ${best.approved} approvals with ${best.rejected} rejections. Next best: ${candidates[1].agentId} (trust: ${candidates[1].trustScore}).`,
  proposedAction: `Delegate "migrate production database" to ${best.agentId}`,
  scope: { domain: "delegation", task: "database-migration" },
  stakes: "high",
  confidence: best.trustScore / 100,
  evidence: candidates.map((c) => ({
    type: "trust-record",
    title: `${c.agentId} trust record`,
    detail: `Trust: ${c.trustScore}, ${c.approved}/${c.total} approved, ${c.rejected} rejected`,
    confidence: c.trustScore / 100,
  })),
  alternatives: candidates.length > 1
    ? [
        {
          title: `Delegate to ${candidates[1].agentId}`,
          summary: `Second choice with trust score ${candidates[1].trustScore}`,
          reasoning: `Lower trust score but still in ${candidates[1].trustLevel} tier`,
          confidence: candidates[1].trustScore / 100,
        },
      ]
    : [],
});

log(`Status: ${delegation.status} (urgency: ${delegation.urgency})`);
log(`→ High-stakes delegation to a ${protocol.getAgent("orchestrator")!.trustLevel}-trust orchestrator — requires principal approval.`);

// ── Scene 4: Principal approves ──

heading("Scene 4: Principal approves delegation");

const resolved = protocol.resolve({
  decisionId: delegation.id,
  action: "approved",
  note: `Agreed. ${best.agentId} has the strongest record.`,
});

log(`Principal: "${resolved.resolution!.note}"`);
log(`→ ${best.agentId} is delegated the database migration task.`);

// ── Scene 5: Trust ripple effect ──

heading("Scene 5: Trust ripple effect");

const orchestratorAfter = protocol.getAgent("orchestrator")!;
log(`Orchestrator trust: ${orchestratorAfter.trustScore} (${orchestratorAfter.trustLevel})`);
log(`→ The orchestrator's good recommendation earned it trust too.`);
log(`→ Over time, the orchestrator can auto-delegate low-stakes tasks.`);

// ── Summary ──

heading("What this demonstrates");
log("1. Agents build differentiated trust records through human feedback");
log("2. An orchestrator queries trust to rank candidates");
log("3. Trust-based evidence supports the delegation recommendation");
log("4. The principal makes the final call on high-stakes delegation");
log("5. Good recommendations increase the orchestrator's own trust");
log("");
log("With on-chain attestations, this trust data lives on Base —");
log("any agent can verify any other agent's track record permissionlessly.");

console.log("\n✓ Multi-agent trust verification example complete\n");
