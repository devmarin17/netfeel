# Reaction Lab — prototype spec (v1)

*A small working proof of the NetFeel sensing loop: the face reads the reaction, a personal taste model learns from it, and recommendations ask for a feeling instead of a title. Folder: `prototypes/reaction-lab/`.*

## What it does

1. You load a few videos from the MacBook. Each video gets a tag for the feeling it is meant to give: **laugh**, **thrill**, **calm** or **moved**.
2. You turn the camera on. The camera is off until you press the button, and you can turn it off at any time. This is "The Skip Button" from the concept.
3. You watch a clip. A face model reads your face about 10 times a second. It runs **on the laptop, in the browser**. No video leaves the machine, and we keep no frames, only numbers.
4. When the clip ends, you get a **Feeling Receipt**: what you felt, when the peaks were, and whether the clip hit its intended feeling (a **state-hit**).
5. Your reactions update **your personal taste profile**. The app then answers "What do you want to feel?" with a ranked list of the next clips, each with a reason.

YouTube links are out of scope for v0. They can come later through the YouTube IFrame API, which gives the same `currentTime`.

## Stack (keep it simple)

- Plain static web app: `index.html`, `style.css`, `app.js`, `signals.js`, `algorithm.js`. No build step, no npm.
- Face model: MediaPipe Tasks Vision **Face Landmarker** with blendshapes. Load the library from `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`. Download the model once to `models/face_landmarker.task` from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- Run with `python3 -m http.server 8046` inside this folder, then open `http://localhost:8046`. The camera needs localhost or https.
- Storage: the profile is kept in `localStorage`, wrapped in try/catch. "Export session" downloads JSON.

## The data contract (both workers build to this)

A **frame** — one face reading. `app.js` makes it; `algorithm.js` reads it:

```js
{ t: 12.4,            // video currentTime, seconds
  face: true,         // was a face found
  bs: { mouthSmileLeft: 0.61, ... },  // the 52 MediaPipe blendshape scores, 0..1
  yaw: -8, pitch: 4,  // head turn in degrees (from the transform matrix)
  scale: 0.23 }       // face box width / video width — a stand-in for leaning in
```

An **event** — what the viewer did: `{ t, type: "play" | "pause" | "seek" | "skip" | "end" }`.

A **clip**: `{ id, name, intended: "laugh" | "thrill" | "calm" | "moved", duration }`.

`signals.js` exports:
- `calibrate(frames)` → baseline from the first 3 s (a neutral face)
- `features(frame, baseline)` → `{ joy, surprise, tension, drowsy, attention, leanIn }`, each 0..1

`algorithm.js` exports:
- `summarize(frames, events, clip)` → the **Feeling Receipt** (shape below)
- `updateProfile(profile, receipt)` → a new profile
- `recommend(profile, library, wantedFeeling)` → `[{ clip, score, reason }]`, best first

## The algorithm, v0 — what counts

| Signal | From (blendshapes etc.) | Why it counts |
|---|---|---|
| **Joy** | `mouthSmileLeft/Right`, `cheekSquintLeft/Right` | A laugh or smile: the clearest positive reaction |
| **Surprise** | `browInnerUp`, `eyeWideLeft/Right`, `jawOpen` | Shock and jump-scare moments: arousal |
| **Tension** | `browDownLeft/Right`, `mouthPressLeft/Right`, `mouthRollLower` | Concentration, suspense, sadness |
| **Drowsy** | `eyeBlinkLeft/Right` held high, little head movement | The calm/sleep lane from NetFeel |
| **Attention** | face found and \|yaw\| < 25°, \|pitch\| < 20° | Is the person looking at all? Looking away = losing them |
| **Lean-in** | `scale` above the baseline | Moving closer to the screen = hooked |
| **Behaviour** | pause, seek back, skip, % watched | The strongest signal Netflix already has today |

Every value is taken **minus the person's own baseline**, because faces differ.

**From signals to a feeling** (the per-clip mean, plus the peaks):
- **laugh** = joy
- **thrill** = surprise + tension + lean-in
- **calm** = drowsy + steady attention + low surprise
- **moved** = tension + `browInnerUp` + low joy

**Feeling Receipt:**
```js
{ clipId, intended, felt: "laugh",        // the dominant feeling
  scores: { laugh, thrill, calm, moved }, // 0..1
  engagement: 0.82,                       // attention × % watched
  peaks: [{ t: 42.1, feeling: "laugh", value: 0.9 }],  // top 3 moments
  stateHit: true,                         // felt === intended, with a score above 0.35
  skipped: false }
```

**Profile + recommendation:**
- The profile keeps, per feeling, how strongly *you* react to clips with that tag (a moving average) and your state-hit rate.
- `recommend` ranks clips you have not seen for the feeling you want. Score = how well that tag works on you × engagement × (not skipped before). Every result comes with a reason, for example "you laughed at 0:42 in *Clip A*".

## Explicitly not in v0

No server, no accounts, no YouTube, no heart-rate. Those belong to the 2028 pilot in the fiction and are out of scope here.
