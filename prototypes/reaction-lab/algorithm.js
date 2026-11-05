// algorithm.js — Reaction Lab
// ---------------------------------------------------------------------------
//   summarize(frames, events, clip)   -> Feeling Receipt
//   updateProfile(profile, receipt)   -> new profile
//   recommend(profile, library, wantedFeeling) -> [{ clip, score, reason }]
//
// Reads frames via signals.js (calibrate + features). Plain ES module,
// no dependencies, fully deterministic (no Math.random, no clock).

import { calibrate, features } from './signals.js';

export const FEELINGS = ['laugh', 'thrill', 'calm', 'moved'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function bsGroup(bs, names) {
  if (!bs) return 0;
  let sum = 0;
  let n = 0;
  for (const name of names) {
    const v = bs[name];
    if (typeof v === 'number' && isFinite(v)) { sum += v; n += 1; }
  }
  return n ? sum / n : 0;
}

// ---- Feeling recipes (same weights for clip scores and per-frame peaks) ----
// laugh = joy alone.
// thrill = surprise + tension + lean-in.
// calm = drowsiness, but only while steadily watching and not startled —
//        drowsiness is the gate; attention and low surprise shape the score.
//        (An alert, wide-awake viewer scores ~0 here: watching isn't calm.)
// moved = tension + inner-brow rise, with joy and startle turning it down:
//        a tender scene while grinning isn't "moved", and a jump isn't either.
function thrillFrom(surprise, tension, leanIn) {
  return clamp01(0.40 * surprise + 0.35 * tension + 0.25 * leanIn);
}
function calmFrom(drowsyTerm, steadyAttention, lowSurprise) {
  return clamp01(drowsyTerm * (0.60 + 0.25 * steadyAttention + 0.15 * lowSurprise));
}
function movedFrom(tension, browUp, joy, surprise) {
  return clamp01((0.45 * tension + 0.55 * browUp) * (1 - 0.6 * joy) * (1 - 0.4 * surprise));
}

// The first 3 session-seconds are calibration; see summarize().
const CALIB_WINDOW_S = 3;

// Simple moving average over a ±halfWindow of seconds (readings are ~10 Hz).
function smoothSeries(rows, valueOf, halfWindow) {
  const out = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && rows[i].t - rows[j].t <= halfWindow; j--) { sum += valueOf(rows[j], j); n++; }
    for (let j = i + 1; j < rows.length && rows[j].t - rows[i].t <= halfWindow; j++) { sum += valueOf(rows[j], j); n++; }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

/**
 * Feeling Receipt — what the viewer felt during one clip.
 */
export function summarize(frames, events, clip) {
  const rows = (Array.isArray(frames) ? frames : [])
    .filter((f) => f && typeof f.t === 'number')
    .slice()
    .sort((a, b) => a.t - b.t);
  const baseline = calibrate(rows)
    || { frames: 0, bs: {}, yaw: 0, pitch: 0, scale: 0, move: 0, late: false };
  const feats = rows.map((f) => ({ t: f.t, f, x: features(f, baseline) }));
  const duration = clip && typeof clip.duration === 'number' && clip.duration > 0 ? clip.duration : 0;
  const browUpExcessOf = (r) => clamp01(bsGroup(r.f.bs, ['browInnerUp']) - (baseline.bs.browUp || 0));

  // The first ~3 session-seconds are calibration (neutral by design): they
  // would deflate every clip mean and pollute the smoothing windows, so they
  // are excluded from the reaction stats. Very short clips use everything.
  const t0 = rows.length ? rows[0].t : 0;
  const reactionRows = feats.filter((r) => r.t - t0 > CALIB_WINDOW_S);
  const statRows = reactionRows.length ? reactionRows : feats;

  // ---- clip-level means -------------------------------------------------
  // Expression means use face readings only (no face = expression unknown).
  // Attention is averaged over ALL stat readings: the camera losing you
  // counts as not watching.
  const faceRows = statRows.filter((r) => r.f.face);
  const meanOf = (get) => mean(faceRows.map(get));
  const meanJoy = meanOf((r) => r.x.joy);
  const meanSurprise = meanOf((r) => r.x.surprise);
  const meanTension = meanOf((r) => r.x.tension);
  const meanDrowsy = meanOf((r) => r.x.drowsy);
  const meanLeanIn = meanOf((r) => r.x.leanIn);
  const meanBrowUp = meanOf(browUpExcessOf);
  const meanAttention = mean(statRows.map((r) => r.x.attention));

  // Steady attention: credit only attention *held* from one moment to the
  // next (pairwise minimum), so glance-in-glance-out doesn't count as watching.
  let steadyAcc = 0;
  for (let i = 1; i < statRows.length; i++) {
    steadyAcc += Math.min(statRows[i].x.attention, statRows[i - 1].x.attention);
  }
  const steadyAttention = statRows.length > 1
    ? steadyAcc / (statRows.length - 1)
    : (statRows.length ? statRows[0].x.attention : 0);

  // Stillness: how little the head moves vs this person's own fidget level.
  let moveAcc = 0;
  for (let i = 1; i < faceRows.length; i++) {
    moveAcc += Math.abs((faceRows[i].f.yaw ?? 0) - (faceRows[i - 1].f.yaw ?? 0))
             + Math.abs((faceRows[i].f.pitch ?? 0) - (faceRows[i - 1].f.pitch ?? 0));
  }
  const moveRate = faceRows.length > 1 ? moveAcc / (faceRows.length - 1) : 0;
  const stillness = faceRows.length > 1
    ? clamp01(1 - Math.max(0, moveRate - (baseline.move || 0)) / 6)
    : 0; // no readings = unknown, not "still"

  // Drowsiness at clip level: held-heavy eyelids + a still head
  // (the "calm/sleep lane" from NetFeel).
  const drowsyTerm = clamp01(0.70 * meanDrowsy + 0.30 * stillness);

  // ---- peaks: top moments, from smoothed per-frame feelings -------------
  const instant = statRows.map((r) => ({
    laugh: r.x.joy,
    thrill: thrillFrom(r.x.surprise, r.x.tension, r.x.leanIn),
    calm: calmFrom(r.x.drowsy, r.x.attention, 1 - r.x.surprise),
    moved: movedFrom(r.x.tension, browUpExcessOf(r), r.x.joy, r.x.surprise),
  }));
  const smoothed = {};
  const peak = {};
  for (const g of FEELINGS) {
    smoothed[g] = smoothSeries(statRows, (r, i) => instant[i][g], 0.5);
    peak[g] = smoothed[g].length ? Math.max(...smoothed[g]) : 0;
  }
  // Candidates are readings where a feeling is clearly present (>= 0.30);
  // take the strongest, then keep adding as long as they're spaced apart
  // (12% of the clip, min 2.5 s), so one long laugh doesn't fill the list.
  const sep = Math.max(2.5, 0.12 * (duration || (statRows.length ? statRows[statRows.length - 1].t : 0)));
  const cands = [];
  for (const g of FEELINGS) {
    smoothed[g].forEach((v, i) => { if (v >= 0.30) cands.push({ t: statRows[i].t, feeling: g, value: v }); });
  }
  cands.sort((a, b) => b.value - a.value || a.t - b.t);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= 3) break;
    if (picked.every((p) => Math.abs(p.t - c.t) >= sep)) {
      picked.push({ t: Math.round(c.t * 10) / 10, feeling: c.feeling, value: r2(c.value) });
    }
  }
  const peaks = picked.sort((a, b) => a.t - b.t);

  // ---- clip scores: mean + peak ------------------------------------------
  // Half the score is the clip average, half is the biggest moment —
  // a clip with one great laugh shouldn't be punished by quiet stretches.
  const baseScores = {
    laugh: meanJoy,
    thrill: thrillFrom(meanSurprise, meanTension, meanLeanIn),
    calm: calmFrom(drowsyTerm, steadyAttention, 1 - meanSurprise),
    moved: movedFrom(meanTension, meanBrowUp, meanJoy, meanSurprise),
  };
  const scores = {};
  let felt = null;
  let best = 0;
  for (const g of FEELINGS) {
    scores[g] = r2(clamp01(0.5 * clamp01(baseScores[g]) + 0.5 * peak[g]));
    if (scores[g] > best) { best = scores[g]; felt = g; }
  }
  if (best < 0.05) felt = null; // nothing readable happened

  // ---- behaviour: skip, % watched, engagement ----------------------------
  const evs = (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e.t === 'number')
    .slice()
    .sort((a, b) => a.t - b.t);
  const skipEv = evs.find((e) => e.type === 'skip');
  const endEv = evs.some((e) => e.type === 'end');
  const lastT = rows.length ? rows[rows.length - 1].t : 0;
  let watched;
  if (skipEv) watched = duration ? skipEv.t / duration : 0;
  else if (endEv) watched = 1;
  else watched = duration ? lastT / duration : (rows.length ? 1 : 0);
  watched = clamp01(watched);

  // Pauses and seeks-back are real behaviour signals (SPEC): each one is a
  // small recapture cost on engagement. A seek counts as backward when the
  // producer flagged it (`back: true`, set by the YouTube ticker's
  // wall-clock check) or when its media time lands before the furthest
  // position reached so far. The penalty is capped so pathological logs
  // can't zero out an otherwise-watched clip.
  let pauses = 0;
  let backSeeks = 0;
  let furthest = -Infinity;
  for (const e of evs) {
    if (e.type === 'pause') pauses += 1;
    if (e.type === 'seek') {
      const back = e.back === true
        || (Number.isFinite(furthest) && e.t < furthest - 0.25);
      if (back) backSeeks += 1;
    }
    if (e.t > furthest) furthest = e.t;
  }
  const recapture = Math.max(
    0.7,
    1 - 0.02 * Math.min(pauses, 10) - 0.04 * Math.min(backSeeks, 8),
  );

  const engagement = r2(clamp01(meanAttention * watched * recapture));
  const skipped = Boolean(skipEv) || watched < 0.15;
  const intended = clip && clip.intended ? clip.intended : null;
  const stateHit = felt !== null && intended !== null && felt === intended && best >= 0.35;

  return {
    clipId: clip && clip.id != null ? clip.id : null,
    intended,
    felt,
    scores,
    engagement,
    peaks,
    stateHit,
    skipped,
    baselineLate: Boolean(baseline.late),
    baselineFrames: baseline.frames,
  };
}

