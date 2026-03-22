# pact-protocol

**Protocol for Agent-human Collaborative Trust** — a lightweight protocol that lets AI agents earn autonomy through human feedback.

Agents surface decisions to humans based on **stakes** and **earned trust**, then learn from each interaction to calibrate autonomy over time. Trust attestations can be recorded onchain (Base) so any agent can verify another agent's track record.

## Install

```bash
npm install pact-protocol
```

## Quick start

```typescript
import { Pact } from "pact-protocol";

const protocol = new Pact({ defaultTrustScore: 40 });

// Surface a decision for human review
const decision = protocol.surface({
  agentId: "my-agent",
  title: "Send weekly report to subscribers",
  summary: "Weekly metrics report is ready. 1,204 subscribers will receive it.",
  proposedAction: "Send the email via SendGrid",
  scope: { category: "email", audience: "subscribers" },
  stakes: "medium",
  confidence: 0.9,
});

// The protocol classifies it automatically:
// trust level + stakes → blocked | request | inform | auto-approve

// Human resolves the decision
const resolved = protocol.resolve({
  decisionId: decision.id,
  action: "approved",
  note: "Looks good, send it",
});

// Trust updates: approved → +2, edited → +1, rejected → -5
const agent = protocol.getAgent("my-agent");
console.log(agent.trustScore); // 42
```

## Classification matrix

The protocol maps **trust level** against **decision stakes** to determine how much human involvement is needed:

|                | High stakes | Medium stakes | Low stakes |
|----------------|:-----------:|:-------------:|:----------:|
| **Supervised** (0-20)  | blocked     | request       | inform     |
| **Guided** (21-50)     | blocked     | inform        | auto-approve |
| **Autonomous** (51+)   | request     | auto-approve  | auto-approve |

## Features

- Zero runtime dependencies
- TypeScript-first with full type exports
- Event system (`decision:surfaced`, `decision:resolved`)
- Pattern detection with meta-decisions
- Configurable rules and trust thresholds
- Optional onchain trust attestations (Base)

## API

The main export is the `Pact` class. Key types are also exported:

```typescript
import { Pact } from "pact-protocol";
import type {
  PactConfig,
  Decision,
  Resolution,
  Stakes,
  TrustLevel,
  AgentTrustState,
  Rule,
} from "pact-protocol";
```

## License

MIT

## Links

- [Full documentation and examples](https://github.com/julianhutton/pact-protocol)
- [Protocol specification](https://github.com/julianhutton/pact-protocol/blob/main/pact.md)
