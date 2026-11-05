// npm run check — tests the model and the Claude Desktop connector, then prints the config to paste.
"use strict";
const { spawn } = require("child_process");
const path = require("path");
const { build } = require("./seed");
const model = require("../lib/model");

function fail(msg) { console.error("✗ " + msg); process.exit(1); }

const fs = require("fs");
// Don't let the self-test wipe a resting heart rate you measured, or your current stage state.
const backup = { model: fs.existsSync(model.FILES.model) && fs.readFileSync(model.FILES.model, "utf8"), stage: fs.existsSync(model.FILES.stage) && fs.readFileSync(model.FILES.stage, "utf8") };
function restore() {
  if (backup.model) fs.writeFileSync(model.FILES.model, backup.model);
  else build();
  if (backup.stage) fs.writeFileSync(model.FILES.stage, backup.stage);
}
function failAndRestore(msg) { restore(); fail(msg); }
function setLive(delta) {
  const st = model.loadStage();
  st.live = delta == null ? null : { bpm: model.loadModel().member.resting_hr + delta, at: new Date().toISOString(), kind: "fed", real: true, source: "check" };
  model.saveStage(st);
}

build();
setLive(null);
const r = model.recommend({ feeling: "calm", done_by: "23:00", log: false });
if (!r.pick || !r.pick.title) failAndRestore("model gave no pick");
console.log(`✓ Model works: calm by 23:00 → ${r.pick.title} (${r.pick.state_match}%)${r.explore ? `, new for you: ${r.explore.title}` : ""}`);

setLive(20);
const hot = model.recommend({ feeling: "calm", done_by: "23:00", log: false });
if (hot.pick.id === r.pick.id) failAndRestore(`stressed heart (+20) should change the pick, still ${hot.pick.title}`);
console.log(`✓ Heart works: +20 bpm over resting → ${hot.pick.title} (stress weight ${Math.round(hot.live_read.stress_weight * 100)}%)`);
setLive(null);

model.setResting({ bpm: 55 });
build();
if (model.loadModel().member.resting_hr !== 55) failAndRestore("reset should keep a measured resting heart rate");
console.log("✓ Reset keeps your measured resting heart rate");

model.recommend({ feeling: "calm", done_by: "23:00" });
model.recommend({ feeling: "hype", done_by: "23:00" });
let m = model.loadModel();
if (!model.verifyAudit(m).ok) failAndRestore("audit chain should verify");
m.audit[0].paid_placement = "Publisher X";
if (model.verifyAudit(m).ok) failAndRestore("audit chain should detect an edited entry");
console.log("✓ Audit chain verifies, and detects an edited entry");

model.logLiveRead({ bpm: 97, samples: [{ t: Date.now(), bpm: 97 }] });
model.setLive({ bpm: 97 });
model.logSkip();
const del = model.deleteHeartData();
m = model.loadModel();
const st2 = model.loadStage();
const dump = JSON.stringify(m) + JSON.stringify(st2);
if (m.live_reads.length || st2.live || st2.last_receipt || /Live read logged/.test(dump)) failAndRestore("deleteHeartData should remove every raw heart read");
if (!m.changelog.some((c) => /skipped/.test(c.what)) || !m.changelog.some((c) => /Heart data deleted/.test(c.what))) failAndRestore("skip and delete should be written to the change log");
if (!model.verifyAudit(m).ok) failAndRestore("deleting heart data must not break the audit chain");
if (m.audit.some((a) => a.inputs && "live_bpm" in a.inputs)) failAndRestore("the audit log must not hold raw heart rates");
console.log(`✓ Consent works: skip is logged, delete removed ${del.removed} heart items, the audit chain still verifies, and holds no raw bpm`);
restore();

const server = path.join(__dirname, "..", "mcp-server.js");
const p = spawn(process.execPath, [server], { stdio: ["pipe", "pipe", "ignore"] });
let out = "";
p.stdout.on("data", (d) => (out += d));
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }) + "\n");
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
p.stdin.end();
p.on("close", () => {
  const lines = out.trim().split("\n").map((l) => JSON.parse(l));
  const tools = (lines.find((l) => l.id === 2) || {}).result;
  if (!tools || !tools.tools.length) fail("connector did not list its tools");
  console.log(`✓ Connector works: ${tools.tools.map((t) => t.name).join(", ")}`);
  restore(); // leave the model as it was
  console.log("\nPaste this into Claude Desktop → Settings → Developer → Edit Config");
  console.log("(file: ~/Library/Application Support/Claude/claude_desktop_config.json)");
  console.log("If the file already has \"mcpServers\", add only the inner entry.\n");
  console.log(JSON.stringify({ mcpServers: { "netfeel-taste-model": { command: process.execPath, args: [server] } } }, null, 2));
  console.log("\nThen quit Claude Desktop fully (Cmd+Q) and open it again.");
});
