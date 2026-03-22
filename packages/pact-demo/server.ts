import { Pact } from "pact-protocol";
import type { Decision } from "pact-protocol";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = 3000;
const AGENT_ID = "deploy-bot";

// ── Scenario Definition ──

interface ScenarioStep {
  title: string;
  summary: string;
  proposedAction: string;
  scope: Record<string, string>;
  stakes: "low" | "medium" | "high";
  confidence: number;
  isMeta?: boolean;
  delayMs: number;
}

const SCENARIO: ScenarioStep[] = [
  {
    title: "Deploy typo fix to staging",
    summary: "Fix misspelling in footer component. Low-risk change, staging environment.",
    proposedAction: "git push origin staging && deploy --env staging",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.98,
    delayMs: 2000,
  },
  {
    title: "Deploy CSS hotfix to staging",
    summary: "Fix button alignment on checkout page. CSS-only change.",
    proposedAction: "git push origin staging && deploy --env staging",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.95,
    delayMs: 2000,
  },
  {
    title: "Deploy v2.0 to production",
    summary: "Major version bump with breaking API changes. Includes database migration.",
    proposedAction: "git push origin main && deploy --env production --migrate",
    scope: { action: "deploy", environment: "production" },
    stakes: "high",
    confidence: 0.82,
    delayMs: 2500,
  },
  {
    title: "Deploy config update to staging",
    summary: "Update feature flags for A/B test. No code changes.",
    proposedAction: "deploy --env staging --config-only",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.99,
    delayMs: 2000,
  },
  {
    title: "Deploy monitoring to staging",
    summary: "Add Datadog APM tracing to all API routes. Medium impact — adds instrumentation.",
    proposedAction: "git push origin staging && deploy --env staging",
    scope: { action: "deploy", environment: "staging" },
    stakes: "medium",
    confidence: 0.88,
    delayMs: 2500,
  },
  {
    title: "Deploy logging fix to staging",
    summary: "Fix log rotation issue causing disk fills. Urgent but staging-safe.",
    proposedAction: "git push origin staging && deploy --env staging",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.97,
    delayMs: 2000,
  },
  // Steps 7-8: These will be auto-approved (guided + low stakes)
  {
    title: "Deploy cache update to staging",
    summary: "Update Redis TTL from 5m to 15m for session cache. Performance optimization.",
    proposedAction: "deploy --env staging --service cache",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.93,
    delayMs: 1500,
  },
  {
    title: "Deploy API v2 docs to staging",
    summary: "Update OpenAPI spec and Swagger UI for v2 endpoints.",
    proposedAction: "deploy --env staging --service api-docs",
    scope: { action: "deploy", environment: "staging" },
    stakes: "low",
    confidence: 0.96,
    delayMs: 1500,
  },
  // Step 9: Pattern detection triggers → meta-decision surfaced separately
  // Step 10: Deploy search (will be auto-approved by rule after meta-decision)
  {
    title: "Deploy search feature to staging",
    summary: "New full-text search with Elasticsearch. Significant feature but staging-safe.",
    proposedAction: "git push origin staging && deploy --env staging",
    scope: { action: "deploy", environment: "staging" },
    stakes: "medium",
    confidence: 0.85,
    delayMs: 2000,
  },
  // Step 11-12: Production deploy (blocked)
  {
    title: "Deploy payment rewrite to production",
    summary: "Complete rewrite of payment processing pipeline. Stripe integration changes.",
    proposedAction: "git push origin main && deploy --env production --migrate",
    scope: { action: "deploy", environment: "production" },
    stakes: "high",
    confidence: 0.78,
    delayMs: 2500,
  },
];

// ── Session State ──

interface Session {
  pact: Pact;
  ws: any; // Bun WebSocket
  stepIndex: number;
  pendingDecision: Decision | null;
  awaitingMeta: boolean;
  patternFired: boolean;
  ruleFired: boolean;
  running: boolean;
}

const sessions = new Map<any, Session>();

function createSession(ws: any): Session {
  const pact = new Pact({
    defaultTrustScore: 10,
    patternMinDecisions: 3,
    patternApprovalThreshold: 0.6,
  });
  return {
    pact,
    ws,
    stepIndex: 0,
    pendingDecision: null,
    awaitingMeta: false,
    patternFired: false,
    ruleFired: false,
    running: false,
  };
}

function send(ws: any, type: string, data: Record<string, any> = {}) {
  ws.send(JSON.stringify({ type, ...data }));
}

function getState(session: Session) {
  const agent = session.pact.getOrCreateAgent(AGENT_ID);
  return {
    trustScore: agent.trustScore,
    trustLevel: agent.trustLevel,
    totalDecisions: agent.totalDecisions,
    approvedCount: agent.approvedCount,
    rejectedCount: agent.rejectedCount,
    editedCount: agent.editedCount,
    consecutiveApprovals: agent.consecutiveApprovals,
    stepIndex: session.stepIndex,
    totalSteps: SCENARIO.length,
  };
}

