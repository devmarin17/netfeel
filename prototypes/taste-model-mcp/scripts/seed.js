// Builds Daan's taste model from his SIMULATED diary of evenings (Aug – Nov 2026).
// Run: npm run reset   (also use it to reset between demo runs)
"use strict";

const fs = require("fs");
const { FILES, loadCatalog, learn, writeJSON } = require("../lib/model");

// [date, title_id, feeling, reached, start]. start "hot" = he began the evening with a high heart rate (gym, stressful day). Simulated: Daan, 28, Amsterdam, works Mon–Fri.
// Patterns the model should discover (all invented, but consistent, so the vault reads like a real history):
//   calm — nature, ambient sound, guided breath, slow pace and gentle food shows bring him down
//   (Our Planet, Headspace, Midnight Diner, bake-off). Cliffhangers, tension spikes and loud scores
//   keep him up (Stranger Things, Dark, Squid Game all failed as calm). On evenings he starts hot,
//   only guided breath and nature reliably work; even cozy fiction and baking shows miss.
//   hype — fast cuts and loud scores reach it (Drive to Survive, Extraction, Money Heist, Squid Game,
//   Stranger Things, ~75%); slow documentaries miss (one Night on Earth attempt did nothing).
//   dread — tension spikes, jump scares, dark palettes (Hill House, Midnight Mass, Bird Box, Ares,
//   Dark, Black Mirror, Undercover, ~75%); soothing stuff can't manufacture dread (Our Planet failed).
//   tears — heavy emotion plus a warm voice (Queer Eye, Marriage Story, Roma, My Octopus Teacher,
//   Heartstopper, ~67%); fast-cut things miss (Street Food, Drive to Survive). Long films (137/135 min)
//   only land on Fri/Sat/Sun — work nights are for shorter episodes.
// Weeknights are series; films only on weekends. Never more than one evening per date.
const DIARY = [
  // --- summer: August (new history, same patterns) ---
  ["2026-08-01", "money-heist", "hype", true],
  ["2026-08-02", "our-planet", "calm", true],
  ["2026-08-03", "headspace-sleep", "calm", true, "hot"],
  ["2026-08-04", "drive-to-survive", "hype", true],
  ["2026-08-05", "midnight-diner", "calm", true],
  ["2026-08-06", "dark", "dread", true],
  ["2026-08-07", "extraction", "hype", true],
  ["2026-08-08", "marriage-story", "tears", true],
  ["2026-08-09", "night-on-earth", "calm", true],
  ["2026-08-10", "squid-game", "hype", true],
  ["2026-08-11", "heartstopper", "calm", false],
  ["2026-08-12", "black-mirror", "dread", false],
  ["2026-08-13", "headspace-sleep", "calm", true, "hot"],
  ["2026-08-14", "my-octopus-teacher", "calm", true, "hot"],
  ["2026-08-15", "squid-game", "hype", true],
  ["2026-08-16", "roma", "tears", true],
  ["2026-08-17", "money-heist", "hype", false],
  ["2026-08-18", "our-planet", "calm", true, "hot"],
  ["2026-08-19", "hill-house", "dread", false],
  ["2026-08-20", "queer-eye", "tears", true],
  ["2026-08-21", "our-planet", "calm", true],
  ["2026-08-22", "money-heist", "hype", true],
  ["2026-08-23", "my-octopus-teacher", "calm", true],
  ["2026-08-24", "stranger-things", "hype", true],
  ["2026-08-25", "headspace-meditation", "calm", true, "hot"],
  ["2026-08-26", "midnight-mass", "dread", true],
  ["2026-08-27", "heartstopper", "tears", true],
  ["2026-08-28", "bake-off", "calm", false, "hot"],
  ["2026-08-29", "drive-to-survive", "hype", false],
  ["2026-08-30", "roma", "tears", false],
  ["2026-08-31", "undercover", "dread", true],
  // --- September ---
  ["2026-09-01", "stranger-things", "hype", false],
  ["2026-09-02", "chefs-table", "calm", false, "hot"],
  ["2026-09-03", "queer-eye", "tears", true],
  ["2026-09-04", "hill-house", "dread", true],
  ["2026-09-05", "queer-eye", "tears", false],
  ["2026-09-06", "our-planet", "calm", true],
  // 7 Sep: work deadline, in bed early, nothing logged.
  ["2026-09-08", "heartstopper", "tears", true],
  ["2026-09-09", "street-food-asia", "tears", false],
  ["2026-09-10", "headspace-sleep", "calm", true],
  ["2026-09-11", "midnight-mass", "dread", true],
  ["2026-09-12", "money-heist", "hype", true],
  ["2026-09-13", "our-planet", "calm", true],
  // 14 Sep: late at the office, no evening.
  ["2026-09-15", "dark", "dread", true],
  ["2026-09-16", "queer-eye", "tears", true],
  ["2026-09-17", "drive-to-survive", "tears", false],
  ["2026-09-18", "our-planet", "calm", true, "hot"],
  ["2026-09-19", "stranger-things", "hype", true],
  ["2026-09-20", "hill-house", "dread", true],
  // 21 Sep: drinks with friends, straight to sleep.
  ["2026-09-22", "black-mirror", "dread", true],
  ["2026-09-23", "night-on-earth", "hype", false],
  ["2026-09-24", "midnight-mass", "calm", false],
  ["2026-09-25", "our-planet", "dread", false],
  ["2026-09-26", "marriage-story", "tears", true],
  ["2026-09-27", "our-planet", "calm", true],
  ["2026-09-28", "drive-to-survive", "hype", true],
  ["2026-09-29", "heartstopper", "tears", false],
  ["2026-09-30", "queer-eye", "tears", true],
  ["2026-10-01", "street-food-asia", "calm", true],
  // --- October (the original diary, unchanged) ---
  ["2026-10-02", "stranger-things", "calm", false],
  ["2026-10-03", "our-planet", "calm", true],
  ["2026-10-04", "hill-house", "dread", true],
  ["2026-10-05", "bake-off", "calm", true],
  ["2026-10-06", "bake-off", "calm", false, "hot"],
  ["2026-10-07", "midnight-diner", "calm", true],
  ["2026-10-08", "headspace-sleep", "calm", true, "hot"],
  ["2026-10-09", "dark", "calm", false],
  ["2026-10-10", "drive-to-survive", "hype", true],
  ["2026-10-11", "ares", "dread", true],
  ["2026-10-12", "our-planet", "calm", true],
  ["2026-10-13", "chefs-table", "calm", false, "hot"],
  ["2026-10-14", "night-on-earth", "calm", true, "hot"],
  ["2026-10-15", "squid-game", "calm", false],
  ["2026-10-16", "bake-off", "calm", true],
  ["2026-10-17", "midnight-mass", "dread", true],
  ["2026-10-18", "queer-eye", "tears", true],
  ["2026-10-19", "headspace-meditation", "calm", true, "hot"],
  ["2026-10-20", "street-food-asia", "calm", false, "hot"],
  ["2026-10-21", "my-octopus-teacher", "calm", true],
  ["2026-10-22", "midnight-diner", "calm", false, "hot"],
  ["2026-10-23", "midnight-diner", "calm", true],
  ["2026-10-24", "bird-box", "dread", true],
  ["2026-10-25", "heartstopper", "calm", true],
  ["2026-10-26", "our-planet", "calm", true],
  ["2026-10-27", "headspace-sleep", "calm", true, "hot"],
  ["2026-10-28", "heartstopper", "calm", false, "hot"],
  ["2026-10-29", "night-on-earth", "calm", true],
  ["2026-10-30", "extraction", "hype", true],
  ["2026-10-31", "hill-house", "dread", false],
  ["2026-11-01", "bake-off", "calm", true],
];

