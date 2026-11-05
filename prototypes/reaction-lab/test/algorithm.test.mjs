// algorithm.test.mjs — Reaction Lab
// ---------------------------------------------------------------------------
// Synthetic viewers (laughing, bored, sleepy, thrilled, moved) -> receipts,
// then profile + recommendation behaviour. No dependencies beyond node.
//
// Run from the repo root:   node prototypes/reaction-lab/test/algorithm.test.mjs

import assert from 'node:assert/strict';
import { calibrate, features } from '../signals.js';
import { summarize, updateProfile, recommend, seedProfile } from '../algorithm.js';

// ---------------------------------------------------------------- frame factory

// A resting face: every tracked blendshape at its quiet level.
const NEUTRAL = {
  mouthSmileLeft: 0.04, mouthSmileRight: 0.04,
  cheekSquintLeft: 0.05, cheekSquintRight: 0.05,
  browInnerUp: 0.05,
  eyeWideLeft: 0.06, eyeWideRight: 0.06,
  jawOpen: 0.04,
  browDownLeft: 0.06, browDownRight: 0.06,
  mouthPressLeft: 0.05, mouthPressRight: 0.05,
  mouthRollLower: 0.04,
  eyeBlinkLeft: 0.07, eyeBlinkRight: 0.07,
};

// `fn(t)` describes the viewer at time t (seconds); returns { bs?, yaw?, pitch?, scale?, face? }.
function makeFrames(duration, fn, hz = 10) {
  const frames = [];
  const n = Math.round(duration * hz);
  for (let i = 0; i <= n; i++) {
    const t = +(i / hz).toFixed(2);
    const o = fn(t) || {};
    const face = o.face !== false;
    frames.push({
      t,
      face,
      bs: face ? { ...NEUTRAL, ...(o.bs || {}) } : null,
      yaw: o.yaw ?? 0,
      pitch: o.pitch ?? 0,
      scale: o.scale ?? 0.23,
    });
  }
  return frames;
}

const inRange = (o) => {
  for (const [k, v] of Object.entries(o)) {
    assert.ok(typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1, `${k} should be a 0..1 number, got ${v}`);
  }
};

// ---------------------------------------------------------------- test runner

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------- 1. signals

test('signals: calibrate + features return sane 0..1 numbers', () => {
  const frames = makeFrames(10, (t) => (t <= 3 ? {} : { bs: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } }));
  const baseline = calibrate(frames);
  assert.ok(baseline.frames >= 20, `baseline should use the first ~3s, got ${baseline.frames} frames`);
  assert.ok(Math.abs(baseline.bs.smile - 0.04) < 0.01, 'baseline smile should sit at the resting level');

  const laughing = features(frames[100], baseline); // t = 10s, big smile
  inRange(laughing);
  assert.ok(laughing.joy > 0.5, `a big smile past baseline should read as joy, got ${laughing.joy}`);
  assert.ok(laughing.attention === 1, 'facing the screen = full attention');

  const noFace = features({ t: 5, face: false, bs: null, yaw: 90, pitch: 0, scale: 0 }, baseline);
  inRange(noFace);
  assert.equal(noFace.attention, 0, 'no face = no attention');

  const noBaseline = features({ t: 0, face: true, bs: { mouthSmileLeft: 0.9, mouthSmileRight: 0.9, eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }, yaw: 0, pitch: 0, scale: 0.3 }, null);
  inRange(noBaseline);
  assert.ok(noBaseline.drowsy > 0.5, 'closed eyes with no baseline should still read drowsy');
  assert.ok(noBaseline.leanIn === 1, 'much larger face = saturated lean-in');

  const emptyBaseline = calibrate([]);
  assert.equal(emptyBaseline, null, 'calibrate([]) with no face readings must return null, not a fake zero baseline');
  inRange(features(frames[0], null));

  // camera came on late: no readings inside the first 3 session-seconds →
  // baseline falls back to the first face readings and is flagged `late`
  // camera off during the first 3 session-seconds, then on: baseline falls
  // back to the first face readings and is flagged `late`
  const lateFrames = makeFrames(20, (t) => (t <= 3 ? { face: false } : { bs: { mouthSmileLeft: 0.5, mouthSmileRight: 0.5 } }));
  const lateBaseline = calibrate(lateFrames);
  assert.ok(lateBaseline && lateBaseline.frames > 0, 'late camera start should still yield a baseline');
  assert.equal(lateBaseline.late, true, 'late baseline must be flagged as late');
  const earlyBaseline = calibrate(makeFrames(10, () => ({})));
  assert.equal(earlyBaseline.late, false, 'on-time calibration is not late');
});

