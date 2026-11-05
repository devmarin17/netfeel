// NetFeel 2046 concept prototype — the member-owned taste model, fed by a
// wearable heart-rate stream. The algorithm asks; the body answers.
// One small, readable model. No black box: every number can be explained.
//
// The taste model is a file the member owns: data/taste-model.json.
// For every tag (e.g. "ambient-sound") and every feeling (calm, dread, hype, tears)
// it counts: on how many evenings did the body confirm the asked feeling (hits) out of n.
//
// How a pick is made (see recommend()):
//   1. Stress weight: your live heart rate vs YOUR resting heart rate (measured with your watch)
//      → 0–100%. The higher it is, the more "what worked on stressed evenings" counts.
//   2. Filters: must end before your deadline; tags you're confidently bad with are left out.
//   3. Score: tag evidence (hit rate × confidence), blended with the title's own history.
//   4. One pick + two alternatives + one "new for you" slot, so the model keeps learning.
//   5. Every pick goes into a hash-chained audit log: edits to past entries are detectable.

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA = path.join(__dirname, "..", "data");
const FILES = {
  catalog: path.join(DATA, "catalog.json"),
  model: path.join(DATA, "taste-model.json"),
  stage: path.join(DATA, "stage.json"),
  lock: path.join(DATA, ".lock"),
};

const FEELINGS = ["calm", "dread", "hype", "tears"];

// ---------- the knobs (all in one place; the stage page and diagram read these too) ----------
const ALGO = {
  avoid_upper: 0.4, // leave a tag out when even its optimistic hit rate (mean + 1 sd) is under 40%
  avoid_upper_stressed: 0.5, // stricter on stressed evenings
  stress_start: 4, // bpm over resting where stress weight starts rising from 0%
  stress_full: 20, // bpm over resting where stress weight reaches 100%
  title_k: 3, // a title's own history counts as much as this many evenings of tag evidence
  recent_penalty: 0.03, // small nudge away from the last two titles watched
  live_fresh_stream_min: 2, // a streamed (automatic) heart-rate read counts for 2 minutes
  live_fresh_fed_min: 15, // a read you fed on purpose counts for 15 minutes
};

// ---------- files + a tiny lock (Claude Desktop's connector and the stage server share the files) ----------
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}
function writeJSON(file, obj) {
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function withLock(fn) {
  const t0 = Date.now();
  let fd;
  for (;;) {
    try {
      fd = fs.openSync(FILES.lock, "wx");
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(FILES.lock).mtimeMs > 2000) fs.unlinkSync(FILES.lock); // stale lock (a real hold lasts milliseconds)
      } catch (_) {}
      if (Date.now() - t0 > 3000) throw new Error("The taste model is busy. Try again.");
      pause(15);
    }
  }
  try {
    return fn();
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(FILES.lock);
    } catch (_) {}
  }
}
const loadCatalog = () => readJSON(FILES.catalog).titles;
const loadModel = () => readJSON(FILES.model);
const saveModel = (m) => writeJSON(FILES.model, m);
const loadStage = () => readJSON(FILES.stage, { last_pick: null, live: null, last_receipt: null });
const saveStage = (s) => writeJSON(FILES.stage, s);

