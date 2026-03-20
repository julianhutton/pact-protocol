// PACT — Trading Agent with Risk Thresholds
//
// A trading agent monitors markets and executes trades. The classification
// matrix controls autonomy: low-value trades auto-execute, medium trades are
// surfaced as informational, and high-value/volatile trades are blocked until
// the principal approves. As the agent builds trust, its autonomy expands.
//
// This demonstrates the full classification matrix, trust escalation over time,
// pattern detection, and meta-decisions (the protocol proposing its own rule changes).

import { Pact } from "../src/pact.js";

const protocol = new Pact({
  defaultTrustScore: 15, // New trading agent, starts supervised
  patternMinDecisions: 5,
  patternApprovalThreshold: 0.8,
});

const log = (msg: string) => console.log(`  ${msg}`);
const heading = (msg: string) => console.log(`\n━━ ${msg} ━━`);

function formatTrade(symbol: string, amount: number, action: string): string {
  return `${action} $${amount.toLocaleString()} of ${symbol}`;
}

// ── Scene 1: Low-value trade (auto-approved) ──

heading("Scene 1: Low-value rebalance trade");

const rebalance = protocol.surface({
  agentId: "trading-bot",
  title: formatTrade("ETH", 50, "Buy"),
  summary: "Routine portfolio rebalance. ETH allocation drifted 2% below target.",
  proposedAction: "Market buy 0.02 ETH (~$50) on Coinbase",
  scope: { domain: "trading", asset: "ETH", type: "rebalance" },
  stakes: "low",
  confidence: 0.95,
});

const agent1 = protocol.getAgent("trading-bot")!;
log(`Trust: ${agent1.trustScore} (${agent1.trustLevel})`);
log(`Trade: ${rebalance.title}`);
log(`Stakes: ${rebalance.stakes} | Urgency: ${rebalance.urgency} | Status: ${rebalance.status}`);
if (rebalance.status === "approved") {
  log(`→ Low stakes + ${agent1.trustLevel} trust = auto-approved. Agent executes immediately.`);
} else {
  log(`→ Low stakes + ${agent1.trustLevel} trust = ${rebalance.urgency}. Surfaced to principal.`);
  protocol.resolve({ decisionId: rebalance.id, action: "approved", note: "Fine, go ahead." });
  log(`Principal approved.`);
}

// ── Scene 2: Medium-value trade (inform) ──

heading("Scene 2: Medium-value momentum trade");

const momentum = protocol.surface({
  agentId: "trading-bot",
  title: formatTrade("SOL", 2000, "Buy"),
  summary: "SOL showing strong momentum — 12% gain in 24h with volume surge. Technical indicators bullish.",
  proposedAction: "Limit buy 25 SOL (~$2,000) at $78.50",
  scope: { domain: "trading", asset: "SOL", type: "momentum" },
  stakes: "medium",
  confidence: 0.72,
  evidence: [
    { type: "data", title: "24h change", detail: "+12.3%", confidence: 1.0 },
    { type: "data", title: "RSI", detail: "68 (approaching overbought)", confidence: 0.9 },
    { type: "data", title: "Volume", detail: "3.2x 30-day average", confidence: 1.0 },
  ],
  alternatives: [
    {
      title: "DCA over 3 days",
      summary: "Split the $2,000 across three daily buys to reduce timing risk",
      reasoning: "RSI approaching overbought suggests potential pullback",
      confidence: 0.65,
    },
  ],
});

log(`Trade: ${momentum.title}`);
log(`Stakes: ${momentum.stakes} | Urgency: ${momentum.urgency} | Status: ${momentum.status}`);
if (momentum.status === "approved") {
  log(`→ Medium stakes + guided trust = inform (auto-approved). Agent proceeds.`);
} else {
  log(`→ Medium stakes + guided trust = request. Principal needs to weigh in.`);
}

if (momentum.status === "pending") {
  // Principal approves
  protocol.resolve({
    decisionId: momentum.id,
    action: "approved",
    note: "Volume looks legit. Go ahead with full position.",
  });
  log(`Principal approved: "Volume looks legit."`);
}

// ── Scene 3: High-value trade (blocked) ──

heading("Scene 3: High-value concentrated bet");

const bigTrade = protocol.surface({
  agentId: "trading-bot",
  title: formatTrade("BTC", 25000, "Buy"),
  summary: "Bitcoin forming bullish pennant pattern. Breakout imminent based on 4h chart.",
  proposedAction: "Market buy 0.3 BTC (~$25,000) on Coinbase",
  scope: { domain: "trading", asset: "BTC", type: "breakout" },
  stakes: "high",
  confidence: 0.68,
  evidence: [
    { type: "data", title: "Pattern", detail: "Bullish pennant on 4h chart", confidence: 0.7 },
    { type: "data", title: "Portfolio impact", detail: "Would be 40% of total portfolio", confidence: 1.0 },
    { type: "data", title: "Funding rate", detail: "Neutral (0.01%)", confidence: 1.0 },
  ],
  alternatives: [
    {
      title: "Scale in with stop-loss",
      summary: "Buy $10,000 now, add $15,000 on confirmed breakout above $84K",
      reasoning: "Reduces risk if pattern fails. Portfolio stays diversified.",
      confidence: 0.75,
    },
  ],
});

log(`Trade: ${bigTrade.title}`);
log(`Stakes: ${bigTrade.stakes} | Urgency: ${bigTrade.urgency} | Status: ${bigTrade.status}`);
log(`→ High stakes + guided trust = blocked. Agent cannot proceed.`);