// ---------------------------------------------------------------- 2. laughing viewer

test('laughing viewer: laugh receipt with peaks, hit, high engagement', () => {
  const frames = makeFrames(30, (t) => {
    if (t < 3) return {}; // calibration: neutral
    const bs = {};
    if (t >= 8 && t < 12) Object.assign(bs, { mouthSmileLeft: 0.85, mouthSmileRight: 0.84, cheekSquintLeft: 0.55, cheekSquintRight: 0.53, jawOpen: 0.35, eyeBlinkLeft: 0.35, eyeBlinkRight: 0.35 });
    if (t >= 20 && t < 22.5) Object.assign(bs, { mouthSmileLeft: 0.6, mouthSmileRight: 0.6, cheekSquintLeft: 0.35, cheekSquintRight: 0.35 });
    return { bs, yaw: Math.sin(t) * 4, pitch: Math.cos(t * 0.7) * 3, scale: 0.24 };
  });
  const events = [{ t: 0, type: 'play' }, { t: 30, type: 'end' }];
  const clip = { id: 'c1', name: 'Stand-up bit', intended: 'laugh', duration: 30 };

  const r = summarize(frames, events, clip);
  assert.equal(r.clipId, 'c1');
  assert.equal(r.felt, 'laugh');
  assert.ok(r.scores.laugh > 0.45, `laugh score should be strong, got ${r.scores.laugh}`);
  assert.ok(r.scores.laugh > r.scores.calm && r.scores.laugh > r.scores.thrill && r.scores.laugh > r.scores.moved,
    `laugh should dominate: ${JSON.stringify(r.scores)}`);
  assert.equal(r.stateHit, true, 'laugh clip + felt laugh = state hit');
  assert.equal(r.skipped, false);
  assert.ok(r.engagement > 0.75, `engagement should be high, got ${r.engagement}`);
  assert.ok(r.peaks.length >= 1 && r.peaks.length <= 3, `1..3 peaks, got ${r.peaks.length}`);
  assert.equal(r.peaks[0].feeling, 'laugh');
  assert.ok(r.peaks[0].t >= 7 && r.peaks[0].t <= 13, `first peak near the big laugh, got t=${r.peaks[0].t}`);
  for (let i = 1; i < r.peaks.length; i++) assert.ok(r.peaks[i].t > r.peaks[i - 1].t, 'peaks sorted by time');
  console.log('   laugh  ->', JSON.stringify(r.scores), `felt=${r.felt} hit=${r.stateHit} eng=${r.engagement} peaks=${r.peaks.map((p) => `${p.feeling}@${p.t}`).join(' ')}`);
});

// ---------------------------------------------------------------- 3. bored viewer

test('bored viewer: looks away, skips — low scores, low engagement, skipped', () => {
  const frames = makeFrames(18, (t) => {
    if (t < 3) return {};
    if (t >= 10) return { yaw: 42 + Math.sin(t * 3) * 3, pitch: 8, scale: 0.21 }; // head turned to their phone
    return { yaw: Math.sin(t) * 5, pitch: 2, scale: 0.23 };
  });
  const events = [{ t: 0, type: 'play' }, { t: 18, type: 'skip' }];
  const clip = { id: 't9', name: 'Chase scene', intended: 'thrill', duration: 40 };

  const r = summarize(frames, events, clip);
  assert.equal(r.skipped, true, 'skip event must mark the receipt skipped');
  assert.ok(r.engagement < 0.5, `engagement should be low, got ${r.engagement}`);
  assert.equal(r.stateHit, false, 'a skip is never a state hit');
  assert.ok(r.scores.thrill < 0.2, `thrill should be near zero, got ${r.scores.thrill}`);
  assert.ok(r.felt !== 'thrill', `felt must not be thrill, got ${r.felt}`);
  assert.ok(r.scores.laugh < 0.15, `no laugh, got ${r.scores.laugh}`);
  assert.deepEqual(r.peaks, [], 'a bored viewer leaves no peaks');
  console.log('   bored  ->', JSON.stringify(r.scores), `felt=${r.felt} hit=${r.stateHit} eng=${r.engagement} skipped=${r.skipped}`);
});

// ---------------------------------------------------------------- 4. sleepy viewer

