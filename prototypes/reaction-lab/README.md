# Reaction Lab

A working NetFeel prototype: watch a clip, a face model on the laptop reads your reaction on-device, and the app recommends what to watch next for the feeling you want. See [SPEC.md](SPEC.md) and [ALGORITHM.md](ALGORITHM.md). Clips can be local files or pasted YouTube links (via the YouTube IFrame Player API) — both get an intended-feeling tag and work exactly the same.

## Run it

```bash
cd prototypes/reaction-lab
bash scripts/fetch-model.sh      # one-time: download the face model (see models/README.md)
python3 -m http.server 8046
# open http://localhost:8046
```

## Test it

The scoring algorithm (`algorithm.js` + `signals.js`) is deterministic and tested headlessly — no browser or camera needed:

```bash
npm test          # 9 synthetic-viewer tests (laughing, bored, sleepy, thrilled, moved, robustness…)
```

This prototype is part of the **NetFeel 2046** design fiction — a concept study, not affiliated with Netflix. See the repo README for the full story and the disclaimer.
