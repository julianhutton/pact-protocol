# PACT v0.1

**Protocol for Agent-human Collaborative Trust**

## Abstract

The PACT defines a standard for AI agents to delegate decisions to human principals. It specifies how agents surface decisions with structured evidence, how those decisions are classified by stakes and trust into urgency levels, how principals resolve them, and how the system learns from resolution patterns to calibrate autonomy over time.

## Motivation

Every agent system faces the same design problem: how much autonomy should the agent have?

Full autonomy is fragile — one bad call compounds into many. Chat-based AI requires the human to drive every interaction. The interesting space is in between: agents that act autonomously on low-stakes routine work, escalate high-stakes decisions to the human, and gradually earn more autonomy as they demonstrate good judgment.

This protocol defines that middle ground. It's a framework for **agency delegation** — the fluid handoff of decision-making authority between agents and humans based on stakes, trust, and learned preferences.

The core insight: the human's judgment is the product differentiator, not the AI's autonomy. The protocol's job is to route the right decisions to the human at the right time, with enough context to decide quickly, and to learn which decisions don't need human input at all.

---

## Concepts

### Decision

A structured request from an agent to a principal. Decisions carry a title, summary, proposed action, supporting evidence, alternatives, and metadata used for classification (stakes, confidence). A decision is the atomic unit of PACT.

### Agent

An autonomous process that performs work and surfaces decisions when it encounters situations requiring human judgment. Each agent maintains its own trust state. Agents are identified by a unique `agentId`.

### Principal

The human who resolves decisions. The protocol assumes a single principal per agent (1:1 or many:1), though implementations may extend this to multi-principal scenarios.

### Trust

A numeric score (0–100) representing the system's confidence in an agent's judgment, derived from the principal's historical responses. Trust determines how much autonomy the agent receives via the classification matrix.

**Trust levels:**

| Level | Score Range | Meaning |
|---|---|---|
| Supervised | 0–20 | Agent needs close oversight |
| Guided | 21–50 | Agent has some autonomy on routine work |
| Autonomous | 51–100 | Agent acts independently on most work |

### Scope

An opaque map of dimensions that define the domain of a decision. Implementations define their own scope dimensions. Scope is used for rule matching and pattern detection.

> *Example: an implementation might use `{ goal: "revenue", category: "pricing" }` as scope dimensions. Another might use `{ domain: "infrastructure", service: "payments" }`.*

### Rule

A persistent override that modifies how decisions are classified for a given scope. Rules are created through the learning loop (pattern detection → meta-decision → principal approval) and take precedence over the default classification matrix.

### Continuation

A saved workflow context that allows an agent to pause when it surfaces a blocking decision and resume after the principal resolves it. Continuations capture enough state to reconstruct the agent's context for the resumed run.

---

## Protocol Flow

The protocol defines a four-phase lifecycle for every decision:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Surface  │────▶│ Classify │────▶│ Resolve  │────▶│  Learn   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
  Agent creates    Stakes × Trust    Principal acts    Trust updates,
  decision with    × Rules →         (approve/reject/  pattern detection,
  evidence         urgency level     edit/snooze)      rule creation
