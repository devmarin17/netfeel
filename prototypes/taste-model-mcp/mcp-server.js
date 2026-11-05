#!/usr/bin/env node
// The member's taste model as a local connector (MCP, stdio) for Claude Desktop.
// No dependencies. Claude Desktop starts this file; it speaks JSON-RPC over stdin/stdout.
// Never print to stdout except protocol messages (logs go to stderr).
"use strict";

const model = require("./lib/model");

const SERVER = { name: "netfeel-taste-model", version: "0.2.0" };
const RECEIPT_VALID_H = 6; // a watch receipt counts as evidence for log_evening for 6 hours
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "This is the user's personal taste model from Netflix 2046 (a concept prototype). The user owns it. " +
  "When the user asks what to watch, or how to feel a certain way tonight, call recommend_for_feeling. " +
  "Answer with ONE pick first, then the reasons the model gives (keep them, they come from the user's body data), " +
  "then the two alternatives in one line, mention the 'new for you' title if there is one, " +
  "and always state that no publisher paid for placement, with the audit id. " +
  "If the user mentions mountain biking, MTB, downhill, Hardline or cycling, put their own words in `note`: the model has an off-script answer for that (an Easter egg: a POV video of a Red Bull Hardline winning run). " +
  "Present it like any other pick, keep the model's reasons, and enjoy the joke. " +
  "Keep the answer short. The viewing history is simulated; live heart-rate reads from the watch are real.";

const TOOLS = [
  {
    name: "recommend_for_feeling",
    description:
      "Ask the user's taste model (Netflix 2046) for ONE thing to watch that will get their body to a feeling by a time. " +
      "Ranked only by what their body confirmed on past evenings; publishers can never pay for placement. " +
      "Automatically uses the live heart rate from their watch (compared with their measured resting heart rate) " +
      "when the stage page is streaming it. Returns a pick, two alternatives, an optional 'new for you' title, and reasons.",
    inputSchema: {
      type: "object",
      properties: {
        feeling: { type: "string", enum: model.FEELINGS, description: "The state to reach: calm, dread, hype or tears." },
        done_by: { type: "string", description: 'When to be done, 24h clock, e.g. "23:00".' },
        note: { type: "string", description: "Optional context in the user's words, e.g. 'work tomorrow'. Always pass the user's own words about bikes here (mountain bike, downhill, Hardline)." },
      },
      required: ["feeling", "done_by"],
    },
  },
  {
    name: "open_taste_model",
    description:
      "Open the user's taste model (the vault): what it learned from their body, hit rates per feeling, what it leaves out, " +
      "their resting heart rate, who owns it, and the verified audit chain proving no placement was ever paid for.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "log_evening",
    description:
      "Close the loop: tell the model how an evening went (did the body reach the feeling?). It learns and returns exactly which numbers changed. " +
      "If the stage page made a watch receipt for this title in the last hours, the heart's verdict is used instead of the reported one.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title watched, exactly as in the catalogue, e.g. 'Our Planet'." },
        feeling: { type: "string", enum: model.FEELINGS },
        reached: { type: "boolean", description: "Did the body reach the feeling before the deadline (as the user reports it)?" },
      },
      required: ["title", "feeling", "reached"],
    },
  },
  {
    name: "audit_log",
    description: "Show the latest picks with their audit ids and inputs, and verify the hash chain (any edit to a past entry is detected).",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "How many entries (default 5)." } } },
  },
];

// Prefer the body's verdict over what is reported, when there is a recent watch receipt for this title.
function logEvening(args) {
  args = { ...args, feeling: String(args.feeling || "").toLowerCase().trim() };
  const catalog = model.loadCatalog();
  const t = catalog.find((x) => x.title.toLowerCase() === String(args.title || "").toLowerCase());
  const rc = model.loadStage().last_receipt;
  const fresh = rc && t && rc.title_id === t.id && rc.feeling === args.feeling && rc.verdict && rc.verdict.judged &&
    Date.now() - new Date(rc.at).getTime() < RECEIPT_VALID_H * 3600000;
  if (!fresh) return model.logEvening({ title: args.title, feeling: args.feeling, reached: args.reached, source: "Claude Desktop", evidence: "self-reported" });
  const out = model.logEvening({
    title_id: t.id,
    feeling: args.feeling,
    reached: rc.verdict.reached,
    start: rc.stats && model.stressWeight(rc.stats.start - model.loadModel().member.resting_hr) >= 0.5 ? "hot" : "normal",
    source: "Claude Desktop",
    evidence: rc.real ? "watch receipt" : "SIMULATED heart receipt",
  });
  // A receipt is used once: logging the same evening twice must not teach the model twice.
  model.withLock(() => {
    const st = model.loadStage();
    st.last_receipt = null;
    model.saveStage(st);
  });
  out.note =
    rc.verdict.reached === !!args.reached
      ? "Matches the watch receipt."
      : `The watch receipt disagrees with what was reported (heart says ${rc.verdict.reached ? "reached" : "not reached"}); the model learned from the heart.`;
  return out;
}

function callTool(name, args) {
  args = args || {};
  switch (name) {
    case "recommend_for_feeling":
      return model.recommend({ feeling: args.feeling, done_by: args.done_by, note: args.note || "" });
    case "open_taste_model":
      return model.summary();
    case "log_evening":
      return logEvening(args);
    case "audit_log": {
      const m = model.loadModel();
      const n = Math.max(1, Math.min(20, Number(args.limit) || 5));
      return { chain: model.verifyAudit(m), entries: m.audit.slice(-n), paid_placements_ever: m.audit.filter((a) => a.paid_placement !== "none").length };
    }
    default:
      throw Object.assign(new Error("Unknown tool: " + name), { code: -32602 });
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    if (method === "initialize") {
      const asked = params && params.protocolVersion;
      return send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: INSTRUCTIONS,
        },
      });
    }
    if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
    if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    if (method === "tools/call") {
      try {
        const out = callTool(params.name, params.arguments);
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
      } catch (e) {
        if (e.code === -32602) throw e;
        return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: "Error: " + e.message }] } });
      }
    }
    if (method && method.startsWith("notifications/")) return; // e.g. notifications/initialized
    if (isRequest) send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } });
  } catch (e) {
    if (isRequest) send({ jsonrpc: "2.0", id, error: { code: e.code || -32603, message: e.message } });
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    if (Array.isArray(msg)) msg.forEach(handle);
    else handle(msg);
  }
});
// Let pending output flush before exiting (process.exit(0) could cut a response off).
process.stdin.on("end", () => { process.exitCode = 0; setTimeout(() => process.exit(0), 50); });
process.stderr.write("[taste-model] connector ready\n");
