# Tech to 2046 — Technologies Reshaping Entertainment

**Curated from:** the project's raw research notes (evidence window 2024 – mid-2026; every claim carries a source URL + date in the raw file).
**Maturity tags:** **[shipping]** = in daily commercial use · **[scaling]** = shipping, growing fast, costs falling · **[emerging]** = real products/trials, not yet mainstream economics · **[speculative]** = no credible near-term path, but worth scenario use. Claims flagged **[unverified]** could not be independently confirmed — do not cite without checking.

---

## Summary table

| Tech | Maturity 2026 | Credible 2046 state | Entertainment impact |
|---|---|---|---|
| **Generative video** (Sora/Veo/Runway/Kling-class) | **[scaling]** — broadcast-quality insert shots ship in Netflix/Amazon originals; but consumer AI-video app (Sora) *shut down* Apr 2026 on compute cost | AI handles shots, versions, localization, previz inside every pipeline; full AI features at episodic quality normal; features still hybrid human+AI | Cost of "one more episode / one more cut / one more language" collapses; personalized edits of the same master |
| **Likeness / voice rights infra** | **[scaling]** — Disney–OpenAI $1B deal, SAG-AFTRA consent regimes, estate opt-outs | Machine-readable rights ledgers; actor licensing like music publishing | "Casting" becomes a licensing operation; estates of dead stars are ongoing revenue lines |
| **Virtual production / LED volumes + cloud post** | **[shipping]** — $2.8B market 2025; Netflix merged Scanline+Eyeline into AI-native "Eyeline" | Gen-AI + LED hybrid stages; virtual scouting standard; post fully cloud, AI-assisted | Location shoot shrinks; global distributed crews; shots rendered "in camera" with AI backdrops |
| **AI VFX & localization** (rotoscope, dubbing sync, visual dubbing) | **[scaling]** — El Eternauta gen-AI shot 10x faster; Deepdub/Flawless/Papercup at studio grade | Any title instantly in 50+ languages with synced lip-flap and matched voice | Every show is natively global; dead/re-aged actors vocally sustainable |
| **Live streaming at scale** | **[scaling]** — 65M concurrents (Tyson–Paul 2024); pain → fixed for NFL/WWE 2025–26 | 100M+ concurrents routine, near-zero latency; interactive live overlays | Live is Netflix's arena moat; real-time fan participation formats |
| **Game engines as media** (UE6, UEFN) | **[scaling]** — UE6 merges UE5+UEFN; creator payouts + item sales since Dec 2025 | Engine-made interactive worlds mainstream TV-adjacent; watch→play inside the stream | Netflix's cloud-game-on-TV strategy matures into "playable episodes" |
| **Displays: TV OS, glasses, hologram venues** | **[shipping]** (TV OS) / **[emerging]** (Ray-Ban Display $799; ABBA Voyage) / **[speculative]** (home holograms) | TV remains hub; light AR glasses mainstream; venue-scale "impossible concerts" a global circuit | Interface ownership = ad/data money; destination venues = premium event tier |
| **Voice/AI agents on TV** | **[scaling]** — Netflix AI search (May 2025), Gemini for Home rollout | Conversational agent is the remote; agent assembles your viewing | Discovery → dialogue; bundling + personalization wars |
| **BCI** | **[emerging medical]** — Neuralink ~20+ patients, cursor control only; Synchron $200M to commercialize | Medical BCI for thousands; consumer BCI = light, command-level at best | Accessibility-driven narrative formats; NOT thought-streamed movies |
| **Networks / compute** | **[shipping]** AV1 on 30% of Netflix; **[constraint]** AI ≈0.5% of world electricity 2025, grid limits | Codec + edge keep pace; compute/energy is THE governing constraint on "infinite content" | Energy-aware entertainment economics become a plot-level force |
| **AI companionship / hyper-personalization** | **[scaling]** — 64% of US teens use chatbots; Character.AI bans under-18 open chat; EU AI Act labeling Aug 2026 | Regulated companion layers around IP; personalized narrative slots with disclosure labels | Characters that talk back — with compliance plumbing as a differentiator |

---

## 1. Generative video — [scaling], with a major reality-check