// Principal edits the trade
const edited = protocol.resolve({
  decisionId: bigTrade.id,
  action: "edited",
  note: "Too concentrated. Use the scale-in approach instead.",
  editedContent: "Buy $10,000 BTC now. Add $15,000 only on confirmed breakout above $84K.",
});
log(`Principal edited: "${edited.resolution!.note}"`);
log(`Edited plan: "${edited.resolution!.editedContent}"`);

// ── Scene 4: Build trust through consistent good trades ──

heading("Scene 4: Building trust — 8 more approved trades");

const tradeHistory = [
  // 5 rebalance trades with identical scope to trigger pattern detection
  { asset: "ETH", amount: 1500, type: "rebalance", stakes: "medium" as const },
  { asset: "ETH", amount: 1200, type: "rebalance", stakes: "medium" as const },
  { asset: "ETH", amount: 2000, type: "rebalance", stakes: "medium" as const },
  { asset: "ETH", amount: 1800, type: "rebalance", stakes: "medium" as const },
  { asset: "ETH", amount: 1600, type: "rebalance", stakes: "medium" as const },
  // 3 momentum trades
  { asset: "SOL", amount: 800, type: "momentum", stakes: "medium" as const },
  { asset: "SOL", amount: 1200, type: "momentum", stakes: "medium" as const },
  { asset: "SOL", amount: 900, type: "momentum", stakes: "medium" as const },
];

for (const trade of tradeHistory) {
  const d = protocol.surface({
    agentId: "trading-bot",
    title: formatTrade(trade.asset, trade.amount, "Buy"),
    summary: `${trade.type} trade for ${trade.asset}.`,
    proposedAction: `Buy ~$${trade.amount} of ${trade.asset}`,
    scope: { domain: "trading", asset: trade.asset, type: trade.type },
    stakes: trade.stakes,
    confidence: 0.85,
  });

  if (d.status === "pending") {
    protocol.resolve({ decisionId: d.id, action: "approved" });
  }
}

const afterTrades = protocol.getAgent("trading-bot")!;
log(`Trust: ${afterTrades.trustScore} (${afterTrades.trustLevel})`);
log(`Record: ${afterTrades.approvedCount} approved, ${afterTrades.rejectedCount} rejected, ${afterTrades.editedCount} edited`);
log(`Consecutive approvals: ${afterTrades.consecutiveApprovals}`);

// ── Scene 5: Pattern detection ──

heading("Scene 5: Pattern detection fires");

const patterns = protocol.detectPatterns();
log(`Patterns detected: ${patterns.length}`);

for (const p of patterns) {
  const scopeStr = Object.entries(p.scope).map(([k, v]) => `${k}=${v}`).join(", ");
  log(`  Scope: { ${scopeStr} }`);
  log(`  ${p.evidence.approved}/${p.evidence.total} approved, ${p.evidence.rejected} rejected`);
  log(`  Suggested: ${p.suggestedAction}`);

  // Surface meta-decision
  const meta = protocol.surfaceMetaDecision(p, "trading-bot");
  if (meta) {
    log(`\n  Meta-decision: "${meta.title}"`);
    log(`  Status: ${meta.status} (urgency: ${meta.urgency})`);

    // Principal approves auto-approve for rebalance trades
    if (scopeStr.includes("rebalance")) {
      protocol.resolve({
        decisionId: meta.id,
        action: "approved",
        note: "Yes, rebalance trades are safe to auto-approve.",
      });
      protocol.createRuleFromMetaDecision(meta.id);
      log(`  → Principal approved! Rebalance trades now auto-approve.`);
    } else {
      protocol.resolve({
        decisionId: meta.id,
        action: "rejected",
        note: "No — momentum trades need my review.",
      });
      log(`  → Principal rejected. Momentum trades still require approval.`);
    }
  }
}

// ── Scene 6: Test auto-approve rule ──

heading("Scene 6: Rebalance trade — testing learned rules");

const autoRebalance = protocol.surface({
  agentId: "trading-bot",
  title: formatTrade("ETH", 1000, "Buy"),
  summary: "ETH allocation drifted. Rebalancing.",
  proposedAction: "Buy ~$1,000 ETH",
  scope: { domain: "trading", asset: "ETH", type: "rebalance" },
  stakes: "medium",
  confidence: 0.92,
});

log(`Trade: ${autoRebalance.title}`);
log(`Status: ${autoRebalance.status}`);
if (autoRebalance.status === "approved") {
  log(`→ Auto-approved! The learned rule or trust level handled it.`);
} else {
  log(`→ Still requires approval — trust not yet high enough for this stakes level.`);
  protocol.resolve({ decisionId: autoRebalance.id, action: "approved" });
}

// ── Final state ──

heading("Final state");

const final = protocol.getAgent("trading-bot")!;
log(`Trust: ${final.trustScore} (${final.trustLevel})`);
log(`Record: ${final.approvedCount} approved, ${final.rejectedCount} rejected, ${final.editedCount} edited`);
log(``);
log("Classification matrix in practice:");
log("  Low-stakes rebalances → always auto-approved (trust level)");
log("  Medium-stakes rebalances → now auto-approved (learned rule)");
log("  Medium-stakes momentum → still requires principal review");
log("  High-stakes concentrated bets → always blocked");
log(``);
log("The agent earned autonomy for routine trades but the principal");
log("stays in the loop for novel strategies and large positions.");

console.log("\n✓ Trading agent example complete\n");
