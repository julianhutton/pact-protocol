// PACT — Quickstart
// Full lifecycle in ~50 lines: surface → classify → resolve → learn

import { HandoffProtocol } from "../src/handoff.js";

const protocol = new HandoffProtocol({ defaultTrustScore: 40 });

// Listen for events
protocol.events.on("decision:surfaced", (e) => {
  console.log(`  📡 Event: decision:surfaced — "${e.title}" (urgency: ${e.urgency})`);
});
protocol.events.on("decision:resolved", (e) => {
  console.log(`  📡 Event: decision:resolved — "${e.title}" (action: ${e.action})`);
});

// Phase 1: Surface a decision
console.log("\n— Phase 1: Surface —");
const decision = protocol.surface({
  agentId: "my-agent",
  title: "Send weekly report to subscribers",
  summary: "Weekly metrics report is ready. 1,204 subscribers will receive it.",
  proposedAction: "Send the email via SendGrid",
  scope: { category: "email", audience: "subscribers" },
  stakes: "medium",
  confidence: 0.9,
});

// Phase 2: Classify (happened automatically during surface)
console.log("\n— Phase 2: Classify —");
const agent = protocol.getAgent("my-agent")!;
console.log(`  Trust: ${agent.trustScore} (${agent.trustLevel})`);
console.log(`  Stakes: ${decision.stakes}`);
console.log(`  Urgency: ${decision.urgency}`);
console.log(`  Status: ${decision.status}`);

// Phase 3: Resolve
console.log("\n— Phase 3: Resolve —");
const resolved = protocol.resolve({
  decisionId: decision.id,
  action: "approved",
  note: "Looks good, send it",
});
console.log(`  Resolved: ${resolved.resolution!.action}`);

// Phase 4: Learn
console.log("\n— Phase 4: Learn —");
const updated = protocol.getAgent("my-agent")!;
console.log(`  Trust: ${agent.trustScore} → ${updated.trustScore} (${updated.trustLevel})`);
console.log(`  Approved: ${updated.approvedCount}, Rejected: ${updated.rejectedCount}`);
console.log(`  Total decisions: ${updated.totalDecisions}`);

console.log("\n✓ Full lifecycle complete\n");
