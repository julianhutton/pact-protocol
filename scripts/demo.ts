// PACT Demo — Full loop: surface → resolve → trust update → on-chain → verify
//
// Usage:
//   bun run scripts/demo.ts                          # dry-run (no on-chain)
//   DEPLOYER_KEY=0x... TRUST_CONTRACT=0x... REGISTRY_CONTRACT=0x... bun run scripts/demo.ts              # live on-chain (Base Sepolia)
//   DEPLOYER_KEY=0x... TRUST_CONTRACT=0x... REGISTRY_CONTRACT=0x... NETWORK=mainnet bun run scripts/demo.ts  # live on-chain (Base Mainnet)

import { Pact } from "../packages/pact-protocol/src/pact.js";
import type { OnChainProvider } from "../packages/pact-protocol/src/types.js";

const DEPLOYER_KEY = process.env.DEPLOYER_KEY as `0x${string}` | undefined;
const TRUST_CONTRACT = process.env.TRUST_CONTRACT as `0x${string}` | undefined;
const REGISTRY_CONTRACT = process.env.REGISTRY_CONTRACT as `0x${string}` | undefined;
const NETWORK = process.env.NETWORK ?? "sepolia";

const log = (msg: string) => console.log(`  ${msg}`);
const heading = (msg: string) => console.log(`\n━━ ${msg} ━━`);

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  PACT Demo — Protocol for Agent-human       ║");
  console.log("║  Collaborative Trust                        ║");
  console.log("╚══════════════════════════════════════════════╝");

  const isMainnet = NETWORK === "mainnet";
  const rpcUrl = isMainnet ? "https://mainnet.base.org" : "https://sepolia.base.org";
  const explorerBase = isMainnet ? "https://basescan.org" : "https://sepolia.basescan.org";

  // Optionally set up on-chain providers
  let onChainProvider: OnChainProvider | undefined;
  let trustProvider: any;
  let registryProvider: any;

  const hasOnChain = DEPLOYER_KEY && TRUST_CONTRACT;

  if (hasOnChain) {
    heading(`On-chain mode: Base ${isMainnet ? "Mainnet" : "Sepolia"}`);
    log(`Trust contract: ${TRUST_CONTRACT}`);
    if (REGISTRY_CONTRACT) log(`Registry contract: ${REGISTRY_CONTRACT}`);

    const { BaseTrustProvider } = await import("../packages/pact-onchain/src/BaseTrustProvider.js");
    const { base, baseSepolia } = await import("../packages/pact-onchain/src/index.js");
    const chain = isMainnet ? base : baseSepolia;

    trustProvider = new BaseTrustProvider({
      contractAddress: TRUST_CONTRACT!,
      privateKey: DEPLOYER_KEY!,
      rpcUrl,
      chain,
    });
    onChainProvider = trustProvider;

    if (REGISTRY_CONTRACT) {
      const { AgentRegistryProvider } = await import("../packages/pact-onchain/src/AgentRegistryProvider.js");
      registryProvider = new AgentRegistryProvider({
        contractAddress: REGISTRY_CONTRACT,
        privateKey: DEPLOYER_KEY!,
        rpcUrl,
        chain,
      });
    }

    log("Providers initialized");
  } else {
    heading("Dry-run mode (no on-chain)");
    log("Set DEPLOYER_KEY and TRUST_CONTRACT env vars for live on-chain demo");
    log("Optionally set REGISTRY_CONTRACT for agent registry demo");
    log("Set NETWORK=mainnet for Base mainnet (default: sepolia)");
  }

  // ── Step 1: Register agents on-chain ──

  if (registryProvider) {
    heading("Step 1: Register agents on-chain");

    try {
      const isRegistered = await registryProvider.isRegistered("deploy-bot");
      if (!isRegistered) {
        const { txHash } = await registryProvider.registerAgent({
          agentId: "deploy-bot",
          name: "Deploy Bot",
          description: "CI/CD agent that handles production deployments",
        });
        log(`Registered deploy-bot: ${explorerBase}/tx/${txHash}`);
      } else {
        log("deploy-bot already registered on-chain");
      }
    } catch (err: any) {
      log(`Registration: ${err.message?.includes("already registered") ? "already registered" : err.message}`);
    }

    // Small delay to avoid nonce conflicts on Base free RPC
    await new Promise((r) => setTimeout(r, 3000));

    try {
      const isRegistered = await registryProvider.isRegistered("orchestrator");
      if (!isRegistered) {
        const { txHash } = await registryProvider.registerAgent({
          agentId: "orchestrator",
          name: "Orchestrator Agent",
          description: "Coordinates tasks across agents, verifies trust",
        });
        log(`Registered orchestrator: ${explorerBase}/tx/${txHash}`);
      } else {
        log("orchestrator already registered on-chain");
      }
    } catch (err: any) {
      log(`Registration: ${err.message?.includes("already registered") ? "already registered" : err.message}`);
    }

    const count = await registryProvider.getAgentCount();
    log(`Total agents registered on-chain: ${count}`);
  } else {
    heading("Step 1: Agent registration (skipped — dry run)");
    log("In live mode, agents register on-chain with AgentRegistry contract.");
  }

  // ── Step 2: Surface a high-stakes decision ──

  heading("Step 2: Surface a high-stakes decision");

  const protocol = new Pact({
    defaultTrustScore: 30,
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

  // ── Step 3: Show classification ──

  heading("Step 3: Classification result");

  const agent = protocol.getAgent("deploy-bot")!;
  const preTrustScore = agent.trustScore;
  log(`Agent trust: ${preTrustScore} (${agent.trustLevel})`);
  log(`Stakes: ${decision.stakes}`);
  log(`Urgency: ${decision.urgency}`);
  log(`Status: ${decision.status}`);
  log(`→ Blocked — high stakes with a guided-trust agent.`);

  // ── Step 4: Principal approves ──

  heading("Step 4: Principal approves");

  const resolved = protocol.resolve({
    decisionId: decision.id,
    action: "approved",
    note: "Ship it. Tests look clean and rollback plan is solid.",
  });
  log(`Action: ${resolved.resolution!.action}`);
  log(`Note: "${resolved.resolution!.note}"`);

  // ── Step 5: Trust score update ──

  heading("Step 5: Trust score updated");

  const updated = protocol.getAgent("deploy-bot")!;
  log(`Trust: ${preTrustScore} → ${updated.trustScore} (+2 for approval)`);
  log(`Level: ${updated.trustLevel}`);
  log(`Approved: ${updated.approvedCount}, Rejected: ${updated.rejectedCount}`);

  // ── Step 6: On-chain attestation ──

  if (hasOnChain) {
    heading("Step 6: On-chain trust attestation");

    // Wait for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 5000));

    const onChainScore = await trustProvider.getTrustScore("deploy-bot");
    log(`On-chain trust score for deploy-bot: ${onChainScore}`);

    const trusted = await trustProvider.verifyTrust("deploy-bot", 30);
    log(`Meets threshold (30)? ${trusted}`);
    log(`Explorer: ${explorerBase}/address/${TRUST_CONTRACT}`);

    // ── Step 7: Cross-agent trust verification ──

    heading("Step 7: Orchestrator verifies deploy-bot's trust on-chain");

    log(`orchestrator calls verifyTrust("deploy-bot", 30)`);
    log(`Result: ${trusted ? "TRUSTED ✓" : "NOT TRUSTED ✗"}`);

    if (registryProvider) {
      try {
        const agentInfo = await registryProvider.getAgent("deploy-bot");
        log(`On-chain identity: "${agentInfo.name}" — ${agentInfo.description}`);
      } catch {
        log(`(Registry lookup skipped — RPC rate limit)`);
      }
    }

    log(`→ Any agent can verify deploy-bot's track record permissionlessly on Base.`);
  } else {
    heading("Step 6: On-chain attestation (skipped — dry run)");
    log("In live mode:");
    log("  → Trust attestation recorded on Base");
    log("  → Agent identity stored in AgentRegistry");
    log("  → Other agents verify trust via verifyTrust()");
  }

  // ── Summary ──

  heading("Summary");
  log("PACT protocol flow:");
  log("  1. Agents register on-chain (AgentRegistry)");
  log("  2. Agent surfaces a high-stakes decision");
  log("  3. Protocol classifies: blocked (requires principal approval)");
  log("  4. Principal approves → trust score increases");
  log("  5. Attestation recorded on Base (TrustAttestation)");
  log("  6. Other agents verify trust on-chain — permissionless");
  log("");
  log("Contracts:");
  if (hasOnChain) {
    log(`  TrustAttestation: ${explorerBase}/address/${TRUST_CONTRACT}`);
    if (REGISTRY_CONTRACT) {
      log(`  AgentRegistry:    ${explorerBase}/address/${REGISTRY_CONTRACT}`);
    }
  } else {
    log("  (deploy with DEPLOYER_KEY to see live contract links)");
  }

  console.log("\n✓ Demo complete\n");
}

main().catch(console.error);