```

### Phase 1: Surface

The agent creates a decision when it encounters a situation requiring human judgment or when it wants to propose an action.

A conforming agent MUST provide:
- `title` — short, specific description
- `summary` — 2–3 sentence explanation of the situation
- `proposedAction` — concrete action the agent will take if approved
- `scope` — map of dimensions for classification and learning
- `stakes` — one of `high`, `medium`, `low`
- `confidence` — float 0–1 representing the agent's confidence in its recommendation

A conforming agent SHOULD provide:
- `evidence` — array of supporting evidence items
- `alternatives` — array of alternative options
- `reasoning` — explanation of why this recommendation was chosen

### Phase 2: Classify

The system determines the decision's urgency by evaluating rules first, then falling back to the stakes × trust matrix.

**Step 1: Check rules.** Query all active rules. If any rule's scope matches the decision's scope, apply the most specific matching rule (see [Rule Matching](#rule-matching)).

**Step 2: Apply classification matrix.** If no rule matches, classify using the stakes × trust matrix:

| Stakes \ Trust | Supervised (0–20) | Guided (21–50) | Autonomous (51+) |
|---|---|---|---|
| **High** | `blocked` | `blocked` | `request` |
| **Medium** | `request` | `inform` | *auto-approve* |
| **Low** | `inform` | *auto-approve* | *auto-approve* |

**Urgency levels:**
- `blocked` — Agent MUST wait for principal input before proceeding. The decision blocks the workflow.
- `request` — Agent SHOULD wait for principal input. The decision is surfaced with action buttons.
- `inform` — Agent MAY proceed. The decision is surfaced as informational (no action required).
- *auto-approve* — The decision is recorded and the agent proceeds immediately. The principal is notified but no action is needed.

**Step 3: Record and emit.** The decision is persisted and a `decision:surfaced` event is emitted regardless of urgency level.

### Phase 3: Resolve

The principal resolves a decision by taking one of these actions:

| Action | Effect | Trust Impact |
|---|---|---|
| `approved` | Agent proceeds with proposed action | +2 |
| `rejected` | Agent does not proceed | −5 |
| `edited` | Agent proceeds with modified action (principal provides `editedContent`) | +1 |
| `snoozed` | Decision is deferred (no immediate action) | 0 |

When a decision is resolved, the system MUST:
1. Update the decision record with the resolution action, note, and timestamp
2. Update the agent's trust score (except for `snoozed`)
3. Emit a `decision:resolved` event

**Late resolution of `inform` and auto-approved decisions:** When a decision was classified as `inform` or auto-approved, the agent has already proceeded by the time the principal reviews it. If the principal later rejects such a decision, the rejection is **advisory** — it updates trust (−5) and is recorded for pattern detection, but the protocol does not obligate the agent to undo its action. Rollback behavior is implementation-defined. The trust impact ensures that repeated late rejections will shift the agent toward `guided` or `supervised`, causing future similar decisions to require approval *before* the agent acts.

### Phase 4: Learn

After each resolution (except snooze), the system runs two learning processes:

**Trust update:** Adjust the agent's trust score based on the resolution action (see [Trust Scoring](#trust-scoring)). Recalculate the trust level.

**Pattern detection:** Analyze recent resolutions to detect consistent approval patterns. When a pattern is found, surface a meta-decision asking the principal to create an auto-approve rule (see [Pattern Detection](#pattern-detection)).

---

## Data Models

These are abstract data models. Implementations define their own storage format.

### Decision

```
Decision {
  id:              string          // unique identifier
  agentId:         string          // which agent surfaced this
  scope:           map<string, string>  // implementation-defined dimensions
  stakes:          "high" | "medium" | "low"
  urgency:         "inform" | "request" | "blocked"
  status:          "pending" | "approved" | "rejected" | "edited" | "snoozed" | "expired"

  title:           string
  summary:         string
  proposedAction:  string
  confidence:      float (0–1)

  reasoning:       string?
  evidence:        Evidence[]?
  alternatives:    Alternative[]?

  createdAt:       timestamp
  resolvedAt:      timestamp?
  snoozedUntil:    timestamp?

  resolution: {
    action:        string          // "approved" | "rejected" | "edited" | "snoozed"
    note:          string?         // principal's explanation
    editedContent: string?         // modified action (when action = "edited")
  }?
}
```

### Evidence

```
Evidence {
  type:        string      // implementation-defined (e.g., "data", "research", "competitor")
  title:       string
  detail:      string
  source:      string?     // URL or reference
  confidence:  float (0–1)
}
```

### Alternative

```
Alternative {
  title:       string
  summary:     string
  reasoning:   string
  confidence:  float (0–1)
}
```

### Agent Trust State

```
AgentTrustState {
  agentId:              string
  trustScore:           int (0–100)
  trustLevel:           "supervised" | "guided" | "autonomous"

  totalDecisions:       int
  approvedCount:        int
  rejectedCount:        int
  editedCount:          int
  consecutiveApprovals: int
}
```

### Rule

```
Rule {
  id:                string
  type:              "auto-approve" | "always-request" | "adjust-stakes"
  scope:             map<string, string>  // dimensions to match against
  adjustedStakes:    "high" | "medium" | "low"?  // only for "adjust-stakes"
  sourceDecisionId:  string?   // the meta-decision that created this rule
  active:            boolean
  createdAt:         timestamp
}
```

### Continuation

```
Continuation {
  id:               string
  decisionId:       string     // the blocking decision
  agentId:          string
  status:           "waiting" | "resumed" | "expired"
  workflowContext:  map        // implementation-defined context for resumption
  createdAt:        timestamp
  resumedAt:        timestamp?
}
```

---

## Algorithms

### Classification Matrix

Determines urgency from stakes and trust level. Rules are checked first and override this matrix.

```
function classify(trustLevel, stakes) -> urgency | null:
  // null means auto-approve

  if stakes == "high":
    if trustLevel == "autonomous": return "request"
    return "blocked"

  if stakes == "medium":
    if trustLevel == "supervised": return "request"
    if trustLevel == "guided":    return "inform"
    return null  // autonomous → auto-approve

  if stakes == "low":
    if trustLevel == "supervised": return "inform"
    return null  // guided or autonomous → auto-approve