test('sleepy viewer: heavy eyelids, still head — calm dominates', () => {
  const frames = makeFrames(60, (t) => {
    if (t < 3) return {};
    const droop = Math.min(0.65, 0.35 + Math.max(0, t - 6) * 0.012); // lids get heavier
    return { bs: { eyeBlinkLeft: droop, eyeBlinkRight: droop }, yaw: Math.sin(t * 0.5) * 2, pitch: Math.sin(t * 0.3) * 1.5, scale: 0.22 };
  });
  const events = [{ t: 0, type: 'play' }, { t: 60, type: 'end' }];
  const clip = { id: 'k2', name: 'Rain on windows', intended: 'calm', duration: 60 };

  const r = summarize(frames, events, clip);
  assert.equal(r.felt, 'calm', `heavy lids + stillness = calm, got ${r.felt}`);
  assert.ok(r.scores.calm > 0.5, `calm score should be strong, got ${r.scores.calm}`);
  assert.ok(r.scores.calm > r.scores.laugh && r.scores.calm > r.scores.thrill && r.scores.calm > r.scores.moved,
    `calm should dominate: ${JSON.stringify(r.scores)}`);
  assert.equal(r.stateHit, true, 'calm clip + felt calm = state hit');
  assert.ok(r.engagement > 0.85, `still facing the screen to the end = high engagement, got ${r.engagement}`);
  assert.ok(r.peaks.length >= 1 && r.peaks.every((p) => p.feeling === 'calm'),
    `calm peaks only, got ${JSON.stringify(r.peaks)}`);
  console.log('   sleepy ->', JSON.stringify(r.scores), `felt=${r.felt} hit=${r.stateHit} eng=${r.engagement} peaks=${r.peaks.map((p) => `${p.feeling}@${p.t}`).join(' ')}`);
});

// ---------------------------------------------------------------- 5. thrilled viewer

test('thrilled viewer: jump scares + lean-in — thrill dominates', () => {
  const frames = makeFrames(35, (t) => {
    if (t < 3) return {};
    const scare = (t >= 12 && t < 14.5) || (t >= 24 && t < 26);
    if (scare) return { bs: { browInnerUp: 0.8, eyeWideLeft: 0.85, eyeWideRight: 0.82, jawOpen: 0.7 }, yaw: Math.sin(t) * 5, pitch: 2, scale: 0.30 };
    if (t >= 6) return { bs: { browDownLeft: 0.32, browDownRight: 0.31, mouthPressLeft: 0.30, mouthPressRight: 0.29 }, yaw: Math.sin(t) * 5, pitch: 2, scale: 0.27 }; // suspense + leaning in
    return { yaw: Math.sin(t) * 5, pitch: 2, scale: 0.23 };
  });
  const events = [{ t: 0, type: 'play' }, { t: 35, type: 'end' }];
  const clip = { id: 'h1', name: 'The corridor', intended: 'thrill', duration: 35 };

  const r = summarize(frames, events, clip);
  assert.equal(r.felt, 'thrill', `scares + tension + lean-in = thrill, got ${r.felt} (${JSON.stringify(r.scores)})`);
  assert.ok(r.scores.thrill > 0.35, `thrill score above state-hit bar, got ${r.scores.thrill}`);
  assert.ok(r.scores.thrill > r.scores.calm && r.scores.thrill > r.scores.laugh, `thrill should dominate: ${JSON.stringify(r.scores)}`);
  assert.equal(r.stateHit, true);
  assert.ok(r.peaks.some((p) => p.feeling === 'thrill' && p.t > 11 && p.t < 15), `a peak at the first scare, got ${JSON.stringify(r.peaks)}`);
  console.log('   thrill ->', JSON.stringify(r.scores), `felt=${r.felt} hit=${r.stateHit} eng=${r.engagement} peaks=${r.peaks.map((p) => `${p.feeling}@${p.t}`).join(' ')}`);
});

// ---------------------------------------------------------------- 6. moved viewer

