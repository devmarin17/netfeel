# Taste Model MCP — Setup and run on your Mac

*NetFeel 2046 concept prototype. Daan (28, Amsterdam) is a simulated member; his taste model is real code, and the heart rate from your Garmin is real.*

What it does, in one line: **Claude Desktop asks Daan's taste model for something to watch → the stage page shows the pick, why, and "paid placement: none" → your live Garmin heart rate feeds the model and re-ranks the pick.**

```
Claude Desktop ──(local connector)──► mcp-server.js ─┐
                                                     ├─► data/taste-model.json  (Daan's model, the vault)
Chrome: localhost:4046 ◄── server.js ◄───────────────┘        ▲
      ▲  live heart rate (Web Bluetooth)                       │
      └── Garmin "Broadcast Heart Rate" ── streamed + "Re-rank" ┘
```

No `npm install` needed: zero dependencies, only Node.js.

---

## 1. Get the code (once)

```bash
git clone https://github.com/devmarin17/netfeel.git
```

```bash
cd netfeel/prototypes/taste-model-mcp
```

Check Node (needs v18 or newer):

```bash
node -v
```

No Node? Install the LTS version from nodejs.org (or `brew install node`).

## 2. Self-test and get your Claude config (once)

From `prototypes/taste-model-mcp`:

```bash
npm run check
```

It tests the model and the connector, then **prints the exact config for your Mac** (with your paths).

## 3. Connect Claude Desktop (once)

1. Claude Desktop → **Settings → Developer → Edit Config**. That opens `~/Library/Application Support/Claude/claude_desktop_config.json`.
2. Paste the JSON that `npm run check` printed. If the file already has `"mcpServers"`, add only the `"netfeel-taste-model": {…}` entry inside it.
3. Quit Claude Desktop fully (**Cmd+Q**) and open it again.
4. In a new chat, the tools icon should list **netfeel-taste-model** with 4 tools. The first time it's used, Claude asks for permission: choose **Always allow** (so no pop-up during a demo).

## 4. Start the stage page (every time)

From `prototypes/taste-model-mcp`:

```bash
npm run reset
```

```bash
npm start
```

Open **Chrome** at http://localhost:4046 and go full screen (**Ctrl+Cmd+F**).

## 5. Connect the Garmin (every time)

