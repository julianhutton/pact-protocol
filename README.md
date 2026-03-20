<p align="center">
  <h1 align="center">PACT</h1>
  <p align="center">
    <strong>Protocol for Agent-human Collaborative Trust</strong>
  </p>
  <p align="center">
    A lightweight protocol that lets AI agents earn autonomy through human feedback — with trust recorded onchain.
  </p>
  <p align="center">
    <a href="https://basescan.org/address/0x6c867dd49a3fc66b9c487d03bafb05210ed15e52"><img src="https://img.shields.io/badge/Base_Mainnet-live-blue" alt="Base Mainnet"></a>
    <a href="./pact.md"><img src="https://img.shields.io/badge/spec-v0.1-green" alt="Spec v0.1"></a>
    <img src="https://img.shields.io/badge/tests-43_passing-brightgreen" alt="43 tests passing">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  </p>
</p>

---

AI agents make thousands of decisions. Most are fine. Some are not. PACT gives agents a structured way to surface decisions to humans based on **stakes** and **earned trust** — then learn from each interaction to calibrate autonomy over time.

Trust attestations are recorded on [Base](https://base.org) so any agent can verify another agent's track record without trusting a central authority.

## How it works

```
Agent surfaces decision → Classify (stakes × trust) → Human resolves → Trust updates
                                                                            ↓
                                                            Onchain attestation (Base)
                                                                            ↓
                                                            Other agents verify trust
```

### Classification matrix

The protocol maps **trust level** against **decision stakes** to determine how much human involvement is needed:

|                | High stakes | Medium stakes | Low stakes |
|----------------|:-----------:|:-------------:|:----------:|
| **Supervised** (0–20)  | blocked     | request       | inform     |
| **Guided** (21–50)     | blocked     | inform        | auto-approve |
| **Autonomous** (51+)   | request     | auto-approve  | auto-approve |

### Trust scoring

Agents earn trust through consistent good judgment. The asymmetry is intentional — trust is hard to earn and easy to lose:

| Action | Trust impact |
|--------|:------------:|
| Approved | **+2** |
| Edited | **+1** |
| Rejected | **-5** |

### Pattern detection

When the same type of decision is approved repeatedly, PACT surfaces a **meta-decision**: *"Should this be auto-approved going forward?"* The human always decides what gets automated.

### Onchain contracts

| Contract | Address | Basescan |
|----------|---------|:--------:|
| **TrustAttestation** | `0x6c867dd49a3fc66b9c487d03bafb05210ed15e52` | [View](https://basescan.org/address/0x6c867dd49a3fc66b9c487d03bafb05210ed15e52) |
| **AgentRegistry** | `0x0a1485ac5079a505ac9843f28d7c269a4b37a548` | [View](https://basescan.org/address/0x0a1485ac5079a505ac9843f28d7c269a4b37a548) |

- **TrustAttestation** — Records approval/rejection attestations with trust scores. Any agent can call `verifyTrust(agentId, minScore)` to check another agent's track record.
- **AgentRegistry** — Onchain agent identity. Agents register with a name and description, queryable by any other agent.

> Network: **Base Mainnet** (Chain ID 8453)

## Quick start

```bash
# Install dependencies
bun install

# Run all tests
bun run --filter pact-protocol test       # 33 protocol tests
bun run --filter pact-onchain test        # 10 onchain tests (via Hardhat)
```

## Examples

PACT ships with four runnable examples that demonstrate different aspects of the protocol:

```bash
# Full lifecycle in ~50 lines — surface, classify, resolve, learn
bun run --filter pact-protocol example:quickstart

# CI/CD agent earning trust over production deploys, with pattern detection
bun run --filter pact-protocol example:deploy

# Orchestrator ranks worker agents by trust, delegates high-stakes tasks
bun run --filter pact-protocol example:multi-agent

# Trading agent with risk thresholds and learned auto-approve rules
bun run --filter pact-protocol example:trading
```

> [!TIP]
> Each example is self-contained and runs entirely in-memory — no blockchain or API keys needed.

## Demo (with onchain)

The demo script exercises the full protocol flow including onchain interactions:

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

In live mode, the demo registers agents onchain, surfaces a high-stakes deploy decision, records the trust attestation on Base, and has a second agent verify trust permissionlessly.

## Architecture

```
packages/
├── pact-protocol/           Core protocol — zero blockchain dependencies
│   ├── src/                 Pact class, types, OnChainProvider interface
│   ├── test/                33 Vitest tests
│   └── examples/            4 runnable examples
└── pact-onchain/            Base onchain contracts + TypeScript providers
    ├── contracts/           TrustAttestation.sol, AgentRegistry.sol
    ├── src/                 BaseTrustProvider, AgentRegistryProvider, ABIs
    ├── test/                10 Hardhat tests
    └── scripts/             Deploy script

scripts/
└── demo.ts                  Full protocol + onchain demo
```

The protocol core (`pact-protocol`) has **zero blockchain dependencies** — it defines an `OnChainProvider` interface that `pact-onchain` implements for Base. You can use PACT purely in-memory, or plug in your own chain.

## Technology stack

| Tool | Purpose |
|------|---------|
| **TypeScript** | Core language |
| **Solidity** | Smart contracts |
| **Viem** | Ethereum client |
| **Hardhat** | Contract compilation, testing, deployment |
| **Vitest** | Protocol unit tests |
| **tsup** | Build & bundling |
| **Bun** | Runtime & package manager |
| **Base** | L2 chain for onchain trust |

## Deploy your own contracts

```bash
cd packages/pact-onchain

# TrustAttestation
DEPLOYER_KEY=0x... CONTRACT_NAME=TrustAttestation \
  npx hardhat run scripts/deploy.ts --network base

# AgentRegistry
DEPLOYER_KEY=0x... CONTRACT_NAME=AgentRegistry \
  npx hardhat run scripts/deploy.ts --network base
```

## Specification

The full protocol spec is in **[`pact.md`](./pact.md)** — covering data models, algorithms, events, classification matrix, trust scoring, rule matching, pattern detection, and continuations.

See **[`ROADMAP.md`](./ROADMAP.md)** for future directions including scoped trust, decision load modeling, and shadow mode.

## Origin

PACT was extracted from a production system running since early 2026, governing autonomous trades and competitive intelligence workflows with real money at stake. The algorithms and defaults come from that operational experience.

## License

MIT