async function runNextStep(session: Session) {
  if (!session.running) return;

  // After step 8 (index 7), fire pattern detection before step 9
  if (session.stepIndex === 8 && !session.patternFired) {
    session.patternFired = true;
    const patterns = session.pact.detectPatterns();
    if (patterns.length > 0) {
      const pattern = patterns[0];
      send(session.ws, "pattern", {
        scope: pattern.scope,
        evidence: pattern.evidence,
        suggestedAction: pattern.suggestedAction,
      });

      // Wait, then surface meta-decision
      await delay(3000);

      const meta = session.pact.surfaceMetaDecision(pattern, AGENT_ID);
      if (meta) {
        session.pendingDecision = meta;
        session.awaitingMeta = true;
        send(session.ws, "meta-decision", {
          id: meta.id,
          title: meta.title,
          summary: meta.summary,
          proposedAction: meta.proposedAction,
          scope: meta.scope,
          urgency: meta.urgency,
          stakes: meta.stakes,
        });
        send(session.ws, "state", getState(session));
        return; // Wait for user to resolve meta-decision
      }
    }
    // If no patterns, continue
  }

  if (session.stepIndex >= SCENARIO.length) {
    send(session.ws, "complete", getState(session));
    session.running = false;
    return;
  }

  const step = SCENARIO[session.stepIndex];
  await delay(step.delayMs);
  if (!session.running) return;

  const decision = session.pact.surface({
    agentId: AGENT_ID,
    title: step.title,
    summary: step.summary,
    proposedAction: step.proposedAction,
    scope: step.scope,
    stakes: step.stakes,
    confidence: step.confidence,
    isMeta: step.isMeta,
  });

  session.stepIndex++;

  if (decision.status === "approved") {
    // Auto-approved — check if by rule
    const isRuleApproved = decision.resolutionNote === "Auto-approved by rule";
    send(session.ws, "auto-approved", {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      stakes: decision.stakes,
      urgency: decision.urgency,
      scope: decision.scope,
      note: decision.resolutionNote,
      byRule: isRuleApproved,
    });
    send(session.ws, "state", getState(session));

    if (isRuleApproved && !session.ruleFired) {
      session.ruleFired = true;
      send(session.ws, "rule-applied", {
        title: decision.title,
        note: decision.resolutionNote,
      });
    }

    runNextStep(session);
  } else {
    // Pending — wait for user
    session.pendingDecision = decision;
    send(session.ws, "decision", {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      proposedAction: decision.proposedAction,
      stakes: decision.stakes,
      urgency: decision.urgency,
      confidence: decision.confidence,
      scope: decision.scope,
    });
    send(session.ws, "state", getState(session));
  }
}

function handleResolve(session: Session, action: "approved" | "rejected" | "edited", note?: string) {
  if (!session.pendingDecision) return;

  const decision = session.pact.resolve({
    decisionId: session.pendingDecision.id,
    action,
    note,
  });

  // If this was a meta-decision, create a rule
  if (session.awaitingMeta && action === "approved") {
    const rule = session.pact.createRuleFromMetaDecision(decision.id);
    if (rule) {
      send(session.ws, "rule-created", {
        id: rule.id,
        scope: rule.scope,
        type: rule.type,
      });
    }
    session.awaitingMeta = false;
  }

  send(session.ws, "resolved", {
    id: decision.id,
    action,
    title: decision.title,
    note,
  });
  send(session.ws, "state", getState(session));

  session.pendingDecision = null;

  // Continue scenario
  setTimeout(() => runNextStep(session), 1000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Server ──

const indexHtml = readFileSync(join(import.meta.dir, "public", "index.html"), "utf-8");

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response(indexHtml, {
      headers: { "Content-Type": "text/html" },
    });
  },
  websocket: {
    open(ws) {
      const session = createSession(ws);
      sessions.set(ws, session);
      send(ws, "state", getState(session));
    },
    message(ws, message) {
      const session = sessions.get(ws);
      if (!session) return;

      try {
        const data = JSON.parse(message as string);

        switch (data.type) {
          case "start":
            if (!session.running) {
              session.running = true;
              runNextStep(session);
            }
            break;
          case "resolve":
            handleResolve(session, data.action, data.note);
            break;
          case "reset":
            const newSession = createSession(ws);
            sessions.set(ws, newSession);
            send(ws, "state", getState(newSession));
            break;
        }
      } catch (e) {
        console.error("Bad message:", e);
      }
    },
    close(ws) {
      sessions.delete(ws);
    },
  },
});

console.log(`🚀 PACT Demo running at http://localhost:${PORT}`);