1. On the watch: turn on **Broadcast Heart Rate**. On the **Fenix 6** (per Garmin's manual): open the heart rate widget, hold **MENU** → **Heart Rate Options** → **Broadcast Heart Rate**, then press **START**. It only advertises while that screen is running (a Bluetooth icon shows). Other models vary: look under **Sensors & Accessories → Wrist Heart Rate**. Tip: add "Broadcast Heart Rate" to the controls menu (hold LIGHT) for one-tap access.
   Not showing in Chrome? Quit other apps/phones reading the watch's heart rate (a BLE sensor serves one app at a time), then press **Shift+C** on the stage page to list every nearby Bluetooth device.
2. Mac: **System Settings → Privacy & Security → Bluetooth** → allow **Google Chrome** (first time only).
3. On the stage page press **C** (Connect watch), pick your Garmin in Chrome's pop-up. The big number and the vitals turn live.

## 6. Test the whole loop (2 minutes)

1. In Claude Desktop type: **"Something to switch off after work, done by 23:00. Work tomorrow."**
2. Claude calls the model → the stage page shows **Our Planet** with reasons and **PAID PLACEMENT: NONE · audit A0001**.
3. On the stage page press **F** (Re-rank with my heart). If your heart rate is about 12 or more above your resting heart rate (with the default resting 62: from 74 bpm; a smaller bump deliberately keeps Our Planet), the pick re-ranks to **Headspace Guide to Sleep**, with ♥ reason lines. Close to resting → "plan as usual" (honest).
4. Optional, in Claude: **"Open my taste model"** → the vault: what his body taught it, what it avoids, paid placements ever: 0.
5. Press **R** to reset before the next run.

## 7. Trailers (already done; change one only if a video disappears)

All 25 titles and the 3 Easter-egg videos have a verified YouTube id in `data/catalog.json` (checked with YouTube's oEmbed: the video exists and may be embedded; Netflix's own channel wherever one exists, regional Netflix channels for Midnight Diner and Ares). Videos can still be taken down later: check them again before a demo with `node -e` over the catalog, or just click through the tiles. To replace one:

1. Find the official trailer on YouTube (the stage page shows a "find it on YouTube ↗" link).
2. Copy the 11 characters after `watch?v=` (e.g. `https://www.youtube.com/watch?v=AbCdEfGhIjK` → `AbCdEfGhIjK`).
3. Paste into `"youtube_id": ""` for that title in `data/catalog.json`. No restart needed.

Without an id, a neutral title card ("Trailer not available in this demo") is shown instead.

---

## Demo walkthrough (40 seconds)

Setup before you start: `npm run reset` → `npm start` → Chrome full screen on the stage page (hard refresh: Cmd+Shift+R) → Garmin connected (the big number is live) → Claude Desktop in a fresh chat, one Cmd+Tab away. The page opens on your live heart and nothing else: that is the first beat.

| Time | Do | Say |
|---|---|---|
| 0–10 s | Stage page full screen: only your heart is showing | "This heart rate is mine, right now, from my watch. Daan, the member in our model, is simulated. The heart is not." |
| 10–20 s | Cmd+Tab to Claude Desktop, type: *Something to switch off after work, done by 23:00. Work tomorrow.* | "He doesn't open Netflix. He asks his assistant." |
| 20–30 s | Cmd+Tab back: the trailer and the pick land, your heart moves to the right | "His assistant called *his* taste model. Netflix built it, Daan owns it. One pick and why, from his body, not his clicks. And look: paid placement, none." |
| 30–40 s | Press **F**. The page asks *Share this heart read with your model?* Press **F** again (Share once) | "It asks me first: share once, or skip. I share… and it changes its mind: I'm running hot, so it picks a stronger wind-down. The algorithm asks, the body answers." |

Bridge to 2046: *"That's 2026, on a watch you already own. In 2046, it's how every evening starts."*

**Encore (10 s, optional):** in Claude Desktop type *Get me fired up, I want to watch a mountain bike race. Done by 23:00.* (or press **B** on the page). Jackson Goldstone's Hardline run appears, marked Off-script, still "Paid placement: none". Say: "There are no bikes in Daan's diary. It still knew what to do with 'fired up'."

## Troubleshooting

| Problem | Do this |
|---|---|
| Claude Desktop doesn't respond / no internet | On the stage page: **Get tonight's pick** (or press **A**). Same model, same pick. |
| Claude answers but doesn't call the connector | Settings → Developer: is **netfeel-taste-model** running? After any config change quit Claude Desktop (Cmd+Q) and reopen it. |
| Watch won't connect | Press **S**: simulated heart. Everything says "Simulated" and it starts hot, so **F** still flips the pick. |
| Watch drops mid-demo | The number greys out and the page retries for about 15 s. Then **C** (reconnect) or **S**. |
| The trailer doesn't play (offline, or YouTube removed it) | The pick, the reasons and the heart still work. Click another tile, or carry on without the video. |
| Page shows old data / looks stale | Cmd+Shift+R. Still wrong: is `npm start` running in Terminal? |
| Pick already showing from an earlier run | Press **R** (reset), or run `npm run reset`. |
| F does nothing | Click an empty part of the page first (keys pause while a text field is focused). F asks first: press **F** again to share, **Esc** to skip. For a faster run, switch off "Ask me before each read is shared". |
| Laptop dies | Play the backup screen recording (record one in advance, with QuickTime: File → New Screen Recording). |

## The page

One page, scrolling, no inner scroll areas. The top of the page (**the screen**) has two modes; **Behind the pick** (three panels: taste model, heartbeat, algorithm + audit) sits underneath in both.

- **Before a pick** (what you see on open): only your live heart, full screen height: the big number, the last 2 minutes, stress weight, vs resting, session range. Everything else is below the fold (the "Behind the pick" cue sits at the bottom edge).
- **After a pick** (from Claude Desktop or the header form): the page becomes full width. **Left, the main focus**: the trailer, big, with the pick under it: title, match, **✓ Paid placement: none** + audit id, and every reason on its own line, then what else fits tonight (click any tile to play it; the page scrolls back up to the player). **Right**: the heart panel stays beside the video (big number, chart, stress weight, vs resting, session range, and the **Re-rank with my heart** button), and follows you while you scroll.
- **Taste model (below, left)**: your taste model per feeling (tabs: calm, hype, dread, tears): hit rate, what your body taught it, what it leaves out, your resting heart rate, the audit chain (verified ✓) and paid placements: 0. **How it decides** opens a live diagram of the algorithm; the dark path is the route the last pick took. Click it for full size.
- **Heartbeat (below, middle)**: what the watch broadcasts over Bluetooth: heart rate, vs resting, **stress weight** (the exact number the model uses), HRV (RMSSD) and beat interval when the watch sends RR intervals, session low/high/avg, skin contact, battery (if shared), signal. Also the buttons: Connect, Measure resting, Re-rank, the share switch and **Backstage**.
- **Algorithm + audit (below, right)**: the diagram (open by default) and the log of what changed.
- **What 2026 can't tell (bottom, full width)**: six honest limits (heart rate is arousal, not emotion; "stress" is bpm above your own resting rate; the history is invented; the counts overlap; what 2046 could add; no watch, words still work). Use it to answer "isn't heart rate just nerves?" before it is asked.
- **Watch receipt**: press play on a trailer and the page records your heart while it plays. When the video ends (or **End & receipt**), you get a receipt: start/end/low/high bpm, whether your body reached the feeling, and what this would teach your model. **Preview only: nothing is written to the model.** If you then tell Claude how the evening went (`log_evening`), the model learns from the heart's verdict, not the claim.

## Your heart in the model

1. **Measure your resting heart rate once** (watch connected, sit still): **Measure resting · 60 s**. The median of that minute becomes your resting heart rate. It survives `npm run reset`. Until you do this, the model uses a default of 62 and the page says so.
2. **Stress weight** = how far your live heart is above resting: 0% at +4 bpm, 100% at +20 bpm, a smooth ramp in between. At 50%+ the model leans on what worked on evenings you started stressed (and stops suggesting experiments).
3. **Share my live heart with my model** (**off by default**: consent is yours to give, and the page remembers your choice): while a real watch is connected, the page streams the median of the last 30 s every 5 s. Any pick in the next 2 minutes, also from Claude Desktop, uses it automatically.
4. **Re-rank with my heart** (**F**): asks first (**consent per read**): the page shows the number it would share. **F** again = Share once, **Esc** = Skip (nothing is sent; the change log notes that you skipped). Share once feeds the read on purpose (logged in the model, valid 15 min) and re-ranks now. The switch **Ask me before each read is shared** (on by default) turns the question off if you want to go faster.
5. **Forget tonight's heart** (two clicks, so it can't happen by accident): deletes every raw heart reading: the reads logged in the model, the live trace, the watch receipt, the "Live read" lines in the change log and on the pick. It also switches sharing off. The audit log is untouched and still verifies, because it never stores raw heart rates (only the stress weight a pick used). `npm run check` tests this.

