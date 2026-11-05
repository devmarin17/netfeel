# How the Reaction Lab reads you (v1)

You watch a clip. A face model running **on your laptop** reads your face about ten times a second. Nothing is recorded — no video, no photos, only numbers. At the end you get a **Feeling Receipt**, and over time the app learns which feelings work on you. Here's how, in plain language.

## First, it learns *your* face

Faces differ. Some people rest with a faint smile; some brows sit low. So the first 3 seconds of every session are calibration: the app takes a snapshot of your neutral face, and **every reading after that is measured as "you, minus your resting face."** We compare you to you, never to anyone else. If the camera only came on later (nothing readable in those first 3 seconds), the app estimates a baseline from the first face readings it *does* have and flags the receipt as approximate — and it keeps retrying once a second until a real baseline exists. No baseline without a face, ever.

## The seven signals

The face model reports 52 "blendshapes" — think of them as muscle sliders, like *left lip corner up*. We combine them into seven signals, each scored 0 to 1:

| Signal | What we look at | Why it counts |
|---|---|---|
| **Joy** | lip-corner raise (**70%**) + raised cheeks (**30%**) | The clearest "this is working" sign. The cheeks matter: a real laugh raises them, a polite smile doesn't. |
| **Surprise** | inner brows up (**40%**) + widened eyes (**35%**) + dropped jaw (**25%**) | Shock and jump-scares — the body's "what was THAT" moment. |
| **Tension** | knotted brow (**45%**) + pressed lips (**40%**) + rolled lower lip (**15%**) | Concentration, suspense, holding back emotion. The raw material of thrillers and tearjerkers. |
| **Drowsy** | eyelids sitting well below your open-eye level (clip average), plus a still head | Your eyes don't fully close when you're nodding off — they *droop*. One blink proves nothing (blinks are fast); the clip-level average, combined with how little your head moves, is what turns droop into drowsiness. |
| **Attention** | head turned less than 25° sideways, 20° up-or-down | Are you looking at the screen at all? Looking away is the honest "losing me." We allow a soft fade out to ~40° so drifting isn't all-or-nothing. |
| **Lean-in** | your face filling ~5% more of the frame than at calibration | You don't lean toward things you don't care about. |
| **Behaviour** | pausing, seeking back, skipping, % watched | The strongest signal of all: what you *do*. Skipping says more than any eyebrow. Pauses and backward seeks each add a small recapture cost to engagement — a viewer who pauses ten times isn't watching like one who sat straight through. |

## From signals to feelings

Four feelings, mixed from the signals:

- **Laugh** = joy. Straightforward.
- **Thrill** = surprise (**40%**) + tension (**35%**) + lean-in (**25%**). The classic scare cocktail: startled eyes, knotted brow, and you edging toward the screen.
- **Calm** = drowsiness **gated by** steady attention and no surprises. Drowsiness is the gate: an alert, wide-awake viewer scores ~0 here, because *watching TV isn't calm*. Heavy lids, a still head, eyes on the screen, nothing startling — that's the calm lane.
- **Moved** = tension (**45%**) + inner-brow rise (**55%**), **turned down** by smiling or startle. That inner-brow lift is the universal "this touches me" face. If you're grinning or jumping, it isn't tenderness.

A clip's score for each feeling is **half your average reaction, half your single biggest moment** — so a clip with one great laugh isn't punished by its quiet stretches.

## The Feeling Receipt

After each clip you see: the dominant feeling, all four scores (0–1), your **engagement** (attention × how much of the clip you watched, damped slightly per pause and backward seek), the **top 3 moments** — timestamped peaks, like "you laughed at 0:42" — and a **state-hit**: did the clip's intended feeling match what you actually felt, with a score of at least 0.35? We chose that bar because faces idle above zero; anything lower is noise, not a reaction. If the baseline had to be estimated from a late camera start, the receipt says so.

## Your taste profile, and what it recommends

The profile keeps, **per feeling tag**, how strongly clips with that tag actually move you (a moving average — your first clip of a tag sets the value, later ones shift it by ~40%, so it tracks who you are now), plus your hit rate, engagement and skip rate for that tag.

When you ask *"what do you want to feel?"*, unseen clips with that tag are ranked by:

> **how well the tag works on you × how much you engage with that tag × a penalty for anything you skipped before**

Clips you already watched to the end are never served again. Every recommendation comes with its reason in plain words, citing a real moment: *"Laugh clips work on you (65%) — last time you laughed at 0:10 in 'Stand-up bit'."*

## What it honestly doesn't know

No heart-rate in this prototype (that's the wearable lane — see `prototypes/taste-model-mcp`, which reads a real heart rate). It can be fooled by sunglasses, bad lighting, or a very still poker face. "Moved" and "thrill" can blur, because both raise the inner brow. And watching is not feeling — that's why behaviour (skip, % watched, pauses, seeks back) tempers any single eyebrow. The camera is always your call: off by default, off whenever you want (a failed camera start stops every track immediately), and nothing but numbers ever leaves the moment.
