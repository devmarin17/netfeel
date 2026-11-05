# NETFEEL 2046

> **A Netflix 2046 design fiction** — *what if Netflix didn't ask what you want to watch, but how you want to feel?*

> ⚠️ **This is a design fiction.** NetFeel is a concept study created for a design-futures elective (the brief: *imagine Netflix in 2046*). It is **not affiliated with, endorsed by, or produced by Netflix**. The research in this repo mixes **real, dated sources (2011–2025)** with **projected 2026–2046 events written in the same citation style** — that mixing is the method, not an attempt to pass fiction off as reporting. Where a claim could not be verified, it is flagged in the text.

---

## The concept

In 2046 Netflix doesn't ask *what* you want to watch. It asks **how you want to feel**.

A wearable you already own reads heart rate, HRV, skin temperature and movement while you watch. **NetFeel** learns a personal mood profile — which content produces which feeling, *for you*. You search by feeling ("I need a good cry tonight") in the app, or your personal AI assistant calls NetFeel on your behalf. And the profile is yours: on-device, visible, exportable, deletable, never sold.

**Sense → Learn → Ask → Own**

1. **Sense** — the body already broadcasts (any wearable with Broadcast Heart Rate works today).
2. **Learn** — an on-device taste model learns which feelings each title produces *on you*, judged by your body, not your clicks.
3. **Ask** — you ask for a feeling; your assistant asks *your* model. One pick and why — and the model always answers **"paid placement: none."**
4. **Own** — consent per read, deletion that actually deletes, an audit log that can't be silently edited.

The showcase metric is the **State-Hit Rate**: the % of evenings your body confirms the feeling you asked for. In the fiction, it replaces watch-hours as the metric Netflix optimizes — piloted as a 12-week A/B in 2028.

**The thesis:** Netflix's constraint is attention, not money (YouTube ~15.8% vs Netflix ~7.7% of US TV time in 2026). It can't out-upload YouTube — so it wins on the one thing the ad-and-data model can't copy: **trust with your feelings.** *AI does the sensing; humans do the storytelling.*

## In this repo

| Path | What it is |
|---|---|
| [`paper/netfeel-paper.md`](paper/netfeel-paper.md) | The full paper (~6k words): situation → trends & signals → a 2046 evening → how Netflix stays current → the concept → consequences. Every claim source-checked. |
| [`paper/netfeel-paper-short.md`](paper/netfeel-paper-short.md) | The 2-page version. |
| [`signals/`](signals/) | The weak-signal work: the **9 final signals** behind the concept ([final-signals.md](signals/final-signals.md)), the slide-ready [picklist](signals/signal-picklist.md), and the **21 tiered paper signals** (W1–W21 + T1–T5, inside the paper). |
| [`signals/*.html`](signals/) | The consequence visuals: [2046 world wheels](signals/netfeel-world-wheels.html) for the four must-have signals, the [nine-signal overview](signals/netfeel-consequence-overview.html), the picklist. Open in a browser. |
| [`research/`](research/) | The curated evidence base: Netflix strategy/culture/experiments/interview/roadmap, tech horizon to 2046, kids-media landscape, the attention battleground, and the source library. |
| [`prototypes/reaction-lab/`](prototypes/reaction-lab/) | **The face-sensing prototype**: webcam + MediaPipe (on-device) → six signals → Feeling Receipts → a personal taste model with explainable recommendations. Deterministic core, 9 unit tests. |
| [`prototypes/taste-model-mcp/`](prototypes/taste-model-mcp/) | **The heart-sensing prototype + MCP server**: a member-owned taste model (real Garmin heart rate) that any AI assistant can call over MCP, with consent-per-read and a hash-chained "paid placement: none" audit log. This ran **live** in the final presentation. |
| [`docs/feeling-line-2046-earlier-concept.md`](docs/feeling-line-2046-earlier-concept.md) | The earlier, bigger concept ("The Feeling Line") — kept as history. |

## Run the prototypes

```bash
# 1) Face-sensing demo (browser, on-device)
cd prototypes/reaction-lab
bash scripts/fetch-model.sh     # one-time model download (Apache-2.0, see models/README.md)
python3 -m http.server 8046     # open http://localhost:8046
npm test                        # the algorithm, tested headlessly

# 2) Heart-sensing demo + MCP server (Node ≥ 18, zero dependencies)
cd prototypes/taste-model-mcp
npm run check                   # self-test incl. audit tamper detection + MCP handshake
npm run reset                   # rebuild the simulated member's model
npm start                       # stage page on http://localhost:4046
# then connect Claude Desktop (npm run check prints the config) + a Garmin watch
```

Both prototypes implement the concept's privacy stances for real: sensing off by default, all inference on-device, consent before any heart read, deletion that actually deletes.

## The method (weak signals)

The concept was built in layers: a wide scan of sourced weak signals → 21 signals tiered by load-bearing weight (5 key / 8 support / 8 background, plus 5 enabling trends) → **9 final signals** mapped onto six consequence areas. The final nine, in one breath:

1. **Media is used to reach a feeling** (63% of ASMR viewers watch to reach a state)
2. **The assistant becomes (almost) the remote** (~800M weekly ChatGPT users; assistants that act, not just answer)
3. **People trust machines with feelings — but trust wins over usage** (72% of kids use AI companions; 11% enjoy them a lot)
4. **Mood search has already been tested** (a mood-based search beta, 2025)
5. **AI slop floods the feeds** (>20% of new-user YouTube; 278 slop channels targeting kids)
6. **Counter-trend: back to curated, human-made** (73% of Gen Z fans discover through social — curation becomes the moat)
7. **Under-16 social-media bans** (Australia's law barely bit: 81.5% still use it — regulation alone isn't trust)
8. **A human-made making-of for every title** (46% of fans want between-release content — proof-of-human as a feature)
9. **Rules for emotion data** (EU AI Act restricts emotion recognition; DMA forces data portability)

Full detail with sources: [`signals/final-signals.md`](signals/final-signals.md) and the paper's §2.

## License

Code: **MIT**. The paper, signals and research documents: **CC-BY-4.0** (remix with attribution). Third-party assets keep their own licenses — the MediaPipe face model (Apache-2.0, fetched, not committed) and the vendored mermaid bundle (MIT, license included).