// "2026-08-01" -> "1 Aug"; year only shown once (on the last date).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => Number(iso.slice(8, 10));
const mon = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];
const yr = (iso) => iso.slice(0, 4);
const diaryRange = () => {
  const first = DIARY[0][0];
  const last = DIARY[DIARY.length - 1][0];
  const from = `${day(first)} ${mon(first)}${yr(first) === yr(last) ? "" : " " + yr(first)}`;
  return `${from} – ${day(last)} ${mon(last)} ${yr(last)}`;
};

function build() {
  const catalog = loadCatalog();
  // Keep a resting heart rate you measured with your watch: a demo reset shouldn't wipe your body data.
  let kept = null;
  try {
    const old = JSON.parse(fs.readFileSync(FILES.model, "utf8")).member;
    if (old.resting_source && old.resting_source.how === "measured") kept = old;
  } catch (_) {}
  const model = {
    _about:
      "Daan's taste model. Owned by Daan: readable, editable, exportable, deletable. Netflix 2046 concept prototype.",
    simulated: "Daan is a simulated member. His evenings are invented. Live heart-rate reads are real.",
    member: {
      name: "Daan",
      age: 28,
      city: "Amsterdam",
      owner: "Daan",
      resting_hr: kept ? kept.resting_hr : 62,
      resting_source: kept ? kept.resting_source : { how: "default", note: "Not measured yet: measure yours with the watch on the stage page." },
    },
    ownership: {
      owner: "Daan",
      can: ["read", "correct", "export", "delete", "donate"],
      paid_placement: "never — publishers cannot buy rank",
      callers: ["Claude Desktop (local connector)", "stage page (localhost)"],
    },
    settings: {
      demo_clock: "21:40",
      buffer_min: 10,
      _demo_clock_note: "Picks are timed as if it's 21:40 (an evening). Set to null to use the real clock.",
    },
    effects: {},
    state_hit: {},
    sessions: [],
    audit: [],
    live_reads: [],
    changelog: [],
  };
  for (const [date, title_id, feeling, reached, start = "normal"] of DIARY) {
    learn(model, catalog, { date, title_id, feeling, reached, start, minutes_to_state: null, source: "simulated diary" });
  }
  model.changelog.push({
    at: new Date().toISOString(),
    what: `Model built from ${DIARY.length} simulated evenings (${diaryRange()}).`,
    changes: [],
  });
  if (kept)
    model.changelog.push({ at: new Date().toISOString(), what: `Kept your measured resting heart rate: ${kept.resting_hr} bpm.`, changes: [] });
  writeJSON(FILES.model, model);
  writeJSON(FILES.stage, { last_pick: null, live: null, last_receipt: null });
  return model;
}

if (require.main === module) {
  const m = build();
  const c = m.state_hit.calm;
  console.log(`Reset done. Taste model: ${m.sessions.length} evenings, calm state-hit ${c.hits} of ${c.n}.`);
}
module.exports = { build, DIARY };