test('moved viewer: knotted brow, inner-brow rise, no smile — moved dominates', () => {
  const frames = makeFrames(45, (t) => {
    if (t < 3) return {};
    if (t >= 10 && t < 40) {
      return {
        bs: { browInnerUp: 0.7, browDownLeft: 0.35, browDownRight: 0.34, mouthPressLeft: 0.5, mouthPressRight: 0.49, mouthSmileLeft: 0.05, mouthSmileRight: 0.05 },
        yaw: Math.sin(t) * 3, pitch: 1, scale: 0.23,
      };
    }
    return { yaw: Math.sin(t) * 3, pitch: 1, scale: 0.23 };
  });
  const events = [{ t: 0, type: 'play' }, { t: 45, type: 'end' }];
  const clip = { id: 'm5', name: 'Old letters', intended: 'moved', duration: 45 };

  const r = summarize(frames, events, clip);
  assert.equal(r.felt, 'moved', `tension + inner brow, no joy = moved, got ${r.felt} (${JSON.stringify(r.scores)})`);
  assert.ok(r.scores.moved > 0.35, `moved score above the bar, got ${r.scores.moved}`);
  assert.ok(r.scores.laugh < 0.15, 'no smile means no laugh score');
  assert.ok(r.scores.moved > r.scores.thrill && r.scores.moved > r.scores.calm, `moved should dominate: ${JSON.stringify(r.scores)}`);
  assert.equal(r.stateHit, true);
  console.log('   moved  ->', JSON.stringify(r.scores), `felt=${r.felt} hit=${r.stateHit} eng=${r.engagement} peaks=${r.peaks.map((p) => `${p.feeling}@${p.t}`).join(' ')}`);
});

// ---------------------------------------------------------------- 7. robustness

test('robustness: empty input, camera never on, unknown feeling', () => {
  const clip = { id: 'x', name: 'X', intended: 'calm', duration: 30 };
  const r = summarize([], [], clip);
  assert.equal(r.felt, null);
  assert.equal(r.engagement, 0);
  assert.equal(r.skipped, true);
  assert.deepEqual(r.peaks, []);

  const blind = summarize(makeFrames(10, () => ({ face: false })), [{ t: 0, type: 'play' }], clip);
  assert.equal(blind.felt, null, 'no face all clip -> nothing readable');
  assert.ok(blind.scores.laugh === 0 && blind.scores.thrill === 0, 'zero scores with no face');

  const seeded = seedProfile(null);
  assert.equal(recommend(seeded, [], 'laugh').length, 0, 'empty library -> no recommendations');
  assert.deepEqual(recommend(seeded, [{ id: 'a', intended: 'laugh', name: 'A', duration: 10 }], 'party'), [], 'unknown feeling -> []');

  const r2b = summarize(makeFrames(10, () => ({})), [], { id: 'y', intended: 'laugh', duration: 0 });
  inRange(r2b.scores);
  assert.equal(r2b.stateHit, false, 'neutral face is not a state hit');
});

// ---------------------------------------------------------------- 8. profile + recommend

test('profile: moving average, hit/skip rates, no mutation of the input profile', () => {
  const laughReceipt = {
    clipId: 'c1', intended: 'laugh', felt: 'laugh',
    scores: { laugh: 0.5, thrill: 0.05, calm: 0.2, moved: 0.02 },
    engagement: 0.95, peaks: [{ t: 9.8, feeling: 'laugh', value: 0.83 }],
    stateHit: true, skipped: false,
  };
  let profile = updateProfile(null, laughReceipt);
  const la = profile.byFeeling.laugh;
  assert.equal(la.plays, 1);
  assert.ok(Math.abs(la.reactivity - 0.5) < 0.001, 'first play sets reactivity to the observed score');
  assert.equal(la.hitRate, 1, 'a hit sets the hit rate to 1');
  assert.equal(la.skipRate, 0);
  assert.equal(profile.history[0].clipId, 'c1');
  assert.equal(profile.history[0].topPeak.t, 9.8, 'history keeps the best peak for the reason text');

  const before = JSON.stringify(profile);
  const skipReceipt = {
    clipId: 't9', intended: 'thrill', felt: null,
    scores: { laugh: 0, thrill: 0.08, calm: 0.13, moved: 0 },
    engagement: 0.25, peaks: [], stateHit: false, skipped: true,
  };
  updateProfile(profile, skipReceipt);
  assert.equal(JSON.stringify(profile), before, 'updateProfile must not mutate its input');

  profile = updateProfile(profile, skipReceipt);
  const th = profile.byFeeling.thrill;
  assert.equal(th.plays, 1);
  assert.equal(th.skipRate, 1, 'a skip sets skip rate to 1');
  assert.ok(th.reactivity < 0.2, `thrill reactivity stays low, got ${th.reactivity}`);

  const calmReceipt = {
    clipId: 'k2', intended: 'calm', felt: 'calm',
    scores: { laugh: 0, thrill: 0.05, calm: 0.69, moved: 0.03 },
    engagement: 1, peaks: [{ t: 47, feeling: 'calm', value: 0.78 }],
    stateHit: true, skipped: false,
  };
  profile = updateProfile(profile, calmReceipt);
  assert.equal(profile.byFeeling.calm.reactivity, 0.69);
  assert.equal(profile.history.length, 3, 'history grows');
  assert.equal(profile.history[0].clipId, 'k2', 'newest first');
});