// ---------- helpers ----------
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const prettyTag = (tag) => tag.replace(/-/g, " ");
const pct = (x) => Math.round(x * 100) + "%";
function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function checkFeeling(feeling) {
  feeling = String(feeling || "").toLowerCase().trim();
  if (!FEELINGS.includes(feeling)) throw new Error(`feeling must be one of: ${FEELINGS.join(", ")}`);
  return feeling;
}
function fmt(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}
function nowMin(model, override) {
  if (override && toMin(override) != null) return toMin(override);
  if (model.settings && model.settings.demo_clock) return toMin(model.settings.demo_clock);
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ---------- learning ----------
function emptyEffects() {
  return {};
}
function bump(effects, tag, feeling, hit) {
  effects[tag] = effects[tag] || {};
  const e = (effects[tag][feeling] = effects[tag][feeling] || { hits: 0, n: 0 });
  e.n += 1;
  if (hit) e.hits += 1;
}
// Hit rate with a 50% prior worth 2 evenings, its uncertainty (1 sd), and a confidence weight.
function stat(effects, tag, feeling) {
  const e = (effects[tag] && effects[tag][feeling]) || { hits: 0, n: 0 };
  const p = (e.hits + 1) / (e.n + 2);
  const sd = Math.sqrt((p * (1 - p)) / (e.n + 3));
  return { hits: e.hits, n: e.n, p, sd, upper: p + sd, conf: e.n / (e.n + 3) };
}
// The title's own record for a feeling (optionally only evenings that started stressed).
function titleStat(model, titleId, feeling, stressedOnly) {
  const s = model.sessions.filter((x) => x.title_id === titleId && x.feeling === feeling && (!stressedOnly || x.start === "hot"));
  const hits = s.filter((x) => x.reached).length;
  return { hits, n: s.length, p: (hits + 1) / (s.length + 2) };
}

// Apply one evening to the model. Returns human-readable change lines.
function learn(model, catalog, evening) {
  const title = catalog.find((t) => t.id === evening.title_id);
  if (!title) throw new Error("Unknown title: " + evening.title_id);
  const before = {};
  for (const tag of title.tags) before[tag] = stat(model.effects, tag, evening.feeling).p;
  for (const tag of title.tags) {
    bump(model.effects, tag, evening.feeling, evening.reached);
    // Evenings that started stressed are also learned separately ("calm@hot").
    if (evening.start === "hot") bump(model.effects, tag, evening.feeling + "@hot", evening.reached);
  }
  model.state_hit[evening.feeling] = model.state_hit[evening.feeling] || { hits: 0, n: 0 };
  model.state_hit[evening.feeling].n += 1;
  if (evening.reached) model.state_hit[evening.feeling].hits += 1;
  model.sessions.push(evening);
  return title.tags
    .map((tag) => {
      const after = stat(model.effects, tag, evening.feeling).p;
      return { tag, d: Math.round((after - before[tag]) * 100), after };
    })
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .map((x) => `${x.tag} → ${evening.feeling}: ${x.d > 0 ? "+" : ""}${x.d}% (now ${Math.round(x.after * 100)}%)`);
}

// ---------- heart ----------
// 0 at <= stress_start bpm over resting, 1 at >= stress_full. A smooth ramp, not a cliff.
function stressWeight(delta) {
  return clamp01((delta - ALGO.stress_start) / (ALGO.stress_full - ALGO.stress_start));
}
function liveState(model, stage) {
  const live = stage && stage.live;
  if (!live || !live.bpm) return null;
  const ageMin = (Date.now() - new Date(live.at).getTime()) / 60000;
  const fresh = live.kind === "stream" ? ALGO.live_fresh_stream_min : ALGO.live_fresh_fed_min;
  if (!(ageMin <= fresh) || ageMin < -1) return null; // stale, unreadable or from the future
  const resting = model.member.resting_hr;
  const delta = live.bpm - resting;
  const weight = stressWeight(delta);
  return { bpm: live.bpm, at: live.at, source: live.source, real: live.real !== false, kind: live.kind || "fed", resting, delta, weight };
}

// ---------- scoring ----------
function scoreTitle(model, title, feeling, w) {
  let sum = 0;
  let wsum = 0;
  const parts = [];
  for (const tag of title.tags) {
    const s = stat(model.effects, tag, feeling);
    if (s.n > 0) {
      sum += (s.p - 0.5) * s.conf * (1 - w * 0.5);
      wsum += s.conf * (1 - w * 0.5);
      parts.push({ tag, ...s });
    }
    // Stressed now: what worked on evenings that STARTED stressed counts up to double.
    if (w > 0) {
      const h = stat(model.effects, tag, feeling + "@hot");
      if (h.n > 0) {
        sum += (h.p - 0.5) * h.conf * 2 * w;
        wsum += h.conf * 2 * w;
        parts.push({ tag, ...h, hot: true });
      }
    }
  }
  const tagScore = wsum ? 0.5 + sum / wsum : 0.5;
  // Blend in the title's own record. This fixes "every tag gets the credit": if this exact title
  // worked (or failed) for you, that counts directly, not only through its tags.
  // The title's record starts from what its tags predict (not from 50%), so one good evening
  // with a title can't rank it below titles you never watched for this feeling.
  const all = titleStat(model, title.id, feeling, false);
  const hot = titleStat(model, title.id, feeling, true);
  // Stressed now → the title's ordinary evenings count less, its stressed evenings count up to double.
  const nA = all.n * (1 - w);
  const nH = hot.n * 2 * w;
  const score = (all.hits * (1 - w) + hot.hits * 2 * w + ALGO.title_k * tagScore) / (nA + nH + ALGO.title_k);
  return { score, tagScore, parts, history: { ...all, stressed: hot } };
}

function modelFingerprint(model) {
  return sha(JSON.stringify({ e: model.effects, s: model.sessions, r: model.member.resting_hr })).slice(0, 12);
}

// ---------- the Easter egg ----------
// Mention bikes in the note ("mountain bike race", "downhill", "Hardline") and the model goes off-script on purpose:
// Daan's diary has no bikes in it. Egg titles (catalog: easter_egg) never take part in a normal ranking.
const EGG_RE = /\b(mtb|mountain[\s-]?bik\w*|down[\s-]?hill|hard[\s-]?line|goldstone|bik(?:e|es|ing)|cycl\w+)\b/i;
const EGG_IDS = ["hardline-goldstone", "hardline-vermette", "hardline-2022"];

// The core call: what should this member watch to reach `feeling` by `done_by`?
function recommend({ feeling = "calm", done_by = "23:00", now, note = "", log = true } = {}) {
  feeling = checkFeeling(feeling);
  const run = () => {
    const model = loadModel();
    const catalog = loadCatalog();
    const stage = loadStage();
    const live = liveState(model, stage);
    const w = live ? live.weight : 0;
    const stressed = w >= 0.5;
    const finish = (audit, result) => {
      if (log) {
        appendAudit(model, audit);
        saveModel(model);
        stage.last_pick = { ...result, at: audit.at };
        saveStage(stage);
      }
      return result;
    };
    const liveRead = live ? { bpm: live.bpm, resting: live.resting, delta: live.delta, stress_weight: Math.round(w * 100) / 100, source: live.source, real: live.real } : null;

    const start = nowMin(model, now);
    let end = toMin(done_by);
    if (end == null) throw new Error('done_by must be a time like "23:00"');
    // Earlier than now: past midnight (e.g. "00:30") is fine, a time that already passed tonight is not.
    if (end <= start) {
      if (start - end < 6 * 60) throw new Error(`done_by ${done_by} has already passed (it's ${fmt(start)} now). Pick a later time.`);
      end += 1440;
    }
    const available = end - start - (model.settings.buffer_min || 10);

    // Off-script: the note asked for bikes.
    const eggWord = (String(note || "").match(EGG_RE) || [])[0];
    const eggTitles = eggWord ? EGG_IDS.map((id) => catalog.find((t) => t.id === id)).filter(Boolean) : [];
    if (eggTitles.length) {
      const [pick, ...alts] = eggTitles;
      const sign = live && live.delta >= 0 ? "+" : "";
      const why = [
        `Easter egg: you said "${eggWord}". Daan's diary has no bikes in it, so the model went off-script on purpose.`,
        "Red Bull Hardline is billed as the hardest race in mountain biking. This is the winning run, from the rider's own helmet.",
        "This one is meant to push your heart UP, not down. Keep the watch on and see what it does.",
        `${pick.runtime} min \u2192 ends around ${fmt(start + pick.runtime)}, before your ${done_by}.`,
      ];
      if (live)
        why.push(
          `${live.real ? "Live read" : "Simulated read (not a real heart)"}: ${live.bpm} bpm, ${sign}${live.delta} vs your resting ${live.resting}` +
            (w >= 0.5 ? ": already running hot. This will not help you sleep, and that is the point." : ": a calm place to spike from.")
        );
      why.push("Red Bull did not pay for this slot. Their video, the model's ranking. It is just a very good video.");
      const audit = {
        id: "A" + String(model.audit.length + 1).padStart(4, "0"),
        at: new Date().toISOString(),
        asked: { feeling, done_by, note },
        pick: pick.id,
        alternatives: alts.map((t) => t.id),
        explore: null,
        easter_egg: true,
        inputs: { clock: fmt(start), resting_hr: model.member.resting_hr, stress_weight: Math.round(w * 100) / 100, model_fingerprint: modelFingerprint(model) },
        paid_placement: "none",
        ranked_by: "off-script: the note asked for bikes (member's own taste model not used)",
      };
      return finish(audit, {
        member: model.member.name,
        owner: model.member.owner,
        asked: { feeling, done_by, clock_now: fmt(start), note },
        easter_egg: true,
        pick: { id: pick.id, title: pick.title, kind: pick.kind, runtime_min: pick.runtime, state_match: 100, youtube_id: pick.youtube_id || "" },
        why,
        alternatives: alts.map((t) => ({ id: t.id, title: t.title, runtime_min: t.runtime, state_match: 100 })),
        explore: null,
        left_out: [],
        left_out_count: 0,
        paid_placement: "none \u2014 no publisher can buy rank in this model",
        audit_id: audit.id,
        live_read: liveRead,
        resting: { bpm: model.member.resting_hr, how: (model.member.resting_source || {}).how || "default" },
      });
    }

    // Leave out tags only when we're confident they don't work (optimistic estimate still low).
    const avoid = Object.keys(model.effects)
      .map((tag) => ({ tag, ...stat(model.effects, tag, feeling) }))
      .filter((s) => s.n >= 2 && s.upper < ALGO.avoid_upper);
    if (stressed)
      for (const tag of Object.keys(model.effects)) {
        const h = stat(model.effects, tag, feeling + "@hot");
        if (h.n >= 2 && h.upper < ALGO.avoid_upper_stressed && !avoid.find((a) => a.tag === tag)) avoid.push({ tag, ...h, hot: true });
      }

    const recent = model.sessions.slice(-2).map((s) => s.title_id);
    const ranked = [];
    const excluded = [];
    for (const t of catalog) {
      if (t.easter_egg) continue; // only ever shown by the off-script branch above
      if (t.runtime > available) {
        excluded.push({ title: t.title, why: `${t.runtime} min doesn't fit before ${done_by}` });
        continue;
      }
      const bad = avoid.filter((a) => t.tags.includes(a.tag));
      if (bad.length) {
        excluded.push({ title: t.title, why: `has ${bad.map((b) => prettyTag(b.tag)).join(", ")}` });
        continue;
      }
      const r = scoreTitle(model, t, feeling, w);
      ranked.push({ t, ...r, score: recent.includes(t.id) ? r.score - ALGO.recent_penalty : r.score });
    }
    ranked.sort((a, b) => b.score - a.score);
    if (!ranked.length) throw new Error("Nothing fits. Try a later done_by time.");

    const top = ranked[0];
    const alts = ranked.slice(1, 3);
    // "New for you": the best title you've never watched for this feeling, outside the top 3,
    // whose tags already point the right way. Not when you're stressed: no experiments then.
    // Real evidence only: at least two of its tags each confirmed on 2+ evenings for this feeling.
    const evidenced = (r) => r.parts.filter((p) => !p.hot && p.n >= 2 && p.p > 0.5).length >= 2;
    const explore = stressed ? null : ranked.slice(3).find((r) => r.history.n === 0 && r.tagScore > 0.55 && evidenced(r)) || null;

    const why = [];
    const hist = stressed && top.history.stressed.n ? top.history.stressed : top.history;
    if (hist.n)
      why.push(
        stressed && hist === top.history.stressed
          ? `You've watched it ${hist.n}× when you started stressed: your body reached ${feeling} ${hist.hits} of ${hist.n} times.`
          : `You've watched it ${hist.n}× for ${feeling}: your body got there ${hist.hits} of ${hist.n} times.`
      );
    const strong = top.parts
      .filter((p) => p.n >= 2 && p.p > 0.55 && (stressed ? p.hot : !p.hot))
      .sort((a, b) => b.p * b.conf - a.p * a.conf)
      .slice(0, 2);
    for (const p of strong)
      why.push(
        p.hot
          ? `${cap(prettyTag(p.tag))}: on evenings you started stressed, you reached ${feeling} ${p.hits} of ${p.n} times with it.`
          : `${cap(prettyTag(p.tag))}: your body reached ${feeling} on ${p.hits} of ${p.n} evenings with it.`
      );
    why.push(`${top.t.runtime} min → ends around ${fmt(start + top.t.runtime)}, before your ${done_by}.`);
    const avoidShown = stressed ? avoid.filter((a) => a.hot).concat(avoid.filter((a) => !a.hot)) : avoid.slice().sort((x, y) => y.n - x.n);
    for (const a of avoidShown.slice(0, 2))
      why.push(
        a.hot
          ? `Left out ${prettyTag(a.tag)}: on stressed evenings, ${feeling} reached only ${a.hits} of ${a.n} times with it.`
          : `Left out ${prettyTag(a.tag)}: ${feeling} reached on only ${a.hits} of ${a.n} evenings with it.`
      );
    if (live)
      why.push(
        `${live.real ? "Live read" : "Simulated read (not a real heart)"}: ${live.bpm} bpm, ${live.delta >= 0 ? "+" : ""}${live.delta} vs your resting ${live.resting} → stress weight ${pct(w)}` +
          (w >= 0.5 ? ": what worked on stressed evenings counts more." : w > 0 ? ": a little extra weight on stressed evenings." : ": plan as usual.")
      );

    const audit = {
      id: "A" + String(model.audit.length + 1).padStart(4, "0"),
      at: new Date().toISOString(),
      asked: { feeling, done_by, note },
      pick: top.t.id,
      alternatives: alts.map((r) => r.t.id),
      explore: explore ? explore.t.id : null,
      inputs: {
        clock: fmt(start),
        resting_hr: model.member.resting_hr,
        stress_weight: Math.round(w * 100) / 100,
        model_fingerprint: modelFingerprint(model),
      },
      paid_placement: "none",
      ranked_by: "member's own taste model only",
    };

    const result = {
      member: model.member.name,
      owner: model.member.owner,
      asked: { feeling, done_by, clock_now: fmt(start), note },
      pick: {
        id: top.t.id,
        title: top.t.title,
        kind: top.t.kind,
        runtime_min: top.t.runtime,
        state_match: Math.round(top.score * 100),
        youtube_id: top.t.youtube_id || "",
      },
      why,
      alternatives: alts.map((r) => ({ id: r.t.id, title: r.t.title, runtime_min: r.t.runtime, state_match: Math.round(r.score * 100) })),
      explore: explore
        ? {
            id: explore.t.id,
            title: explore.t.title,
            runtime_min: explore.t.runtime,
            state_match: Math.round(explore.score * 100),
            why: `New for you: never watched for ${feeling}, but its tags (${explore.t.tags.map(prettyTag).slice(0, 3).join(", ")}) suggest ${Math.round(explore.score * 100)}%. Trying it teaches the model.`,
          }
        : null,
      left_out: excluded.slice(0, 4),
      left_out_count: excluded.length,
      paid_placement: "none — no publisher can buy rank in this model",
      audit_id: audit.id,
      live_read: liveRead,
      resting: { bpm: model.member.resting_hr, how: (model.member.resting_source || {}).how || "default" },
    };
    return finish(audit, result);
  };
  return log ? withLock(run) : run();
}

// ---------- audit chain ----------
// Each entry carries the hash of the one before it. Editing or deleting a past entry breaks the chain.
function appendAudit(model, entry) {
  const prev = model.audit.length ? model.audit[model.audit.length - 1].hash || "legacy" : "genesis";
  const body = { ...entry, prev };
  body.hash = sha(JSON.stringify(body)).slice(0, 16);
  model.audit.push(body);
}
function verifyAudit(model) {
  let prev = "genesis";
  for (const a of model.audit) {
    const { hash, ...rest } = a;
    if (rest.prev !== prev || sha(JSON.stringify(rest)).slice(0, 16) !== hash) return { ok: false, n: model.audit.length, broken_at: a.id };
    prev = hash;
  }
  return { ok: true, n: model.audit.length, head: prev };
}

// ---------- the vault ----------
function summary() {
  const model = loadModel();
  const chain = verifyAudit(model);
  const out = {
    member: model.member,
    simulated: model.simulated,
    evenings_learned_from: model.sessions.length,
    state_hit: Object.fromEntries(Object.entries(model.state_hit).map(([f, s]) => [f, `${s.hits} of ${s.n} evenings`])),
    state_hit_counts: model.state_hit,
    strongest_effects: {},
    avoids: {},
    ownership: model.ownership,
    audit_entries: model.audit.length,
    audit_chain: chain,
    paid_placements_ever: model.audit.filter((a) => a.paid_placement !== "none").length,
    resting: { bpm: model.member.resting_hr, ...(model.member.resting_source || { how: "default" }) },
    settings: model.settings,
    algorithm: ALGO,
  };
  for (const f of FEELINGS) {
    const rows = Object.keys(model.effects)
      .map((tag) => ({ tag, ...stat(model.effects, tag, f) }))
      .filter((s) => s.n >= 1);
    if (!rows.length) continue;
    out.strongest_effects[f] = rows
      .filter((s) => s.n >= 2 && s.p > 0.55)
      .sort((a, b) => b.p * b.conf - a.p * a.conf)
      .slice(0, 4)
      .map((s) => `${prettyTag(s.tag)}: ${s.hits}/${s.n}`);
    const av = rows.filter((s) => s.n >= 2 && s.upper < ALGO.avoid_upper).map((s) => `${prettyTag(s.tag)}: ${s.hits}/${s.n}`);
    if (av.length) out.avoids[f] = av;
  }
  out.changelog_latest = model.changelog.slice(-3);
  return out;
}

// Log an evening (from the assistant or the stage page) and return what changed.
function logEvening({ title_id, title, feeling = "calm", reached, minutes_to_state = null, start = "normal", source = "assistant", evidence = "self-reported" }) {
  feeling = checkFeeling(feeling);
  if (typeof reached !== "boolean") throw new Error("reached must be true or false.");
  return withLock(() => {
    const model = loadModel();
    const catalog = loadCatalog();
    if (!title_id && title) {
      const hit = catalog.find((t) => t.title.toLowerCase() === String(title).toLowerCase());
      if (!hit) throw new Error("Unknown title: " + title);
      title_id = hit.id;
    }
    const evening = { date: new Date().toISOString().slice(0, 10), title_id, feeling, reached: !!reached, minutes_to_state, start, source, evidence };
    const lines = learn(model, catalog, evening);
    const entry = {
      at: new Date().toISOString(),
      what: `Evening logged: ${catalog.find((t) => t.id === title_id).title}, asked ${feeling}, ${evening.reached ? "reached ✓" : "not reached ✗"} (${source}, ${evidence})`,
      changes: lines,
    };
    model.changelog.push(entry);
    saveModel(model);
    return { ...entry, state_hit: model.state_hit[feeling] };
  });
}

// Streamed heart rate from the watch (automatic, every few seconds). Stage file only: not a model change.
function setLive({ bpm, source = "watch", real = true, n = 0 }) {
  bpm = Math.round(Number(bpm));
  if (!bpm || bpm < 30 || bpm > 230) throw new Error("bpm out of range");
  return withLock(() => {
    const stage = loadStage();
    stage.live = { bpm, at: new Date().toISOString(), source, real: !!real, kind: "stream", n };
    saveStage(stage);
    const m = loadModel();
    const delta = bpm - m.member.resting_hr;
    return { bpm, delta, stress_weight: stressWeight(delta) };
  });
}

// Consent: the member looked at a heart read and said Skip. Nothing was shared; the model only notes that it asked.
function logSkip() {
  return withLock(() => {
    const model = loadModel();
    const entry = { at: new Date().toISOString(), kind: "consent", what: "Heart read skipped by you: nothing was shared.", changes: [] };
    model.changelog.push(entry);
    saveModel(model);
    return entry;
  });
}

// Ownership: delete tonight's heart data. Every raw heart rate goes: the logged reads, the stage's live trace,
// the watch receipt, the "Live read" lines in the change log and on the last pick. The audit log never held raw bpm.
function deleteHeartData() {
  return withLock(() => {
    const model = loadModel();
    const stage = loadStage();
    const removed = model.live_reads.length + (stage.live ? 1 : 0) + (stage.last_receipt ? 1 : 0);
    model.live_reads = [];
    model.changelog = model.changelog.filter((c) => c.kind !== "live_read");
    stage.live = null;
    stage.last_receipt = null;
    if (stage.last_pick) {
      stage.last_pick.live_read = null;
      stage.last_pick.why = (stage.last_pick.why || []).filter((w) => !/^(Live|Simulated) read/.test(w));
    }
    model.changelog.push({
      at: new Date().toISOString(),
      kind: "consent",
      what: `Heart data deleted by you: ${removed} item${removed === 1 ? "" : "s"} removed.`,
      changes: ["Picks and their stress weights stay in the audit log; raw heart rates do not."],
    });
    saveModel(model);
    saveStage(stage);
    return { removed };
  });
}

// A heart-rate read you feed on purpose: logged in the model and valid for 15 minutes.
function logLiveRead({ bpm, samples = [], source = "watch (Bluetooth)", real = true }) {
  bpm = Math.round(Number(bpm));
  if (!bpm || bpm < 30 || bpm > 230) throw new Error("bpm out of range");
  return withLock(() => {
    const model = loadModel();
    const stage = loadStage();
    const at = new Date().toISOString();
    stage.live = { bpm, at, source, real, kind: "fed", samples: samples.slice(-120) };
    saveStage(stage);
    const delta = bpm - model.member.resting_hr;
    const w = stressWeight(delta);
    model.live_reads.push({ at, bpm, source, real });
    const entry = {
      at,
      kind: "live_read",
      what: `Live read logged: ${bpm} bpm (${real ? "real" : "SIMULATED"} · ${source}).`,
      changes: [
        `${delta >= 0 ? "+" : ""}${delta} vs resting ${model.member.resting_hr} → stress weight ${pct(w)} for the next ${ALGO.live_fresh_fed_min} min.`,
      ],
    };
    model.changelog.push(entry);
    saveModel(model);
    return { ...entry, delta, stress_weight: w };
  });
}

// Your resting heart rate, measured with your watch. Everything "stressed" is relative to this.
function setResting({ bpm, how = "measured", seconds = 60, samples = 0 }) {
  bpm = Math.round(Number(bpm));
  if (!bpm || bpm < 35 || bpm > 110) throw new Error("Resting heart rate should be between 35 and 110 bpm.");
  return withLock(() => {
    const model = loadModel();
    const was = model.member.resting_hr;
    model.member.resting_hr = bpm;
    model.member.resting_source = { how, at: new Date().toISOString(), seconds, samples };
    model.changelog.push({
      at: new Date().toISOString(),
      what: `Resting heart rate ${how === "measured" ? "measured with your watch" : "set"}: ${bpm} bpm (was ${was}).`,
      changes: [`"Stressed" now starts at ${bpm + ALGO.stress_start} bpm and is full at ${bpm + ALGO.stress_full} bpm.`],
    });
    saveModel(model);
    return { resting_hr: bpm, was };
  });
}

function setSettings({ demo_clock }) {
  return withLock(() => {
    const model = loadModel();
    if (demo_clock !== undefined) {
      if (demo_clock !== null && toMin(demo_clock) == null) throw new Error('demo_clock must look like "21:40" or be null');
      model.settings.demo_clock = demo_clock;
    }
    saveModel(model);
    return model.settings;
  });
}

// Decide from a heart-rate trace whether calm was reached (for real evenings).
// Calm = the 2-minute rolling mean drops at least 3 bpm below the baseline (first 3 minutes) and stays there.
function calmFromTrace(samples) {
  if (!samples || samples.length < 30) return { reached: false, reason: "not enough data" };
  const t0 = samples[0].t;
  const base = samples.filter((s) => s.t - t0 <= 180000);
  const baseline = base.reduce((a, s) => a + s.bpm, 0) / base.length;
  for (let i = 0; i < samples.length; i++) {
    const win = samples.filter((s) => s.t <= samples[i].t && s.t > samples[i].t - 120000);
    if (samples[i].t - t0 < 300000 || win.length < 10) continue;
    const mean = win.reduce((a, s) => a + s.bpm, 0) / win.length;
    if (mean <= baseline - 3) return { reached: true, at_ms: samples[i].t - t0, baseline: Math.round(baseline), mean: Math.round(mean) };
  }
  return { reached: false, baseline: Math.round(baseline) };
}

module.exports = {
  FILES,
  FEELINGS,
  ALGO,
  loadCatalog,
  loadModel,
  saveModel,
  loadStage,
  saveStage,
  withLock,
  learn,
  recommend,
  summary,
  logEvening,
  logLiveRead,
  logSkip,
  deleteHeartData,
  setLive,
  setResting,
  setSettings,
  verifyAudit,
  stressWeight,
  calmFromTrace,
  writeJSON,
  emptyEffects,
  stat,
};