```

The matrix encodes a conservative philosophy: high-stakes decisions always require human input (even at maximum trust, they're still surfaced as `request`). Medium and low stakes gradually shift toward autonomy as trust increases.

### Trust Scoring

Updates the agent's trust score after each resolution. Trust is bounded to [0, 100].

```
function updateTrust(agent, action) -> updatedAgent:
  delta = 0
  consecutiveApprovals = agent.consecutiveApprovals

  if action == "approved":
    delta = +2
    consecutiveApprovals += 1

  if action == "edited":
    delta = +1
    consecutiveApprovals = 0    // edits reset the streak

  if action == "rejected":
    delta = -5
    consecutiveApprovals = 0    // rejections reset the streak

  trustScore = clamp(agent.trustScore + delta, 0, 100)

  trustLevel = "supervised"
  if trustScore > 50: trustLevel = "autonomous"
  else if trustScore > 20: trustLevel = "guided"

  return {
    trustScore,
    trustLevel,
    consecutiveApprovals,
    approvedCount:  agent.approvedCount  + (action == "approved" ? 1 : 0),
    rejectedCount:  agent.rejectedCount  + (action == "rejected" ? 1 : 0),
    editedCount:    agent.editedCount    + (action == "edited"   ? 1 : 0),
    totalDecisions: agent.totalDecisions + 1,
  }
```

**RECOMMENDED defaults:**
- Approve: +2
- Edit: +1
- Reject: −5
- Trust thresholds: supervised 0–20, guided 21–50, autonomous 51–100

The asymmetry is intentional: trust is hard to earn and easy to lose. A single rejection wipes out 2–3 approvals. This matches the real-world dynamic — one bad autonomous action costs more than several good ones save.

**Note on snooze:** Snooze has zero trust impact. It indicates the principal needs more time, not that the agent was wrong.

### Rule Matching

Checks active rules against a decision's scope. The most specific matching rule wins.

```
function checkRules(scope) -> ruleResult | null:
  activeRules = loadActiveRules()
  matches = []

  for rule in activeRules:
    // A rule matches if every dimension in the rule's scope
    // either matches the decision's scope or is absent (wildcard)
    if matchesScope(rule.scope, scope):
      specificity = countDefinedDimensions(rule.scope)
      matches.append({ rule, specificity })

  if matches is empty: return null

  // Sort: most specific first, then "always-request" wins ties
  sort matches by:
    1. specificity descending
    2. "always-request" before other types at same specificity

  best = matches[0].rule

  switch best.type:
    "auto-approve":   return { type: "auto-approve" }
    "always-request": return { type: "always-request" }
    "adjust-stakes":  return { type: "adjust-stakes", stakes: best.adjustedStakes }
