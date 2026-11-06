<p align="center">
  <img src="docs/images/hero.svg" alt="NETFEEL 2046: not what you want to watch, how you want to feel. Sense, Learn, Ask, Own." width="100%">
</p>

> **A Netflix 2046 design fiction:** *what if Netflix didn't ask what you want to watch, but how you want to feel?*

> [!IMPORTANT]
> **This is a design fiction.** NetFeel is a concept study created for the Design Future Course (the brief: *imagine Netflix in 2046*). It is **not affiliated with, endorsed by, or produced by Netflix**. The research in this repo mixes **real, dated sources (2011–2025)** with **projected 2026–2046 events written in the same citation style**. That mix is the method, not an attempt to pass fiction off as reporting. Where a claim could not be verified, it is flagged in the text.

**Contents:** [The concept](#the-concept) · [See it working](#see-it-working) · [The method](#the-method-weak-signals) · [What's in this repo](#whats-in-this-repo) · [Run the prototypes](#run-the-prototypes) · [License](#license)

---

## The concept

In 2046 Netflix doesn't ask *what* you want to watch. It asks **how you want to feel**.

A wearable you already own reads heart rate, HRV, skin temperature and movement while you watch. **NetFeel** learns a personal mood profile: which content produces which feeling, *for you*. You search by feeling ("I need a good cry tonight") in the app, or your personal AI assistant calls NetFeel on your behalf. And the profile is yours: on-device, visible, exportable, deletable, never sold.

| Step | What happens |
|---|---|
| **1. Sense** | The body already broadcasts. Any wearable with Broadcast Heart Rate works today. |
| **2. Learn** | An on-device taste model learns which feelings each title produces *on you*, judged by your body, not your clicks. |
| **3. Ask** | You ask for a feeling; your assistant asks *your* model. One pick and why, and the model always answers **"paid placement: none."** |
| **4. Own** | Consent per read, deletion that actually deletes, an audit log that can't be silently edited. |

The showcase metric is the **State-Hit Rate**: the share of evenings your body confirms the feeling you asked for. In the fiction it replaces watch-hours as the metric Netflix optimizes, piloted as a 12-week A/B test in 2028.

**The thesis:** Netflix's constraint is attention, not money (YouTube ~15.8% vs Netflix ~7.7% of US TV time in 2026). It can't out-upload YouTube, so it wins on the one thing the ad-and-data model can't copy: **trust with your feelings.** *AI does the sensing; humans do the storytelling.*

## See it working

Two working prototypes show the parts of NetFeel that already exist today.

### Heart-sensing taste model + MCP server

A member-owned taste model fed by a real Garmin heart rate. Any AI assistant that speaks MCP (e.g. Claude Desktop) can ask it for a pick, with consent per heart read and a hash-chained "paid placement: none" audit log.

| Before a pick: your live heart | After a pick: the reasons and what's behind them |
|---|---|
| ![The stage page before a pick: a big live heart-rate number against your resting rate](docs/images/stage-heart.png) | ![The stage page after a pick: reason lines, other titles that fit tonight, and the vault, heartbeat and algorithm panels](docs/images/stage-pick-reasons.png) |

→ [`prototypes/taste-model-mcp/`](prototypes/taste-model-mcp/)

### Reaction Lab: face sensing, on-device

Webcam + MediaPipe in the browser → six signals → Feeling Receipts → a personal taste model with explainable recommendations. The camera is off until you turn it on, and no frames are kept.

![Reaction Lab: the player, the camera-off Skip Button, live signals, the feeling receipt and the feeling picker](docs/images/reaction-lab.png)

→ [`prototypes/reaction-lab/`](prototypes/reaction-lab/)

## The method (weak signals)

The concept was built in layers: a wide scan of sourced weak signals → 21 signals tiered by how much weight they carry (5 key / 8 support / 8 background, plus 5 enabling trends) → **9 final signals** mapped onto six consequence areas.

1. **Media is used to reach a feeling** (63% of ASMR viewers watch to reach a state)
2. **The assistant becomes (almost) the remote** (~800M weekly ChatGPT users; assistants that act, not just answer)
3. **People trust machines with feelings, but trust wins over usage** (72% of teens have used AI companions; 11% enjoy AI "a lot")
4. **Mood search has already been tested** (a mood-based search beta, 2025)
5. **AI slop floods the feeds** (>20% of new-user YouTube; 278 slop channels)
6. **Counter-trend: back to curated, human-made** (73% of Gen Z fans discover through social; curation becomes the moat)
7. **Under-16 social-media bans** (Australia's law barely bit: 81.5% still use it; regulation alone isn't trust)
8. **A human-made making-of for every title** (46% of fans want between-release content; proof-of-human as a feature)
9. **Rules for emotion data** (the EU AI Act restricts emotion recognition; the DMA forces data portability)

Each signal was then pushed forward to 2046 on a consequence wheel (1st, 2nd and 3rd-order effects across six areas):

| 2046 world wheels: the four key signals | All nine signals on one wheel |
|---|---|
| [![2046 World Wheels: sticky notes on a three-ring consequence wheel for "everyone gets an AI assistant that acts for them"](docs/images/world-wheels.png)](signals/netfeel-world-wheels.html) | [![NetFeel Consequence Overview: 36 merged notes from all nine signals on one wheel](docs/images/consequence-overview.png)](signals/netfeel-consequence-overview.html) |

The wheels are interactive HTML pages: open them in a browser to filter by signal, drag notes or add your own. Full detail with sources: [`signals/final-signals.md`](signals/final-signals.md) and §2 of the paper.

## What's in this repo

```
netfeel/
├── paper/              the full paper and a 2-page short version
├── signals/            the 9 final signals, the picklist, and the interactive consequence wheels
├── research/           the curated evidence base and source library
├── prototypes/
│   ├── reaction-lab/       face sensing in the browser (on-device)
│   └── taste-model-mcp/    heart sensing + MCP server for AI assistants
└── docs/               the earlier concept, and the images used in these READMEs
```

| Path | What it is |
|---|---|
| [`paper/netfeel-paper.md`](paper/netfeel-paper.md) | The full paper (~6k words): situation → trends & signals → a 2046 evening → how Netflix stays current → the concept → consequences. Every claim source-checked. |
| [`paper/netfeel-paper-short.md`](paper/netfeel-paper-short.md) | The 2-page version. |
| [`signals/`](signals/) | The **9 final signals** ([final-signals.md](signals/final-signals.md)), the [picklist](signals/signal-picklist.md), and the consequence visuals ([world wheels](signals/netfeel-world-wheels.html), [nine-signal overview](signals/netfeel-consequence-overview.html)). The 21 tiered signals (W1–W21 + T1–T5) are in the paper. |
| [`research/`](research/) | Netflix strategy, culture, experiments, a CEO interview and roadmap; the tech horizon to 2046; the kids-media landscape; the attention battleground; and the [source library](research/sources/source-library.md). |
| [`prototypes/reaction-lab/`](prototypes/reaction-lab/) | **Face sensing:** webcam + MediaPipe (on-device) → six signals → Feeling Receipts → a taste model with explainable recommendations. Deterministic core, 9 unit tests. |
| [`prototypes/taste-model-mcp/`](prototypes/taste-model-mcp/) | **Heart sensing + MCP server:** a member-owned taste model (real Garmin heart rate) that any AI assistant can call over MCP, with consent per read and a hash-chained audit log. |
| [`docs/feeling-line-2046-earlier-concept.md`](docs/feeling-line-2046-earlier-concept.md) | The earlier, bigger concept ("The Feeling Line"), kept as history. |

## Run the prototypes

**Reaction Lab** (any modern browser, Python 3 for the static server):

```bash
cd prototypes/reaction-lab
bash scripts/fetch-model.sh     # one-time model download (Apache-2.0, see models/README.md)
python3 -m http.server 8046     # open http://localhost:8046
npm test                        # the algorithm, tested headlessly
```

**Taste model + MCP server** (Node ≥ 18, zero dependencies; Chrome for Web Bluetooth):

```bash
cd prototypes/taste-model-mcp
npm run check                   # self-test incl. audit tamper detection + MCP handshake
npm run reset                   # rebuild the simulated member's model
npm start                       # stage page on http://localhost:4046
```

Then connect Claude Desktop (`npm run check` prints the config) and a Garmin watch, or press **S** for a simulated heart. Full guide: [`SETUP.md`](prototypes/taste-model-mcp/SETUP.md).

Both prototypes implement the concept's privacy stances for real: sensing off by default, all inference on-device, consent before any heart read, deletion that actually deletes. The member "Daan" and his history are simulated; no real body data ships in this repo.

## License

Code: **MIT** (see [LICENSE](LICENSE)). The paper, signals and research documents: **CC-BY-4.0** (remix with attribution). Third-party assets keep their own licenses: the MediaPipe face model (Apache-2.0, fetched, not committed) and the vendored mermaid bundle (MIT, license included).

Netflix and all title names are trademarks of their respective owners and are used here only as references in a speculative concept study.
