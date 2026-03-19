// PACT Demo — Full loop: surface → resolve → trust update → on-chain → verify
//
// Usage:
//   bun run scripts/demo.ts                          # dry-run (no on-chain)
//   DEPLOYER_KEY=0x... CONTRACT_ADDRESS=0x... bun run scripts/demo.ts  # live on-chain

import { Pact } from "../packages/pact-protocol/src/pact.js";
import type { OnChainProvider } from "../packages/pact-protocol/src/types.js";

const DEPLOYER_KEY = process.env.DEPLOYER_KEY as `0x${string}` | undefined;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;

const log = (msg: string) => console.log(`  ${msg}`);
const heading = (msg: string) => console.log(`\n━━ ${msg} ━━`);

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  PACT Demo — Protocol for Agent-human       ║");
  console.log("║  Collaborative Trust                        ║");
  console.log("╚══════════════════════════════════════════════╝");

  // Optionally set up on-chain provider
  let onChainProvider: OnChainProvider | undefined;

  if (DEPLOYER_KEY && CONTRACT_ADDRESS) {
    heading("On-chain mode: Base Sepolia");
    log(`Contract: ${CONTRACT_ADDRESS}`);

    const { BaseTrustProvider } = await import("../packages/pact-onchain/src/BaseTrustProvider.js");
    const provider = new BaseTrustProvider({
      contractAddress: CONTRACT_ADDRESS,
      privateKey: DEPLOYER_KEY,
    });
    onChainProvider = provider;
    log("BaseTrustProvider initialized");
  } else {
    heading("Dry-run mode (no on-chain)");
    log("Set DEPLOYER_KEY and CONTRACT_ADDRESS env vars for live on-chain demo");
  }

  // ── Step 1: Create Pact instance and surface a decision ──

  heading("Step 1: Surface a high-stakes decision");

  const protocol = new Pact({
    defaultTrustScore: 30, // New agent, starts in guided trust
    onChainProvider,
  });

  protocol.events.on("decision:surfaced", (e) => {
    log(`Event: decision:surfaced — "${e.title}" (urgency: ${e.urgency})`);
  });
  protocol.events.on("decision:resolved", (e) => {
    log(`Event: decision:resolved — "${e.title}" (action: ${e.action})`);
  });

  const decision = protocol.surface({
    agentId: "deploy-bot",
    title: "Deploy v3.0.0 to production",
    summary: "Major release with new payment flow. 1,247 files changed, all tests passing.",
    proposedAction: "Deploy tag v3.0.0 to production cluster",
    scope: { domain: "deploys", environment: "production" },
    stakes: "high",
    confidence: 0.88,
    evidence: [
      { type: "data", title: "Test suite", detail: "487 tests passing", confidence: 1.0 },
      { type: "data", title: "Rollback plan", detail: "v2.9.0 tagged and ready", confidence: 0.95 },
    ],
  });

  // ── Step 2: Show classification ──

  heading("Step 2: Classification result");

  const agent = protocol.getAgent("deploy-bot")!;
  const preTrustScore = agent.trustScore;
  log(`Agent trust: ${preTrustScore} (${agent.trustLevel})`);
  log(`Stakes: ${decision.stakes}`);
  log(`Urgency: ${decision.urgency}`);
  log(`Status: ${decision.status}`);
  log(`→ Blocked — high stakes with a guided-trust agent.`);

  // ── Step 3: Principal approves ──

  heading("Step 3: Principal approves");

  const resolved = protocol.resolve({
    decisionId: decision.id,
    action: "approved",
    note: "Ship it. Tests look clean and rollback plan is solid.",
  });
  log(`Action: ${resolved.resolution!.action}`);
  log(`Note: "${resolved.resolution!.note}"`);

  // ── Step 4: Trust score update ──

  heading("Step 4: Trust score updated");

  const updated = protocol.getAgent("deploy-bot")!;
  log(`Trust: ${preTrustScore} → ${updated.trustScore} (+2 for approval)`);
  log(`Level: ${updated.trustLevel}`);
  log(`Approved: ${updated.approvedCount}, Rejected: ${updated.rejectedCount}`);

  // ── Step 5: On-chain attestation (if configured) ──

  if (onChainProvider && DEPLOYER_KEY && CONTRACT_ADDRESS) {
    heading("Step 5: On-chain attestation");

    // Wait a moment for the fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 3000));

    const { BaseTrustProvider } = await import("../packages/pact-onchain/src/BaseTrustProvider.js");
    const reader = new BaseTrustProvider({
      contractAddress: CONTRACT_ADDRESS,
      privateKey: DEPLOYER_KEY,
    });

    const onChainScore = await reader.getTrustScore("deploy-bot");
    log(`On-chain trust score for deploy-bot: ${onChainScore}`);

    const trusted = await reader.verifyTrust("deploy-bot", 30);
    log(`Meets threshold (30)? ${trusted}`);

    log(`Explorer: https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`);

    // ── Step 6: Second agent verifies ──

    heading("Step 6: Second agent queries on-chain trust");
    log(`orchestrator-agent calls verifyTrust("deploy-bot", 30)`);
    log(`Result: ${trusted ? "TRUSTED" : "NOT TRUSTED"}`);
    log(`→ The second agent can verify deploy-bot's track record on-chain.`);
  } else {
    heading("Step 5: On-chain attestation (skipped — dry run)");
    log("In live mode, the approval would be recorded on Base Sepolia.");
    log("Another agent could then call verifyTrust() to check deploy-bot's record.");
  }

  // ── Summary ──

  heading("Summary");
  log("PACT protocol flow complete:");
  log("  1. Agent surfaced a high-stakes decision");
  log("  2. Protocol classified it as blocked (requires principal approval)");
  log("  3. Principal approved, trust score increased");
  if (DEPLOYER_KEY && CONTRACT_ADDRESS) {
    log("  4. Attestation recorded on Base Sepolia");
    log("  5. Second agent verified trust on-chain");
  } else {
    log("  4. (On-chain attestation available with env vars)");
  }

  console.log("\n✓ Demo complete\n");
}

main().catch(console.error);
