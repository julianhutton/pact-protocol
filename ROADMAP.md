# PACT Roadmap

Ideas for future versions, sourced from independent reviews (Claude, ChatGPT) and dogfooding.

## v0.2 Candidates

### Scoped Trust
Single trust score per agent is too coarse — an agent could be great at research but terrible at pricing. Per-scope trust would track trust at the `(agentId, scope)` level, so the classification matrix uses the trust score for the specific domain, not the agent's global average.

**Complexity:** High. Affects the classification matrix, trust scoring, pattern detection, and agent trust state model. Need to decide: does scoped trust replace global trust or layer on top?

### Decision Load Modeling
The protocol doesn't model human attention as a finite resource. Track:
- Decisions surfaced per day
- Average resolution time
- Snooze rate (high snooze rate = decision fatigue)

Could feed into classification: if the principal is overwhelmed, temporarily raise the auto-approve threshold to reduce noise.

### Shadow Mode
"What would have been auto-approved" without actually auto-approving. Useful for building trust in the trust system itself — the principal can review shadow auto-approvals and gain confidence before enabling real auto-approve rules.

### Confidence Calibration
Track agent confidence predictions against actual outcomes (approved/rejected). Penalize systematic overconfidence. Requires outcome tracking, which is implementation-specific, but the protocol could define a standard `decision:outcome` event.

### Edit-Derived Micro-Rules
Edits are high-signal feedback — the principal agreed with the direction but changed specifics. Could extract patterns from edits (e.g., "always lower the amount by 20%") and surface as micro-rule proposals. Related to skill extraction but more granular.

### Decision Quality Metric
Composite score combining: resolution speed, edit frequency, reversal rate, outcome success. Could replace or supplement the simple trust score. Risks overcomplicating the core model.

## Explicitly Deferred

### Loosening Pattern Detection (zero-rejections requirement)
Suggested: allow small tolerance (e.g., ≤10% rejection rate). **Decision: keep strict.** Zero rejections is a feature — even one rejection means the principal has nuanced judgment in that scope. The safety guarantee is worth the slower rule creation.

### Rollback Model
Suggested: add `reversibility: reversible | partial | irreversible` field. **Decision: not needed.** Late rejection is advisory, and trust is the correction mechanism. Repeated late rejections naturally shift the agent toward requiring pre-approval. Adding reversibility tracking overcomplicates the core protocol.

### Scope Standardization
Suggested: introduce a minimal schema (`domain`, `category`, `actionType`). **Decision: keep opaque.** The whole point of scopes is that implementations define their own dimensions. Standardizing would limit adoption across different domains.

## Positioning Ideas (from ChatGPT review)

- **"Decision Operating System"** — decisions become composable, agents become interchangeable, trust becomes portable
- **"Adaptive autonomy with explicit governance"** — category label
- **"A protocol for governing AI autonomy through structured human judgment"** — one-liner
