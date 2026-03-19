# PACT

**Protocol for Agent-human Collaborative Trust**

An open protocol for agent→human decision delegation in autonomous systems.

PACT defines how AI agents surface decisions to human principals, how those decisions get classified and routed based on stakes and trust, and how the system learns from the principal's responses over time. It's designed for systems where the human steers and the AI rows — not full autonomy, not chat-based prompting, but the collaborative middle ground.

## Quickstart

```typescript
import { Pact } from "pact-protocol";

const protocol = new Pact({ defaultTrustScore: 40 });

// Surface a decision
const decision = protocol.surface({
  agentId: "my-agent",
  title: "Send weekly report to subscribers",
  summary: "Weekly metrics report is ready. 1,204 subscribers will receive it.",
  proposedAction: "Send the email via SendGrid",
  scope: { category: "email", audience: "subscribers" },
  stakes: "medium",
  confidence: 0.9,
});

// Classification happened automatically:
// stakes="medium" + trust=40 (guided) → urgency="inform"

// Resolve it
protocol.resolve({
  decisionId: decision.id,
  action: "approved",
  note: "Looks good, send it",
});

// Trust updated: 40 → 42
```

## Examples

- **[`examples/quickstart.ts`](./examples/quickstart.ts)** — Full lifecycle in ~50 lines
- **[`examples/deploy-approval.ts`](./examples/deploy-approval.ts)** — CI/CD agent surfaces deploy decisions, learns from approval patterns, discovers the principal's boundaries

Run them:
```bash
npm run example:quickstart
npm run example:deploy
```

## Spec

- **[`pact.md`](./pact.md)** — The protocol specification (v0.1)
- **[`ROADMAP.md`](./ROADMAP.md)** — Future directions (scoped trust, shadow mode, confidence calibration)

## Test

```bash
npm test
```

56 tests covering all 9 cells of the classification matrix, trust scoring with boundary crossings, rule matching with specificity, pattern detection, continuations, and events.

## Origin

PACT was extracted from a production system that has been running this protocol since early 2026, governing autonomous trades and competitive intelligence workflows with real money at stake. The algorithms and defaults come from that operational experience.

## Status

v0.1 — extracted from production. The core flow (surface → classify → resolve → learn) is stable and battle-tested. Extensions (revision threads, skill extraction, meta-decisions) are documented but non-normative.

## License

MIT