```

**Specificity** is the count of defined dimensions in the rule's scope. A rule with `{ goal: "revenue", category: "pricing" }` (specificity 2) beats a rule with `{ category: "pricing" }` (specificity 1), which beats a catch-all rule with `{}` (specificity 0).

**Safety default:** At the same specificity level, `always-request` beats `auto-approve`. The protocol errs on the side of asking the human.

### Pattern Detection

Analyzes resolved decisions to detect consistent approval patterns. When a pattern is found, the system surfaces a meta-decision proposing a new auto-approve rule.

```
RECOMMENDED constants:
  MIN_DECISIONS     = 5       // minimum decisions before detecting a pattern
  APPROVAL_THRESHOLD = 0.80   // 80% approval rate required
  LOOKBACK_DAYS     = 30      // only consider recent decisions

function detectPatterns() -> patterns[]:
  resolved = loadResolvedDecisions(since: now - LOOKBACK_DAYS)

  // Exclude meta-decisions to prevent recursive pattern detection
  resolved = resolved.filter(d => d is not a meta-decision)

  // Group by scope dimensions
  groups = groupByScope(resolved)

  patterns = []
  for (scopeKey, decisions) in groups:
    if decisions.count < MIN_DECISIONS: continue

    approved = count where status in ("approved", "edited")
    rejected = count where status == "rejected"

    // Pattern: high approval rate AND zero rejections
    if approved / decisions.count >= APPROVAL_THRESHOLD AND rejected == 0:
      patterns.append({
        scope: scopeKey,
        suggestedAction: "auto-approve",
        evidence: { total: decisions.count, approved, rejected }
      })

  return patterns
```

When patterns are detected:
1. Check that no rule already exists for this scope
2. Check that no meta-decision is already pending for this scope
3. Surface a meta-decision: "You've approved N out of M decisions in this scope. Want me to auto-approve these going forward?"
4. If the principal approves the meta-decision, create a persistent `auto-approve` rule

The requirement for **zero rejections** is deliberate. Even one rejection in a scope means the principal has nuanced judgment there that shouldn't be automated away.

### Continuation (Pause/Resume)

When an agent surfaces a blocking decision during a workflow, the system can save the workflow context so the agent can resume after resolution.

```
function createContinuation(decisionId, agentId, workflowContext):
  // workflowContext is implementation-defined but SHOULD include:
  //   - originalPrompt: what the agent was asked to do
  //   - findings: what the agent discovered before pausing
  //   - workflowStep: where in the workflow the agent paused
  //   - decisionTitle/Summary: the decision that caused the pause

  persist continuation with status = "waiting"

function resumeContinuation(decisionId):
  continuation = loadWaitingContinuation(decisionId)
  if not found: return

  // Check expiration (RECOMMENDED: 24 hours)
  if continuation is expired:
    mark as "expired"
    return

  decision = loadDecision(decisionId)

  // Build a context-rich prompt for the resumed agent run
  prompt = buildResumptionPrompt(
    continuation.workflowContext,
    decision.resolution
  )

  mark continuation as "resumed"
  triggerAgentRun(continuation.agentId, prompt)
