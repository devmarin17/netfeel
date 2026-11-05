// signals.js — Reaction Lab
// ---------------------------------------------------------------------------
// Turns raw face readings ("frames") into six 0..1 numbers:
//   joy, surprise, tension, drowsy, attention, leanIn
//
// Data contract (see SPEC.md):
//   frame    { t, face, bs: { mouthSmileLeft: 0.61, ... }, yaw, pitch, scale }
//   calibrate(frames)        -> baseline (learned from the first ~3 seconds)
//   features(frame, baseline) -> { joy, surprise, tension, drowsy, attention, leanIn }
//
// Plain ES module, no dependencies. Runs in the browser (type="module")
// and under node (see package.json: {"type":"module"}).
//
// Core idea: every reading is compared to the *viewer's own* neutral face,
// because resting faces differ. We measure the change, not the absolute value.

// The MediaPipe blendshapes we care about, grouped per signal.
// A "blendshape" is one muscle slider the face model moves, 0..1.
const GROUPS = {
  smile:    ['mouthSmileLeft', 'mouthSmileRight'],
  cheek:    ['cheekSquintLeft', 'cheekSquintRight'],  // raised cheeks: a "real" smile
  browUp:   ['browInnerUp'],                          // inner brows up: surprise, tenderness
  eyeWide:  ['eyeWideLeft', 'eyeWideRight'],
  jaw:      ['jawOpen'],
  browDown: ['browDownLeft', 'browDownRight'],
  press:    ['mouthPressLeft', 'mouthPressRight'],    // lips pressed together
  roll:     ['mouthRollLower'],                       // lower lip rolled in
  blink:    ['eyeBlinkLeft', 'eyeBlinkRight'],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function groupMean(bs, names) {
  if (!bs) return 0;
  let sum = 0;
  let n = 0;
  for (const name of names) {
    const v = bs[name];
    if (typeof v === 'number' && isFinite(v)) { sum += v; n += 1; }
  }
  return n ? sum / n : 0;
}

// How much a muscle group rose above the viewer's calibrated resting level.
// `gain` lifts small-but-real changes into readable territory.
function excess(frameBs, baselineBs, groupKey, gain) {
  const now = groupMean(frameBs, GROUPS[groupKey]);
  const rest = (baselineBs && typeof baselineBs[groupKey] === 'number') ? baselineBs[groupKey] : 0;
  return clamp01((now - rest) * gain);
}

/**
 * Learn this viewer's neutral face from the first ~3 seconds of *session*
 * readings (the app asks the viewer to sit still and watch). If the camera
 * only came on later — nothing in the first 3 session-seconds — fall back
 * to the first few face readings we do have and flag the baseline `late`.
 * Returns null when no face was ever seen: callers must treat that as
 * "no baseline yet" and retry (a zero baseline would fake "neutral").
 */
export function calibrate(frames) {
  const all = (Array.isArray(frames) ? frames : [])
    .filter((f) => f && typeof f.t === 'number')
    .slice()
    .sort((a, b) => a.t - b.t);
  const t0 = all.length ? all[0].t : 0;
  let cal = all.filter((f) => f.face && f.bs && f.t - t0 <= 3);
  let late = false;
  if (cal.length === 0 && all.length) {
    cal = all.filter((f) => f.face && f.bs).slice(0, 10); // camera came on late
    late = true;
  }
  if (cal.length === 0) return null; // no face readings: no baseline yet

  const baseline = { frames: cal.length, bs: {}, yaw: 0, pitch: 0, scale: 0, move: 0, late };

  for (const key of Object.keys(GROUPS)) {
    baseline.bs[key] = mean(cal.map((f) => groupMean(f.bs, GROUPS[key])));
  }
  baseline.yaw = mean(cal.map((f) => f.yaw ?? 0));
  baseline.pitch = mean(cal.map((f) => f.pitch ?? 0));
  baseline.scale = mean(cal.map((f) => f.scale ?? 0));

  // How much this person's head wanders even when "still" (degrees per reading).
  // Used later as the viewer's own fidget level.
  let move = 0;
  for (let i = 1; i < cal.length; i++) {
    move += Math.abs((cal[i].yaw ?? 0) - (cal[i - 1].yaw ?? 0))
          + Math.abs((cal[i].pitch ?? 0) - (cal[i - 1].pitch ?? 0));
  }
  baseline.move = cal.length > 1 ? move / (cal.length - 1) : 0;

  return baseline;
}

/**
 * One reading -> six 0..1 numbers.
 */
export function features(frame, baseline) {
  const f = frame || {};
  const b = baseline || { bs: {}, yaw: 0, pitch: 0, scale: 0 };
  const bb = b.bs || {};

  // Joy: smile + raised cheeks. Cheeks matter because a genuine smile
  // (Duchenne marker) raises them; a polite one doesn't.
  const joy = clamp01(
    0.70 * excess(f.bs, bb, 'smile', 1.15) +
    0.30 * excess(f.bs, bb, 'cheek', 1.20)
  );

  // Surprise: inner brows fly up, eyes widen, jaw drops.
  const surprise = clamp01(
    0.40 * excess(f.bs, bb, 'browUp', 1.10) +
    0.35 * excess(f.bs, bb, 'eyeWide', 1.10) +
    0.25 * excess(f.bs, bb, 'jaw', 1.10)
  );

  // Tension: knotted brow + pressed lips + rolled-in lower lip
  // (concentration, suspense, holding back emotion).
  const tension = clamp01(
    0.45 * excess(f.bs, bb, 'browDown', 1.25) +
    0.40 * excess(f.bs, bb, 'press', 1.25) +
    0.15 * excess(f.bs, bb, 'roll', 1.25)
  );

  // Drowsy: eyelids sitting well below this person's open-eye level.
  // A blink lasts ~0.1-0.4s, so one reading proves little; the clip average
  // in summarize() is what turns "held high" into the drowsiness signal.
  // ("Little head movement" is folded in at clip level via `stillness`.)
  const blink = groupMean(f.bs, GROUPS.blink);
  const openLevel = Math.max(0.30, (bb.blink ?? 0) + 0.15);
  const drowsy = clamp01((blink - openLevel) / 0.45);

  // Attention: facing the screen. Angles are measured from the viewer's own
  // calibrated resting angle, so sitting slightly off-centre is fine.
  // Full credit inside 25° yaw / 20° pitch, then it fades to zero across a
  // 15° / 12° grace band (a slow drift away isn't all-or-nothing).
  let attention = 0;
  if (f.face) {
    const offYaw = Math.abs((f.yaw ?? 0) - (b.yaw ?? 0));
    const offPitch = Math.abs((f.pitch ?? 0) - (b.pitch ?? 0));
    const overYaw = (offYaw - 25) / 15;
    const overPitch = (offPitch - 20) / 12;
    attention = clamp01(1 - Math.max(0, overYaw, overPitch));
  }

  // Lean-in: the face takes up more of the frame than at calibration.
  // +5% of video width ≈ moved closer; saturates there. No face = no box,
  // so no lean to measure.
  const leanIn = f.face ? clamp01(((f.scale ?? 0) - (b.scale ?? 0)) / 0.05) : 0;

  return { joy, surprise, tension, drowsy, attention, leanIn };
}
