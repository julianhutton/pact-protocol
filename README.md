# PACT — Protocol for Agent-human Collaborative Trust

AI agents make thousands of decisions. Most are fine. Some are not. PACT is a lightweight protocol that lets agents surface decisions to humans based on stakes and earned trust — then learn from each interaction to get better over time.

Trust attestations are recorded on-chain (Base) so other agents can verify an agent's track record without trusting a central authority.

## How it works

```
Agent → Surface decision → Classify (stakes × trust) → Human resolves → Trust updates
                                                                              ↓
                                                              On-chain attestation (Base)
                                                                              ↓
                                                              Other agents verify trust
```

**Classification matrix** — 9 cells mapping trust level × stakes to urgency:

|                | High stakes | Medium stakes | Low stakes |
|----------------|-------------|---------------|------------|
| **Supervised** | blocked     | request       | inform     |
| **Guided**     | blocked     | inform        | auto-approve |
| **Autonomous** | request     | auto-approve  | auto-approve |

**Trust scoring** — Agents earn trust through consistent good decisions:
- Approved: +2 | Edited: +1 | Rejected: -5

**Pattern detection** — When the same type of decision is approved repeatedly, PACT surfaces a meta-decision: "Should this be auto-approved going forward?" The principal stays in control of what gets automated.

**On-chain contracts (Base Mainnet)**:
- **TrustAttestation** — Records approval/rejection attestations with trust scores. Any agent can call `verifyTrust(agentId, minScore)` to check another agent's track record.
- **AgentRegistry** — On-chain agent identity. Agents register with a name and description, queryable by any other agent.

## Live contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| TrustAttestation | `0x6c867dd49a3fc66b9c487d03bafb05210ed15e52` | [basescan](https://basescan.org/address/0x6c867dd49a3fc66b9c487d03bafb05210ed15e52) |
| AgentRegistry | `0x0a1485ac5079a505ac9843f28d7c269a4b37a548` | [basescan](https://basescan.org/address/0x0a1485ac5079a505ac9843f28d7c269a4b37a548) |

Network: **Base Mainnet** (Chain ID 8453)

## Quick start

```bash
bun install
bun run --filter pact-protocol test       # 33 protocol tests
bun run --filter pact-onchain test        # 10 on-chain tests
```

## Examples

```bash
# Quickstart — full lifecycle in ~50 lines
bun run --filter pact-protocol example:quickstart

# Deploy approval — CI/CD agent earning trust, pattern detection, meta-decisions
bun run --filter pact-protocol example:deploy

# Multi-agent trust — orchestrator ranks workers by trust, delegates tasks
bun run --filter pact-protocol example:multi-agent

# Trading agent — classification matrix, risk thresholds, learned auto-approve rules
bun run --filter pact-protocol example:trading
```

## Demo (with on-chain)

```bash
# Dry-run (no blockchain required)
bun run scripts/demo.ts

# Live on Base Mainnet
DEPLOYER_KEY=0x... \
  TRUST_CONTRACT=0x6c867dd49a3fc66b9c487d03bafb05210ed15e52 \
  REGISTRY_CONTRACT=0x0a1485ac5079a505ac9843f28d7c269a4b37a548 \
  NETWORK=mainnet \
  bun run scripts/demo.ts
```

The demo registers agents on-chain, surfaces a high-stakes deploy decision, records the trust attestation on Base, and has a second agent verify trust permissionlessly.

## Deploy your own contracts

```bash
cd packages/pact-onchain

# TrustAttestation
DEPLOYER_KEY=0x... CONTRACT_NAME=TrustAttestation npx hardhat run scripts/deploy.ts --network base

# AgentRegistry
DEPLOYER_KEY=0x... CONTRACT_NAME=AgentRegistry npx hardhat run scripts/deploy.ts --network base
```

## Monorepo layout

```
├── packages/
│   ├── pact-protocol/        # Core protocol (zero blockchain deps)
│   │   ├── src/              # Pact class, types, OnChainProvider interface
│   │   ├── test/             # 33 Vitest tests
│   │   └── examples/         # 4 runnable examples
│   └── pact-onchain/         # Base on-chain contracts + providers
│       ├── contracts/        # TrustAttestation.sol, AgentRegistry.sol
│       ├── src/              # BaseTrustProvider, AgentRegistryProvider, ABIs
│       ├── test/             # 10 Hardhat tests
│       └── scripts/          # Deploy script
├── scripts/
│   └── demo.ts               # Full protocol + on-chain demo
├── pact.md                   # PACT v0.1 specification
└── ROADMAP.md                # Project roadmap
```

## Spec

- **[`pact.md`](./pact.md)** — The protocol specification (v0.1)
- **[`ROADMAP.md`](./ROADMAP.md)** — Future directions

## Origin

PACT was extracted from a production system running since early 2026, governing autonomous trades and competitive intelligence workflows with real money at stake. The algorithms and defaults come from that operational experience.

## License

MIT