```

Continuations SHOULD expire after a configurable duration (RECOMMENDED: 24 hours). Stale continuations represent outdated context that may lead to incorrect agent behavior.

---

## Events

The protocol defines two events. Implementations MUST emit these events with the specified payload shapes. The transport mechanism (in-process EventEmitter, message queue, webhook, etc.) is implementation-defined.

### `decision:surfaced`

Emitted when a decision is created, regardless of urgency level. Platform providers (Discord, Slack, dashboard, etc.) subscribe to this event to deliver decisions to the principal.

```
decision:surfaced {
  id:             string
  title:          string
  summary:        string
  proposedAction: string
  scope:          map<string, string>
  urgency:        "inform" | "request" | "blocked"
  confidence:     float (0–1)
  agentId:        string
  reasoning:      string?
  alternatives:   { title: string, summary: string }[]?
}
```

For auto-approved decisions, this event MUST still be emitted with `urgency: "inform"` so that the principal has a full audit trail.

### `decision:resolved`

Emitted when a decision is resolved by the principal. Subscribers use this event to trigger continuations, pattern detection, and downstream workflows.

```
decision:resolved {
  id:     string
  title:  string
  action: "approved" | "rejected" | "edited" | "snoozed"
  note:   string?
}
```

---

## Extensions (Non-Normative)

These extensions are implemented in the reference implementation but are not required for protocol conformance.

### Revision Threads

A principal can request revisions instead of approving or rejecting. This creates a back-and-forth thread:

1. Principal sets decision status to `revision-requested` with feedback
2. Agent reads the feedback and submits a revised summary
3. Decision returns to `pending` status for the principal to re-evaluate
4. Thread history is preserved as an array of `{ role, content, note, timestamp }` turns

### Skill Extraction

After a successful agent run, the system can ask the agent to self-extract a reusable procedure. If the procedure is non-trivial, a `meta-skill` decision is surfaced for the principal to approve. Approved skills persist and are injected into future agent instructions, enabling the agent to learn *how* to execute (complementing rules, which learn *whether* to approve).

### Meta-Decisions

Decisions about decisions. The protocol's pattern detection produces meta-decisions (proposals to create auto-approve rules). Meta-decisions use a reserved scope dimension (e.g., `category: "meta-rule"` or `category: "meta-skill"`) to distinguish them from regular decisions. Meta-decisions are excluded from pattern detection to prevent recursive rule creation.

---

## Reference Implementation

The `pact-protocol` TypeScript library is the reference implementation of this spec. It provides a single `Pact` class with in-memory storage, typed events, and configurable defaults.

| Protocol Concept | Source File | Notes |
|---|---|---|
| Surface + Classify + Resolve | `src/pact.ts` | `surface()`, `classify()`, `resolve()` methods |
| Trust scoring | `src/pact.ts` | `updateTrust()` — internal, called automatically on resolve |
| Rule matching | `src/pact.ts` | `checkRules()`, `matchesScope()`, specificity ordering |
| Pattern detection | `src/pact.ts` | `detectPatterns()`, `surfaceMetaDecision()`, `createRuleFromMetaDecision()` |
| Continuations | `src/pact.ts` | `createContinuation()`, `resumeContinuation()` |
| Event bus + payloads | `src/pact.ts` | `TypedEmitter` wrapping Node.js `EventEmitter` |
| Data models + types | `src/types.ts` | `Decision`, `AgentTrustState`, `Rule`, `Continuation`, `EventMap` |

### Implementation Notes

- **Storage:** In-memory `Map` instances. No database required. Swap in your own persistence layer by extending the class.
- **Default trust:** Agents start at trust score 60 (autonomous level). This reflects an autonomy-first philosophy — agents act by default and earn restrictions through bad calls, rather than starting restricted and earning freedom. Configurable via `defaultTrustScore`.
- **Event transport:** In-process typed `EventEmitter`. Platform providers (Discord, Slack, dashboard, CLI) subscribe to events and handle delivery.
- **Configuration:** All thresholds are configurable: `defaultTrustScore`, `continuationExpiryMs`, `patternMinDecisions`, `patternApprovalThreshold`, `patternLookbackMs`.

### Origin

PACT was extracted from a production system that has been running this protocol since early 2026, governing autonomous trades and competitive intelligence workflows with real money at stake. The algorithms and defaults in this spec come from that operational experience.