**State (2025–26):** Sora 2 shipped cameos (verified likenesses in generated video) — but the consumer app died: ~1M users peak, **compute cost never officially disclosed — estimates ranged ~$1M–$15M/day**, **shut down April 26, 2026** (OpenAI); Disney's linked **$1B** licensing deal (200+ characters generatable in Sora) died with it, after SAG-AFTRA/WGA open letters and estate revolts (MLK, Robin Williams). Model leadership is contested: Sora 2 Pro ranked *below* ByteDance **Seedance 2.0**, **Runway 4.5**, **Kling 3.0** (Artificial Analysis, early 2026); Veo 3 added native synchronized audio (May 2025). Cost curve: per finished minute down **~97%** in two years — **$0.50–$30 vs $1,000–$50,000** traditional *for suitable shots*. Studios actually use it: **El Eternauta** (Netflix, Apr 2025) — first GenAI final footage in a Netflix original, "**10 times as fast**" (Sarandos, Jul 17, 2025 call); *House of David* (Amazon): 73 AI shots S1 → **~212 in S2**; *Critterz* (OpenAI): AI feature under **$30M**, ~9 months.
**Trajectory (2027–30):** consistency (character/physics across scenes) is the frontier and improves every generation; realistic near-term: minutes-long fully generated segments at TV quality by ~2027–28; AI-assisted hybrid episodes standard at Netflix scale now.
**Credible 2046:** generation is a commodity layer inside editing tools; scarce goods = **rights, taste, compute, brand trust**. A 2046 "episode" is a master scene-graph (OpenUSD-style) compiled into thousands of personalized renders (language, rating, length). Synthetic stars are expensive *rights* objects; live human stars command premiums precisely because they're un-replicable. The Sora shutdown keeps pitches honest: **demand without unit economics dies**.
**Unlocks:** instant zero-marginal-cost localization; de-aging as a normal tool; format revivals from licensed likenesses; micro-budget prestige one-offs; previs→final collapse (iterate a scene in hours).

## 2. Production technology — [shipping]/[scaling]

**State:** virtual-production LED market **$2.8B (2025) → $5.9B (2033f)**; China debuted the largest LED volume (270° curved). Netflix merged **Scanline VFX + Eyeline Studios** into one AI-native **"Eyeline"** brand (Oct 2025) and publishes a Virtual Production Playbook + partner infrastructure specs. **Netflix Media Production Suite** puts dailies/post in the cloud — edit/VFX/color/grade are already location-agnostic. AI dubbing stack at studio grade: **Deepdub, Flawless TrueSync (visual dubbing — re-animated lip-flap), Papercup, Respeecher**. **[unverified]** press reports of a Netflix GenAI *dubbing* pilot on El Eternauta specifically — cite the VFX case, treat the dubbing pilot as directionally true but uncited. Live lesson: Paul–Tyson **65M concurrents with 1M+ buffering reports** (Nov 2024) → hardened into clean NFL/WWE delivery 2025–26 (Open Connect + AWS + multi-CDN). Standards: **OpenUSD** ("the HTML of 3D") — new Characters/Motion/Interactivity group, Mar 2026.
**Trajectory:** LED panel costs fall ~15–25%/yr; AI VFX shot costs down ~90%+ in two years; cloud post standard; robotic cameras/virtual scouting **[emerging — confirm numbers before citing]**.
**Credible 2046:** AI-native pipelines where previz, simulation and final converge — "do the shot" iterates in hours on a cloud stage with LED walls showing GenAI worlds; shoots shrink to actor-days; physical locations become premium creative choices, not economic requirements.
**Unlocks:** local-language star casts via visual dubbing; greenlights on creative merit as VFX floors collapse; live global events as recurring tentpoles; sustainable production (fewer flights, smaller builds) — an ESG angle execs care about.

## 3. Real-time engines as media — watch + play convergence — [scaling]

**State:** **Unreal Engine 6** announced: UE5 and **UEFN merge into one engine** — dev content runs in Fortnite. UEFN creator economy: monthly payout pool = **40% of Fortnite net revenue**; since **Dec 2025 creators sell items directly on their islands** (up to 100% of profits). Precedent: Travis Scott "Astronomical" (2020): **45.8M attendees** across five shows. Netflix: **"cloud-first" games on TVs is the 2026 focus** (Peters) — 100+ titles streamed to TVs, no console, in the membership.
**Trajectory:** engine and stream converge — the same session graph renders as a passive episode OR a playable scene; cloud rendering removes the console gate (Netflix already streams input-rendered video to dumb TVs at small scale).
**Credible 2046:** "playable episodes" and persistent narrative worlds are standard catalog categories; creators (not just studios) build licensed Netflix universes with revenue share; live interactive formats (game shows, sports companions, crowd-play) ride the live infrastructure.
**Unlocks:** franchise depth (fans *live* in the world between seasons); a new mid-budget format class; a play-telemetry data moat for personalization — with obvious privacy caveats.

## 4. Displays & immersion — [shipping]/[emerging]

