# models/

The face-landmark model binary is **not committed** to this repository.

## What it is

- **File:** `face_landmarker.task` (~3.6 MB)
- **Model:** MediaPipe **Face Landmarker**, float16, version 1 — a TFLite bundle that
  outputs 52 facial blendshapes + a 478-point face mesh, used fully **on-device**
  in your browser via `@mediapipe/tasks-vision`.
- **Provenance:** downloaded from Google's pinned release URL:
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- **License:** Apache-2.0 — Copyright (c) Google. MediaPipe model cards list
  Apache 2.0; no frames, images or video ever leave your machine when using it.

## Get it

```bash
bash scripts/fetch-model.sh        # or: npm run fetch-model
```

Reaction Lab loads `models/face_landmarker.task` at runtime. Without the file,
the camera button will fail to start the landmarker — the fetch script is the
one setup step.
