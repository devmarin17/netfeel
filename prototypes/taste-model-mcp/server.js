// Stage server: serves the stage page and a tiny API on http://localhost:4046
// localhost counts as a secure origin, so Chrome allows Web Bluetooth here.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const model = require("./lib/model");
const { build } = require("./scripts/seed");

const PORT = Number(process.env.PORT) || 4046;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 2e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function state() {
  const m = model.loadModel();
  const stage = model.loadStage();
  const sum = model.summary();
  const live = stage.live;
  return {
    summary: sum,
    last_pick: stage.last_pick,
    live: live ? { bpm: live.bpm, at: live.at, source: live.source, kind: live.kind || "fed", real: live.real !== false } : null,
    changelog: m.changelog.slice(-6).reverse(),
    resting_hr: m.member.resting_hr,
    resting: sum.resting,
    calm_state_hit: m.state_hit.calm || { hits: 0, n: 0 },
    state_hit: m.state_hit,
    audit_count: m.audit.length,
    audit_chain: sum.audit_chain,
    algorithm: model.ALGO,
    settings: m.settings,
  };
}

// Did the body move toward the asked feeling while watching?
// Long viewings (>= 5 min) use the model's own calm rule; short clips compare the first and last quarter.
function watchVerdict(samples, feeling) {
  if (samples.length < 15) return { judged: false, reason: "Too few heart-rate samples (watch at least ~15 s)." };
  const ms = samples[samples.length - 1].t - samples[0].t;
  const mean = (a) => a.reduce((s, x) => s + x.bpm, 0) / a.length;
  if (feeling === "calm" && ms >= 300000) {
    const v = model.calmFromTrace(samples);
    return { judged: true, reached: v.reached, rule: "Heart settles ≥ 3 bpm under your first-3-minute baseline, after 5 min.", baseline: v.baseline, end: v.mean || null };
  }
  const q = Math.max(5, Math.floor(samples.length / 4));
  const first = Math.round(mean(samples.slice(0, q)));
  const last = Math.round(mean(samples.slice(-q)));
  const wantDown = feeling === "calm";
  const reached = wantDown ? last <= first - 3 : last >= first + 3;
  return {
    judged: true,
    reached,
    rule: wantDown ? "Short clip: last quarter ≥ 3 bpm under the first quarter." : "Short clip: last quarter ≥ 3 bpm above the first quarter.",
    baseline: first,
    end: last,
  };
}

function receipt(b) {
  const samples = (b.samples || []).filter((s) => s && Number(s.bpm) > 0 && Number(s.t) > 0).sort((x, y) => x.t - y.t);
  const feeling = String(b.feeling || "calm").toLowerCase();
  if (!model.FEELINGS.includes(feeling)) throw new Error("feeling must be one of: " + model.FEELINGS.join(", "));
  const m = model.loadModel();
  const catalog = model.loadCatalog();
  const title = catalog.find((t) => t.id === b.title_id);
  if (!title) throw new Error("Unknown title: " + b.title_id);
  const verdict = watchVerdict(samples, feeling);
  const bpms = samples.map((s) => s.bpm);
  const stats = bpms.length
    ? {
        start: bpms[0],
        end: bpms[bpms.length - 1],
        min: Math.min(...bpms),
        max: Math.max(...bpms),
        avg: Math.round(bpms.reduce((a, x) => a + x, 0) / bpms.length),
      }
    : null;
  let would_learn = [];
  if (verdict.judged) {
    const start = stats && model.stressWeight(stats.start - m.member.resting_hr) >= 0.5 ? "hot" : "normal";
    // learn() mutates the in-memory copy only; we never call saveModel here.
    would_learn = model.learn(m, catalog, { title_id: title.id, feeling, reached: verdict.reached, start, source: "receipt preview" });
  }
  const out = {
    title_id: title.id,
    title: title.title,
    tags: title.tags,
    feeling,
    resting_hr: m.member.resting_hr,
    watched_ms: samples.length ? samples[samples.length - 1].t - samples[0].t : 0,
    samples: samples.length,
    stats,
    verdict,
    would_learn,
    written: false,
    at: new Date().toISOString(),
  };
  // Kept on the stage file (not the model) so Claude's log_evening can use your heart's verdict.
  model.withLock(() => {
    const st = model.loadStage();
    st.last_receipt = { title_id: out.title_id, title: out.title, feeling, at: out.at, verdict, stats, real: !!b.real };
    model.saveStage(st);
  });
  return out;
}

const routes = {
  "GET /api/state": async () => state(),
  "GET /api/catalog": async () => ({ titles: model.loadCatalog() }),
  // Streamed automatically while the watch is connected (stage file only).
  "POST /api/live": async (b) => model.setLive({ bpm: b.bpm, source: b.source, real: b.real !== false, n: b.n || 0 }),
  "POST /api/resting": async (b) => model.setResting({ bpm: b.bpm, how: "measured", seconds: b.seconds, samples: b.samples }),
  "POST /api/settings": async (b) => model.setSettings({ demo_clock: b.demo_clock }),
  "POST /api/live-read": async (b) => model.logLiveRead({ bpm: b.bpm, samples: b.samples || [], source: b.source || undefined, real: b.real !== false }),
  "POST /api/recommend": async (b) => model.recommend({ feeling: b.feeling || "calm", done_by: b.done_by || "23:00", note: b.note || "" }),
  "POST /api/log-evening": async (b) => model.logEvening({ title_id: b.title_id, feeling: b.feeling || "calm", reached: !!b.reached, source: b.source || "stage page" }),
  "POST /api/evening": async (b) => {
    // Real evening (for testing later): judge calm from the heart-rate trace, then learn.
    const verdict = model.calmFromTrace(b.samples || []);
    const logged = model.logEvening({
      title_id: b.title_id,
      feeling: "calm",
      reached: verdict.reached,
      start: b.start_bpm && model.stressWeight(b.start_bpm - model.loadModel().member.resting_hr) >= 0.5 ? "hot" : "normal",
      evidence: "heart-rate trace",
      source: "real evening, heart-rate trace",
    });
    return { verdict, logged };
  },
  // Watch receipt: judge the heart trace of one viewing and preview what the model WOULD learn.
  // Read-only: the model file is never written here.
  "POST /api/receipt": async (b) => receipt(b),
  // Consent: the member skipped sharing a read. Ownership: the member deletes tonight's heart data.
  "POST /api/skip": async () => model.logSkip(),
  "POST /api/delete-heart": async () => model.deleteHeartData(),
  // Back to the live-heart screen without touching the model.
  "POST /api/clear-pick": async () =>
    model.withLock(() => {
      const stage = model.loadStage();
      stage.last_pick = null;
      model.saveStage(stage);
      return { ok: true };
    }),
  "POST /api/reset": async () => {
    model.withLock(() => build());
    return { ok: true };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const key = req.method + " " + url.pathname;
  if (routes[key]) {
    try {
      const b = req.method === "POST" ? await body(req) : {};
      return json(res, 200, await routes[key](b));
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method !== "GET") return json(res, 404, { error: "not found" });
  const file = path.join(PUBLIC, url.pathname === "/" ? "index.html" : path.normalize(url.pathname));
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: "forbidden" });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: "not found" });
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use: the stage server is probably already running. Open http://localhost:${PORT}`);
  else console.error(e.message);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Stage page: http://localhost:${PORT}   (open in Chrome)`);
  console.log("Taste model file: data/taste-model.json  ·  reset with: npm run reset");
});