**State:** TV OS wars: **Roku, Fire TV, Google TV lead** North American installs (Samsung Tizen trails despite hardware dominance) — the OS owner owns the boot screen, the ad slot, the data. **The Vision Pro lesson [cautionary]:** $3,499 → M5 refresh flopped → **Apple all but gave up (MacRumors, Apr 29, 2026)**; no successor in development. Premium headsets did NOT become mass media by the late 2020s. The real ambient signal: **Meta Ray-Ban Display, $799 with Neural Band (Sept 30, 2025)** — strong sell-through; true-AR consumer Orion reportedly ~end-2027 [reported, not confirmed]. Venue-scale: **ABBA Voyage: >1.5M tickets, >$150M sales** — actually a 65-million-pixel LED wall, not holograms; **Light Field Lab home holograms [speculative]** [gap: verify install list before citing]. Spatial audio quietly ships (Atmos premium; AMBEO fallback).
**Trajectory:** glasses get lighter and cheaper; venues multiply on the ABBA model (build once, screen the digital performer forever).
**Credible 2046:** the TV stays the hearth; **lightweight AR glasses are the phone's companion** (glanceable, spatial captions, personal second-screen overlays — e.g., watch parties where each viewer's glasses carry a personal, spoiler-silent audio layer over the same broadcast). Destination venues are a normal premium tier; home holograms stay niche.
**Unlocks:** interface ownership as the next distribution war; glasses as a personal channel over shared content; venue circuit for streamed IP; spatial audio as the cheapest immersion upgrade.

## 5. Interfaces & input — [scaling]/[emerging]

**State:** **Netflix AI search** (from May 7, 2025): natural-language, mood-based discovery ("funny and sad, like a heist…") built on OpenAI models; AI-tailored ad formats from Q4 2025. **Gemini for Home** replaces Google Assistant; Google opened an MCP server so third-party agents (Claude, ChatGPT) control devices — signal: *agents, not apps*, become the interface. Eye tracking: research/ad-tech only (Tobii); consumer TVs do NOT ship with couch-distance eye tracking. Haptics for watching TV: **[speculative]**. **BCI — honest assessment [emerging, medical only]:** Neuralink ~21+ patients, cursor/text control — *a high-bandwidth mouse, not a media channel*; Synchron raised **$200M (2025)** for commercialization; market ≈ **$6.2B by 2030** (WEF) — medical need, not Netflix subscribers.
**Trajectory:** conversational, proactive discovery ("build tonight's watchlist from my family's moods"); attention analytics live in ad-tech, not living rooms; glasses are the more credible 2046 attention sensor.
**Credible 2046:** the agent layer is the platform war — whoever's agent curates owns the customer. Implanted BCIs serve thousands-to-low-millions of *patients* (accessibility is the real, dignified use case — pitch it that way); consumer "thought interface" media stays **[speculative]**. Holograms-in-the-brain is science fiction within this evidence base.
**Unlocks:** accessibility-first interactive formats (BCI + eye + voice as one stack); conversational discovery; attention-verified ad formats; the agent as the next battleground.

## 6. Network & compute — the physics and economics layer — [shipping]/[constraint]

**State:** **AV1 powers ~30% of all Netflix viewing** (⅓ less bandwidth than AVC/HEVC, ~45% fewer rebuffers). No Netflix 8K stream — perceived quality (HDR, neural upscaling, film-grain synthesis) beats pixel count. Latency: LL-HLS/CMAF delivers 0.5–3s glass-to-glass; WebRTC-class for <500ms. Cloud gaming: market **$3.2B (2025) → $33.7B (2033f)**; **Microsoft capped Xbox Cloud Gaming at 15 hrs/month from Nov 2026** — a cost-discipline signal. The hard wall: **AI consumed ≈0.5% of world electricity in 2025**; data centers on path to **~1,050 TWh by 2026**; the Sora app died partly on its compute bill (estimates ranged ~$1M–$15M/day, never disclosed).
**Trajectory:** codecs + edge keep pace; bandwidth per experience keeps *falling*; interactive live at broadcast scale requires dense edge compute.
**Credible 2046:** **compute/energy is the new distribution scarcity** — whoever controls cheap inference controls what entertainment can exist. Expect carbon-aware scheduling, regional AI capacity, and "synthetic content budgets" as real production-planning concepts.
**Unlocks:** edge-rendered interactive TV; energy-cheap regions become creative hubs; "ambient quality" decouples experience from bitrate — good for global-south reach.

## 7. AI companionship & hyper-personalization — [scaling] + [regulated]

**State:** **64% of US teens use AI chatbots** (Pew, Dec 9, 2025). Character.AI banned open-ended chat for under-18s after wrongful-death suits; **Kentucky AG sued (Jan 8, 2026)** — first state suit against a companion company. Market-size numbers diverge wildly ($6.8B–$36.8B by definition) — flag ranges. Netflix's AI is currently *operational* (search, ads, VFX), not companion-facing. Digital-resurrection norms are unsettled: BBC Maestro's AI Agatha Christie course (estate-approved, controversial), Suzanne Somers' AI twin, Zelda Williams' pleas, "digital right to be dead" unrecognized in law. **[unverified]** viral reports of a BBC "Bring Back…" AI special — do not cite without checking.
**Trajectory:** personalization grows discovery → format → co-creation, inside a legal box: **EU AI Act Article 50 transparency (labeling synthetic content) broadly applicable from Aug 2, 2026**; SAG-AFTRA consent regimes tighten each contract round. PwC's anchor: personalization grows *alongside*, not instead of, live/shared experiences.
**Credible 2046:** every personalized/synthetic experience ships with provenance metadata (C2PA-style), consent chains for likenesses, age-appropriate companion guardrails. **Compliance becomes a feature** ("verified human-made" and "verified consented" badges).
**Unlocks:** characters that talk back (licensed, rated, labeled); adaptive episodes (difficulty/length/mood rails); trust as premium positioning; children's formats with audited companions.