test('recommend: fresh clips ranked, finished clips excluded, skipped clips penalised, real reasons', () => {
  const lib = [
    { id: 'L1', name: 'Stand-up bit', intended: 'laugh', duration: 30 },
    { id: 'L2', name: 'Puppy cam', intended: 'laugh', duration: 20 },
    { id: 'L3', name: 'Chase scene', intended: 'thrill', duration: 40 },
    { id: 'L4', name: 'Rain on windows', intended: 'calm', duration: 60 },
    { id: 'L5', name: 'Old letters', intended: 'moved', duration: 45 },
    { id: 'L6', name: 'Sky at dusk', intended: 'calm', duration: 50 },
  ];
  let profile = updateProfile(null, {
    clipId: 'L1', intended: 'laugh', felt: 'laugh',
    scores: { laugh: 0.5, thrill: 0.05, calm: 0.2, moved: 0.02 },
    engagement: 0.95, peaks: [{ t: 9.8, feeling: 'laugh', value: 0.83 }],
    stateHit: true, skipped: false,
  });
  profile = updateProfile(profile, {
    clipId: 'L3', intended: 'thrill', felt: null,
    scores: { laugh: 0, thrill: 0.08, calm: 0.13, moved: 0 },
    engagement: 0.25, peaks: [], stateHit: false, skipped: true,
  });
  profile = updateProfile(profile, {
    clipId: 'L4', intended: 'calm', felt: 'calm',
    scores: { laugh: 0, thrill: 0.05, calm: 0.69, moved: 0.03 },
    engagement: 1, peaks: [{ t: 47, feeling: 'calm', value: 0.78 }],
    stateHit: true, skipped: false,
  });

  // laugh: L1 was watched to the end -> gone; L2 is fresh and ranked first.
  const laughs = recommend(profile, lib, 'laugh');
  assert.ok(laughs.length >= 1, 'should recommend the remaining laugh clip');
  assert.ok(laughs.every((x) => x.clip.id !== 'L1'), 'a finished clip is never re-served');
  assert.equal(laughs[0].clip.id, 'L2');
  assert.ok(laughs[0].score > 0.2, `fresh laugh clip scores well, got ${laughs[0].score}`);
  assert.ok(/laughed at \d+:\d\d/.test(laughs[0].reason), `reason cites the real moment, got: ${laughs[0].reason}`);
  console.log('   rec laugh ->', laughs.map((x) => `${x.clip.id}:${x.score}`).join(' '), '|', laughs[0].reason);

  // thrill: only L3 exists and it was skipped before -> shown, but heavy penalty.
  const thrills = recommend(profile, lib, 'thrill');
  assert.equal(thrills.length, 1);
  assert.equal(thrills[0].clip.id, 'L3');
  assert.ok(thrills[0].score <= 0.15, `skipped-before clip is penalised, got ${thrills[0].score}`);
  assert.ok(/skipped/.test(thrills[0].reason), `reason admits the skip, got: ${thrills[0].reason}`);
  console.log('   rec thrill ->', thrills[0].clip.id, thrills[0].score, '|', thrills[0].reason);

  // calm: L4 was watched to the end, so only L6 is offered — with a reason
  // that cites the real calm moment from L4.
  const calms = recommend(profile, lib, 'calm');
  assert.equal(calms.length, 1, 'watched L4 excluded, L6 offered');
  assert.deepEqual(calms.map((x) => x.clip.id), ['L6'], 'stable order on ties');
  assert.deepEqual(recommend(profile, lib, 'calm').map((x) => x.clip.id), calms.map((x) => x.clip.id), 'recommend is deterministic');
  assert.ok(calms[0].score > 0.5, `calm works on this viewer, got ${calms[0].score}`);
  assert.ok(/unwound/.test(calms[0].reason), `reason cites the calm moment, got: ${calms[0].reason}`);
  console.log('   rec calm  ->', calms.map((x) => `${x.clip.id}:${x.score}`).join(' '), '|', calms[0].reason);

  // brand-new profile: fresh tag, still sensible.
  const fresh = recommend(seedProfile(null), lib, 'moved');
  assert.equal(fresh.length, 1);
  assert.ok(fresh[0].reason.length > 10, 'new viewer still gets a reason');
});

// ---------------------------------------------------------------- run

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}
console.log(failed === 0
  ? `\nAll ${tests.length} tests passed.`
  : `\n${failed} of ${tests.length} tests FAILED.`);
process.exitCode = failed === 0 ? 0 : 1;