// ---- profile ---------------------------------------------------------------

function numOr(v, d) {
  return typeof v === 'number' && isFinite(v) ? clamp01(v) : d;
}

export function seedProfile(profile) {
  const src = profile && typeof profile === 'object' ? profile : {};
  const byFeeling = {};
  for (const g of FEELINGS) {
    const s = src.byFeeling && src.byFeeling[g] ? src.byFeeling[g] : {};
    byFeeling[g] = {
      reactivity: numOr(s.reactivity, 0.5),  // how strongly clips tagged g make you feel g
      hitRate: numOr(s.hitRate, 0.5),        // how often the tag matched the dominant feeling
      engagement: numOr(s.engagement, 0.6),  // how much you typically watch clips tagged g
      skipRate: numOr(s.skipRate, 0.1),      // how often you skip clips tagged g
      plays: Number.isInteger(s.plays) && s.plays >= 0 ? s.plays : 0,
    };
  }
  const history = Array.isArray(src.history) ? src.history.slice(0, 40) : [];
  return { version: 1, byFeeling, history };
}

/**
 * Fold a receipt into the taste profile. Returns a NEW profile; never mutates.
 * The moving average starts fast (your first clip of a tag sets the value)
 * then settles into "recent clips count ~40%".
 */
export function updateProfile(profile, receipt) {
  const p = seedProfile(profile);
  if (!receipt || !FEELINGS.includes(receipt.intended)) return p;

  const tag = receipt.intended;
  const st = { ...p.byFeeling[tag] };
  const n = st.plays + 1;
  // Your first clip of a tag sets the value; later ones move it by ~40% max.
  const alpha = n === 1 ? 1 : Math.min(0.4, 1 / n);
  st.plays = n;
  st.reactivity = numOr(st.reactivity + (numOr(receipt.scores ? receipt.scores[tag] : 0, 0) - st.reactivity) * alpha, st.reactivity);
  st.hitRate = numOr(st.hitRate + ((receipt.stateHit ? 1 : 0) - st.hitRate) * alpha, st.hitRate);
  st.engagement = numOr(st.engagement + (numOr(receipt.engagement, 0) - st.engagement) * alpha, st.engagement);
  st.skipRate = numOr(st.skipRate + ((receipt.skipped ? 1 : 0) - st.skipRate) * alpha, st.skipRate);

  // `topPeak` is the STRONGEST notable moment (peaks are time-sorted in the
  // receipt, so pick by value), used for the recommend reason.
  const topPeak = Array.isArray(receipt.peaks) && receipt.peaks.length
    ? receipt.peaks.slice().sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    : null;
  const history = [
    {
      clipId: receipt.clipId != null ? receipt.clipId : null,
      intended: tag,
      felt: receipt.felt ?? null,
      stateHit: Boolean(receipt.stateHit),
      skipped: Boolean(receipt.skipped),
      engagement: numOr(receipt.engagement, 0),
      topPeak,
    },
    ...p.history,
  ].slice(0, 40);

  return { version: p.version, byFeeling: { ...p.byFeeling, [tag]: st }, history };
}