---

## Tech rules for a credible 2046 pitch

1. **Compute is the script's budget line.** Sora's app died under a compute bill estimated at $1M–$15M/day; El Eternauta's AI shot was "10x faster," not free. Any format assuming near-free infinite generation must name its energy/compute economics. Overhyped: "AI makes content free." Underestimated: **energy-aware production planning** as an executive discipline.
2. **Rights are infrastructure, not paperwork.** Disney paid $1B for character licenses; SAG-AFTRA made consent a workflow; estates have opt-out switches. No likeness-rights plumbing story = not credible to a production exec.
3. **The TV stays the hearth; glasses are the penumbra.** Vision Pro's retreat vs Ray-Ban Display's $799 traction: ambient AR *over* shared screens beats headset-native worlds. Design living-room-first, ambient-second.
4. **Live is the moat that was actually built.** 65M concurrents (2024) → clean weekly NFL/WWE (2025–26): the boring hardening happened. Interactive live at 100M+ is the *earned* assumption; per-viewer-customized live is the stretch.
5. **Personalization grows discovery → format → co-creation, inside a legal box.** AI search (2025) → adaptive episodes (2030s) → labeled co-created content (2040s). EU AI Act Article 50 and companion-safety case law are the rails; unlabeled "infinite content" is already illegal in major markets.
6. **Localization is the sleeping giant.** AI + visual dubbing (Deepdub/Flawless/Papercup) makes every 2046 title natively 50-language with synced faces — the single most under-scoped unlock in student pitches.
7. **Open standards are the quiet plot.** OpenUSD ("HTML of 3D") + AV1 (30% of Netflix) = scene-graph-driven, codec-agnostic, edge-rendered media. A concept that names its data standards reads as engineered, not imagined.
8. **Assume regression to human, not replacement by machine.** PwC's own headline: "digital innovation drives demand for human experiences"; ABBA Voyage grossed $150M+ on nostalgic humans watching digital doubles *together*. Durable 2046 formats fuse cheap synthetic capacity with scarce live/human presence — BCI, haptics and home holograms are accessibility/niche layers, not mass media.

---

## Hat tips to the forecasters

Predictions worth citing — with their provenance *and* their track records:

1. **PwC Global E&M Outlook 2026–2030** (27th ed., Jun–Jul 2026): industry **$3.5T (2025) → $4.2T (2030)**, 3.4% CAGR; advertising overtakes consumer spending; live experiences strongest growth. Track record: five-year aggregates are the industry's base rates, but PwC has under-forecast CTV ad growth before. (pwc.com/outlook)
2. **Mary Meeker / BOND, "Trends – Artificial Intelligence"** (May 2025): ChatGPT to ~800M users in ~17 months — fastest consumer adoption ever; AI cost curves collapse while capex explodes. Track record: called mobile/social correctly 2010–2016. (bondcap.com/report/pdf/Trends_Artificial_Intelligence.pdf)
3. **"AI 2027" scenario** (Kokotajlo et al., Apr 2025): AI automating senior software work by 2027, runaway recursion. Use as **upper bound, not base case** — Marcus and others argue it over-extrapolates; parts already dated. (ai-2027.com)
4. **WEF**: BCI market ~$6.2B by 2030; the famous 2016 "you'll own nothing" predictions aged badly — a cautionary tale about extrapolating consumer sentiment. (weforum.org)
5. **IEA / Our World in Data** (2026): AI ≈0.5% of world electricity 2025; data centers toward 1,050 TWh — **energy as the binding constraint**. (ourworldindata.org; brookings.edu)
6. **Pew Research** (Dec 2025): 64% of teens use chatbots — the behavioral base rate for companion-media futures. (pewresearch.org)
7. **Forecaster humility, from inside this file:** Vision Pro "spatial computing era" (2023) → program shelved (2026); cloud gaming's decade of under-delivery vs hockey-stick market reports; and conversely GenAI went from Sora demo (Feb 2024) to broadcast VFX (Jul 2025) in 17 months — *faster* than forecasts — yet the consumer product died Apr 2026 — *slower* than the hype, in different places. The lesson: hype curves are not one curve.
