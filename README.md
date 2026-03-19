# PACT — Protocol for Agent-human Collaborative Trust

AI agents make thousands of decisions. Most are fine. Some are not. PACT is a lightweight protocol that lets agents surface decisions to humans based on stakes and earned trust — then learn from each interaction to get better over time.

Optionally, trust attestations can be recorded on-chain (Base Sepolia) so other agents can verify an agent's track record without trusting a central authority.

## How it works

```
Agent → Surface decision → Classify (stakes × trust) → Human resolves → Trust updates
                                                                              ↓
                                                              On-chain attestation (optional)
```

**Classification matrix** — 9 cells mapping trust level × stakes to urgency:

|                | High stakes | Medium stakes | Low stakes |
|----------------|-------------|---------------|------------|
| **Supervised** | blocked     | request       | inform     |
| **Guided**     | blocked     | inform        | auto-approve |
| **Autonomous** | request     | auto-approve  | auto-approve |

**Trust scoring** — Agents earn trust through consistent good decisions:
- Approved: +2 | Edited: +1 | Rejected: -5

**On-chain attestations** — Record trust decisions on Base Sepolia so other agents can call `verifyTrust()` to check an agent's track record.

## Quick start

```bash
bun install
bun run --filter pact-protocol build
bun run --filter pact-protocol test
```

## Demo

```bash
# Dry-run (no blockchain required)
bun run scripts/demo.ts

# Live on-chain (requires Base Sepolia)
DEPLOYER_KEY=0x... CONTRACT_ADDRESS=0x... bun run scripts/demo.ts
```

## Deploy contract

```bash
cd packages/pact-onchain
DEPLOYER_KEY=0x... bun run deploy
```

Contract address: _(fill after deploy)_

## Monorepo layout

```
├── packages/
│   ├── pact-protocol/     # Core protocol (zero blockchain deps)
│   │   ├── src/           # Pact class, types, OnChainProvider interface
│   │   ├── test/          # Vitest tests (33 tests)
│   │   └── examples/      # Quickstart + deploy-approval examples
│   └── pact-onchain/      # Base Sepolia trust attestations
│       ├── contracts/     # TrustAttestation.sol
│       ├── src/           # BaseTrustProvider, ABI
│       ├── test/          # Hardhat tests
│       └── scripts/       # Deploy script
├── scripts/
│   └── demo.ts            # Full protocol + on-chain demo
├── pact.md                # PACT v0.1 specification
└── ROADMAP.md             # Project roadmap
```

## Spec

- **[`pact.md`](./pact.md)** — The protocol specification (v0.1)
- **[`ROADMAP.md`](./ROADMAP.md)** — Future directions

## Origin

PACT was extracted from a production system running since early 2026, governing autonomous trades and competitive intelligence workflows with real money at stake. The algorithms and defaults come from that operational experience.

## License

MIT