// ---- recommendation ----------------------------------------------------------

const VERB = { laugh: 'laughed', thrill: 'jumped', calm: 'unwound', moved: 'were moved' };

function fmtTime(t) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function pct(x) {
  return `${Math.round(clamp01(x) * 100)}%`;
}

/**
 * Rank unseen clips for the feeling the viewer wants, best first.
 * Score = how well the tag works on you x your engagement with the tag
 *         x penalty if you skipped this clip before x small damping if
 *         you skip this tag a lot. Clips you already watched to the end
 *         are not served again.
 */
export function recommend(profile, library, wantedFeeling) {
  if (!FEELINGS.includes(wantedFeeling)) return [];
  const p = seedProfile(profile);
  const st = p.byFeeling[wantedFeeling];
  const affinity = clamp01(0.70 * st.reactivity + 0.30 * st.hitRate);
  const lib = (Array.isArray(library) ? library : [])
    .filter((c) => c && c.id != null && c.intended === wantedFeeling);
  if (lib.length === 0) return [];

  const past = p.history.filter((h) => h.intended === wantedFeeling);
  const finished = new Set(past.filter((h) => !h.skipped).map((h) => h.clipId));
  const skippedBefore = new Set(past.filter((h) => h.skipped).map((h) => h.clipId));
  const exemplar = past.find((h) => !h.skipped && h.topPeak) || null;
  const exClip = exemplar
    ? lib.find((c) => c.id === exemplar.clipId) || null
    : null;

  const out = [];
  for (const clip of lib) {
    if (finished.has(clip.id)) continue; // already watched to the end
    const name = clip.name || String(clip.id);
    let penalty = 1;
    let reason;
    if (skippedBefore.has(clip.id)) {
      penalty = 0.15;
      reason = `You skipped “${name}” before — it only shows up because your ${wantedFeeling} shelf is nearly empty.`;
    } else if (exemplar && exemplar.topPeak) {
      const exName = exClip ? (exClip.name || String(exClip.id)) : 'your last clip';
      reason = `${cap(wantedFeeling)} clips work on you (${pct(affinity)}) — last time you ${VERB[wantedFeeling]} at ${fmtTime(exemplar.topPeak.t)} in “${exName}”.`;
    } else if (past.length) {
      reason = `New ${wantedFeeling} clip — clips tagged ${wantedFeeling} land for you about ${pct(affinity)} of the time.`;
    } else {
      reason = `Your first ${wantedFeeling} clip — a fresh start for this feeling.`;
    }
    const score = affinity * st.engagement * penalty * (1 - 0.3 * st.skipRate);
    out.push({ clip, score: r3(score), reason });
  }

  out.sort((a, b) => b.score - a.score || String(a.clip.id).localeCompare(String(b.clip.id)));
  return out;
}