**In a demo:** sharing is off by default, so Claude's first pick is the plain one (Our Planet) and pressing **F** is the moment it changes its mind. After every **F** the page shows a banner either way ("… → Headspace Guide to Sleep" or "kept Our Planet") and a toast. If you turn sharing **on**, Claude's first pick already uses your heart, so a nervous demo-giver gets Headspace straight away (the reason line says why).

**Simulated heart (S):** a backup that starts about 20 bpm above your resting rate, so **F** flips the pick. Every label says "Simulated" and it never invents HRV, skin contact or battery.

**Stage mode (P):** hides the side panels and enlarges the pick, "Paid placement: none" and the live heart for a projector. Press **P** again to leave.

**If the watch drops:** the number greys out ("Signal lost · last read N s ago") and the page retries by itself for about 15 s. If that fails, press **C** or **S**.

## Easter egg: get fired up for biking

Say a bike word in the note and the model goes off-script on purpose (Daan's diary has no bikes in it). In Claude Desktop, try: **"Get me fired up, I want to watch a mountain bike race. Done by 23:00."** Or press **B** on the stage page (hidden shortcut, same ask as hype + "mountain bike").

- Trigger words in the note: mtb, mountain bike, downhill, Hardline, Goldstone, bike, biking, cycling.
- The pick is **Jackson Goldstone's winning POV at Red Bull Hardline Tasmania 2025** (Red Bull Bike's own upload, 4 min). "More Hardline" tiles: Asa Vermette's winning POV (Wales) and the 2022 winning POV.
- It shows an **Off-script** pill instead of a match %, a ★ first reason, and still says **Paid placement: none** (Red Bull did not pay; the audit entry is flagged `easter_egg`). It is meant to push the heart UP: press play with the watch on and the receipt judges hype (heart up ≥ 3 bpm).
- Egg titles are `easter_egg: true` in `data/catalog.json`: they never appear in a normal pick, and not in the catalog list.

## How the algorithm decides (lib/model.js)

| Step | Rule | Knob (`ALGO` in lib/model.js) |
|---|---|---|
| Fits tonight | runtime + 10 min buffer before "done by" | `settings.buffer_min` in the model |
| Leave out | a tag is left out only when even its optimistic hit rate (mean + 1 sd) is under 40%; stressed: under 50% | `avoid_upper`, `avoid_upper_stressed` |
| Tag evidence | hit rate × confidence per tag; stressed-evening counts weigh up to ×2 by stress weight | `stress_start`, `stress_full` |
| Title record | the title's own history counts like 3 evenings of tag evidence (so one good title doesn't credit all its tags forever) | `title_k` |
| Variety | −3 points for the last two titles watched; one **New for you** slot (never watched for this feeling, tags point the right way, not when stressed) | `recent_penalty` |
| Audit | every pick is logged with its inputs (clock, resting, stress weight, model fingerprint; never your raw heart rate), hash-chained so edits are detectable | |

`npm run check` tests all of this: the normal pick, the stressed flip, reset keeping your resting heart rate, and the audit chain catching an edited entry.

## Files

| File | What |
|---|---|
| `lib/model.js` | The taste model: learning, picks with reasons, audit log, live reads |
| `mcp-server.js` | The connector Claude Desktop calls (4 tools) |
| `server.js` | Local stage server on port 4046 |
| `public/index.html` | The stage page (vault + algorithm diagram · tonight's pick, player, receipt · vitals) |
| `public/vendor/` | Mermaid 10.9.1 (MIT), vendored so the diagram works offline |
| `data/catalog.json` | 25 Netflix titles with concept tags + verified trailer ids, plus 3 Easter-egg bike videos (`easter_egg: true`) |
| `data/taste-model.json` | Daan's model — readable, the vault itself |
| `scripts/seed.js` | Daan's simulated history, 1 Aug – 1 Nov (90 evenings: calm 43, hype 16, dread 16, tears 15); `npm run reset` |
| `scripts/check.js` | Self-test + prints your Claude Desktop config |
