# NetFeel Taste Model (MCP)

The member-owned taste model from the **NetFeel 2046** design fiction, working today:

- a **taste model** the member owns (`data/taste-model.json` — readable, exportable, deletable),
- an **MCP server** over stdio (zero dependencies, plain Node ≥ 18) so any AI assistant — Claude Desktop, or anything that speaks MCP — can ask it for a pick,
- a **stage page** (`localhost:4046`) with a live Garmin heart-rate stream (Web Bluetooth, Chrome), tonight's pick, and the vault view,
- a **hash-chained audit log** with `paid_placement: "none"` on every pick, and **consent per heart read** (share once, or skip).

The algorithm asks; the body answers.

```
Claude Desktop ──(local MCP, stdio)──► mcp-server.js ─┐
                                                      ├─► data/taste-model.json  (the vault)
Chrome: localhost:4046 ◄── server.js ◄────────────────┘        ▲
      ▲  live heart rate (Web Bluetooth)                        │
      └── Garmin "Broadcast Heart Rate" ── streamed + "Re-rank" ┘
```

## The 4 MCP tools

| Tool | What it does |
|---|---|
| `recommend_for_feeling` | one pick for a feeling (calm / hype / dread / tears) by a deadline, with body-data reasons, alternatives, `paid_placement: "none"`, and an `audit_id` |
| `open_taste_model` | the vault: hit rates per feeling ("31 of 43 evenings"), strongest effects, avoids, ownership block, audit-chain verification |
| `log_evening` | closes the loop — prefers the **heart's verdict** (a watch receipt) over self-report |
| `audit_log` | the last entries + hash-chain tamper verification + `paid_placements_ever` (always 0) |

## Run it

```bash
npm run check    # self-test: picks, stressed-heart flip, audit tamper detection, MCP handshake
npm run reset    # rebuild the simulated member's model (90 invented evenings)
npm start        # stage page on http://localhost:4046
```

To connect **Claude Desktop**: run `npm run check` — it prints the exact `claude_desktop_config.json` entry. Full walk-through, the stage script and a failure playbook: [SETUP.md](SETUP.md).

## Design stances (implemented, not just claimed)

- **Consent per read** — the heart is shared only when you say so (share once / skip; a standing switch, off by default).
- **Forgetting is real** — "Forget tonight's heart" deletes every raw bpm; the audit chain still verifies because it never stored raw heart data (`npm run check` tests this).
- **Paid placement: never** — every pick says so and carries an audit id; the chain makes silent edits detectable.
- **The model is a file the member owns** — read it, edit it, export it, delete it.
- **Simulated member** — "Daan" and his 90 evenings are invented; no real body data ships in this repo.

This is part of the **NetFeel 2046** design fiction — a concept study, not affiliated with Netflix. See the repo README for the story and the disclaimer.
