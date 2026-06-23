# Dispatch — TODO / Scratchpad

> Provisional. Not a changelog. Things move around here.

---

## Design North Star

The long game is this: **the player never gets clean numbers.** The simulation runs in the background with full fidelity, but everything the player sees is mediated — through a radio feed, a voice on the line, a unit's last transmission, a map color that's going the wrong way. You have an engine on one side, a player on the other, and a machine in the middle that turns state into narrative.

The current god mode is a dev tool, not a game mode. Eventually it disappears entirely (or becomes a late-game unlock that feels like cheating). The player should be flying *mostly* blind and making good decisions anyway. That's the skill expression.

**The win screen is a myth — and that's intentional.** Winning requires both skill and luck. The backend randomization makes it genuinely hard. If players finished a full run and assumed a win state didn't exist, that is the correct experience. It's about the decisions under pressure, the radio going quiet, the moment a district goes dark. Not the end state. Design every feature with this in mind: don't optimize for winning, optimize for meaningful play until you lose. The win screen exists, but it should feel like a rumor.

**Simulation speed is load-bearing.** The pace needs to give players enough time to understand the interface before they lose. Too fast and it becomes an RTS — reflex-based, click-heavy, not the target. The goal is: you lose, but you feel like you *almost* had it. You were reading the radio, you were dispatching, you were trying to understand the map — and the city still fell. That's the feeling.

---

## What's Shipped

The core loop is operational. Key systems in place:

- **Windowed UI** — CONTACTS, DISPATCH, MAP, COMMS, ITEMS, SITREP windows, taskbar, pin/minimize/maximize
- **Simulation** — SIR-based local spread (bell curve, peaks at 50% ratio), inter-district spread (probabilistic), unit suppression, activity system (ENGAGE / HIDE / SCAVENGE), weapon-based combat (gun 0.50 / fire-axe 0.25 / unarmed 0.10 hit chance) with wound state modifiers on rolls
- **Win/lose conditions** — Win: survive to dawn (06:00, 600 ticks). Lose 1: all units dead. Lose 2: 10+ districts reach ≥75% zombie ratio (CITY FALLEN). Lose 3: units lost ≥ limit (SITUATION UNCONTAINABLE). All three wired into the tick loop.
- **Person/Unit model** — Person is the core type; units are containers; `MAX_UNIT_SIZE = 4` cap; loot drops on death with 40% transfer to district pool; scavenging activity
- **Director system** — `register()` for polling beats, `on()`/`emit()` for sim hooks (`person-death`, `unit-disbanded`, `unit-enters`); auto-registers from script `trigger` fields
- **`when.*` vocabulary** — `zombiesIn`, `gameTime`, `humansGone`, `unitIn`, `random`, `allOf`, `anyOf`; `triggerToCondition()` maps script trigger descriptors to condition functions
- **Script system** — narrative scripts as ES modules in `scripts/`; scripted callers are `sim:false` Persons protected from combat; 4 characters live: E. Novak, Marcus Webb, Danny, Dep. Dir. Holt
- **COMMS feed** — time + location + body layout, static separators between transmissions, no age-based dimming
- **Game clock** — night-shift timeframe: 20:00 start, 1 min/tick (60 ticks/hour), win at dawn 06:00 (600 ticks), full night ~30 real minutes at 3s/tick. `ticksFor()`/`gameTime()`/`gameDay()` are generic over the constants, so this needed no logic changes — just `GAME_START_HOUR`, `MINS_PER_TICK`, `TICK_MS`. One script fallout: Holt's `game-time` trigger was hardcoded to absolute hour 11 (meaningless once the clock no longer starts at 9:00 — `ticksFor()` clamped it to 0, firing him instantly); remapped proportionally to hour 21 to preserve his original ~10%-into-the-night pacing. `SPREAD_RATE`/`spreadChance` deliberately left unscaled despite ticks now firing 5x more often per game-hour — accepted as a real difficulty increase, not retuned to match old pacing.
- **Map** — SVG districts, 3 map palettes (Tactical Dark / Post-it / Paper Map), unit dots by leader role, click to open unit detail; legend bar removed
- **Dispatch screen** — CARDS / BADGES layouts, always district-grouped with visible headers, role-colored SVG leader stars (encodes role + leader status in one glyph), floating layout select at bottom-right; unit detail view with LOCATION / CURRENTLY DOING / ROSTER / ITEMS sections, dispatch dropdown defaults to current location; layout select hidden when detail view is open
- **Theme system** — 7 palettes (Terminal Green, Terminal White, Morning Coffee, Midnight Purple, Cyberpunk, Windows 95, Blood Moon), live switcher, localStorage persistence; unified `.game-select` style across all dropdowns; PAUSE button in topbar
- **Difficulty system** — `SCENARIOS` object with `numDistricts`, `totalZombies`, `distribution`, `spreadChance`, `delay` fields; `seedFromScenario()` picks random non-government districts with Fisher-Yates shuffle; Standard / Developer modes; spread rate and zone grid are Developer-only
- **Code cleanup** — dead `.task-btn--utility` CSS removed; `WINDOW_THEMES` per-window override system removed; terminal green COMMS panel now inherits the global theme instead of frozen coffee colors; First Aid Kit code aligned with description (50 HP threshold, 20 HP restore)
- **Unit travel time** — `computeHopDistances()` BFS over `adjacency`, generic `state.transits` (`kind: 'unit' | 'person'`, only `'unit'` produced so far), `dispatchUnit()` sets `districtId: null` and queues a transit instead of teleporting, `resolveTransits()` runs on its own unconditional `setInterval` decoupled from the gated `tick()` loop (ready for pre-game tutorial use later). TRAVELING panel in the MAP window shows 2-letter route codes and a smooth real-second countdown — each transit stores a wall-clock `etaMs` set once at dispatch, refreshed by its own 1s display interval, decoupled from `TICK_MS` so it counts down 1 at a time instead of jumping in tick-sized chunks. Each in-transit unit's dot gets a flashing red/blue siren glow (`.traveling-dot--siren`, `box-shadow` `@keyframes` with flat plateau stops at `0%, 49.9%` / `50%, 99.9%` — a sparse 2-keyframe version blended through a muddy purple on the implicit loop-back segment, fixed by holding each color flat). Clicking a TRAVELING row reopens that unit's detail view, which shows `EN ROUTE → {district} (m:ss)` while traveling. `renderUnitsPanel()` skips in-transit units (visible only in TRAVELING, consistent with them being absent from the map too). Verified live: dispatch → smooth countdown → clean siren flash → arrival → COMMS line, no console errors.
- **Alert quieting** — removed the `showAlert('INCOMING TRANSMISSION', ...)` popup that fired every time any narrative caller (E. Novak, Marcus Webb, Danny, Holt) first called in. Too frequent to stay meaningful; the CONTACTS panel's existing unread-dot already surfaces new calls without interrupting. ALERT is now reserved for LEADER DOWN and UNIT DISBANDED — genuinely rare events.
- **Caller/Person unification + Location×Activity exposure** — every caller (ambient or scripted) is now backed by a real Person; `checkCallerSurvival()` (the old `Math.random()` flag-flip) is gone entirely. `Person` gained `location` (`outside`/`business`/`residence`) and `activity` (`hide`/`default`/`scavenge`) fields. `effectiveThreatMod()` now computes exposure as `role weight × LOCATION_MOD × ACTIVITY_MOD` for everyone — units are treated as implicitly `outside` (they operate across the whole district) stacked with their existing ENGAGE/HIDE/SCAVENGE activity (a deliberate rebalance: e.g. an engaged police unit's weight went from `3` to `4.5`); standalone Persons (callers) use their own location/activity. `personsInDistrict()` now includes standalone `sim:true` Persons, not just unit members, and the combat block's old `if (districtUnits.length === 0) continue` gate is removed — so a caller alone in a zombie district with no unit present is now for-real exposed to the counterattack loop instead of a fake survival roll. A new generic `director.on('person-death', ...)` handler closes any contact whose `personId` matches, replacing the old narrative-only contact-closing logic. New ambient callers default to `location: 'residence', activity: 'hide'` (matches existing flavor text — "locked my door," "barricaded"). `scavenge` is modeled but nothing currently assigns it to a caller (no UI for it yet). Removed "Marcus Webb" from the ambient `CALLER_POOL` — it collided with the real scripted character of the same name.
- **Window-manager scripting API + script `onEnter` hook** — `closeWindow`/`minimizeWindow`/`maximizeWindow` (aliases over existing `toggleMinimize`/`toggleMaximize`), new `setWindowPosition(id,x,y)`, `setWindowOpacity(id,value)`, `spotlightWindow(id)`, `clearSpotlight()`. `setWindowOpacity` was reworked after first landing: it originally set `opacity` on the whole `.win` element (frame included), which made dimmed windows look translucent rather than "lights off." It now layers a black `.win-dim-overlay` div over just `.win-body` (titlebar stays fully visible and interactive) — `spotlightWindow` dims everything but the target window to 90% black. Script nodes gained an optional `onEnter(state, actions)` field, called from `advanceNarrativeCaller()` when a node is entered; `actions` is a small `SCRIPT_ACTIONS` capability object (the window-manager functions above + `bringToFront`/`showAlert`/`startGame`) handed to the script, since scripts are plain-data ES modules with no import access to main.js internals — this keeps that boundary intact instead of giving scripts a back door into the window manager.
- **Tutorial trigger point** — START MISSION spawns a script (`scripts/tutorial.js`) via the existing `spawnScript()` pattern instead of calling `startGame()` directly; the tutorial's final node calls the real `startGame()` to hand off (the standalone SKIP TUTORIAL button this originally shipped with is gone — see Onboarding flow, below; skipping is in-fiction now). Discovered along the way: `processNarrativeCallers()` (timers *and* choice reply-delays) was only ever called from inside the gated `tick()` loop, so even with a trigger point, a pre-game script using normal `choices`/`timer` fields would never advance — decoupled it into its own unconditional `setInterval(processNarrativeCallers, TICK_MS)`, the same treatment `resolveTransits()` got earlier this session. Also found `renderContactsPanel()` was only ever refreshed by `tick()`'s `render()`, so a contact spawned or advanced outside the tick loop wouldn't show up in the CONTACTS list — added explicit `renderContactsPanel()` calls to cover that.
- **Lexington, KY setting selected + visual rebrand** — the real-city pick (see "Real-world setting" under v1.0.0 Foundation) is settled: **Lexington, Kentucky**. The surrounding chrome matches the choice: a real Lexington-Fayette Urban County Police badge SVG sits centered on the desktop background (`#desktop-badge`); five clickable desktop icons (`#desktop-icons` — CONTACTS/DISPATCH/MAP/COMMS/ITEMS) sit top-left in a column, each an SVG over a label, wired through a new shared `focusOrToggleWindow(id)` helper that the taskbar buttons now also use (previously duplicated inline); the same icon set was added to the left of each taskbar button's label. The badge and every icon are masked from their default-black SVG source and recolored via `currentColor`/`background-color: currentColor`, so they automatically track whichever theme is active (green in Terminal Green, white in Terminal White, etc.) instead of being hardcoded white. New **Terminal White** theme (grayscale, near-black background, white text — classic command-prompt look) added alongside Terminal Green as a monochrome pairing. The topbar title reads **"DEAD AIR"** — that's the game's actual title (not the city, and not generic "Dispatch"); `#game-title` briefly read "LEXINGTON 911" mid-session before settling here. The district-rename lift is also done: every district's `label` (and the matching SVG map text + `DISTRICT_CODE` 2-letter travel code) now uses a real Lexington-flavored name — internal district IDs (`northgate`, `police-hq`, etc.) are untouched, so adjacency/loot/script triggers needed no changes. Mapping: Northgate→Joyland (JL), Millbrook→Winburn (WB), Eastridge→Castlewood (CW), Westgate→University of Kentucky (UK), Police HQ→LPD HQ (PD), Fire Station→Station No. 1 (S1), City Hall→LFUCG Govt Center (GC), Memorial→Good Samaritan Hospital (GS), Ironworks→Old Iron Works (IW), Riverside→Kendrick Ave (KA), Market District→Market St (MK), Commerce Park→Newtown Commerce (NC), Southend→The Red Mile (RM), Industrial Row→Lexington Quarry (LQ). Narrative scripts' in-dialogue references (E. Novak, Marcus Webb, Holt) and the seeded "City Hall" starter contact were updated to match. Two of these (Westgate, Southend) also got a `category` change to match their new identity — University of Kentucky is `government` (was `residential`), The Red Mile is `retail` (was `residential`) — which changes their loot pool (`LOOT_POOLS[category]`) accordingly. "University of Kentucky" is long enough that its SVG map label needed a smaller font-size override (14px vs the usual 18px) to fit its district box without overflowing. Northgate's rename went through two names in one session: it briefly became "Joyce Park" before settling on "Joyland" (JL) — a nod to the real historic Joyland amusement park, now a residential neighborhood; category stayed `residential` throughout.
- **Onboarding flow (Barbara West)** — required login (`showLoginBox`, name → `sessionStorage`, `{{name}}` interpolation via `resolveText`) gates `spawnScript('tutorial')`. The SKIP TUTORIAL button and the seeded LFUCG Govt Center starter contact are both gone — Barbara West is the only contact that exists at game start, and her in-fiction Yes/No RESPOND choice is the only skip path; both branches converge on `startGame()` → `resetLayout()`. All windows (`WIN_IDS`) start minimized via `initWindowManager()` — bare desktop, badge + icons only — and a new `revealWindow(id)` action in `SCRIPT_ACTIONS` lets scripts, not main.js, decide when each window appears; her "No" path reveals everything at once, her "Yes" path currently walks through DISPATCH only (see Tutorial Content below for what's left). RESPOND choices got a visual overhaul — 2px accent border, raised background, slow pulse, full color-invert on hover — so a live decision reads as urgent instead of blending into the panel. New CALL BACK button lets the player call back any contact, including resolved ones, appending a deduped "No response." system note and emitting a `player-callback` director event for future scripts to hook.
- **Universal call-answering mechanic** — every call except Barbara's (dialing 911 to onboard the player would be strange — see design.md, "On answering") opens with the dispatcher's own "911, what is your emergency?" line, a beat of three-dot typing delay (`chat-waiting-bounce`, staggered 0/0.15/0.3s), then the caller's actual first line — and none of it fires until the player opens that contact's thread for the first time (`maybeFireFirstOpen`, called from `showContactDetail`), not the moment the contact is created. An unopened caller carries no information at all until clicked — the literal mechanical expression of "nobody should be able to triage the call list at a glance." Ambient callers go through the identical `pendingNext`/`replyDelay` mechanism narrative scripts already used for choice replies; a `reportDistrictId` snapshot lets an unnamed "Unknown Caller" still report on the district that triggered them, resolved fresh against current zombie counts at open time rather than whatever was true when they first called. Generic non-response death spirals (a no-answer-at-all chain ending in `resolve: 'lost'`) were removed from Danny, E. Novak, and Holt's opening nodes as part of the same push — see design.md's "On silence and timers."
- **Contacts-list indicators: one "needs attention" dot, a shared connection icon, recency sort** — replaced three overlapping animated signals (whole-card opacity dimming for the dead, a flashing border for a pending choice, a dot trying to mean unread/lost/pending all at once) with two static ones. A small dot before the name is solid when `needsAttention(contact)` (unread, or a RESPOND choice still waiting) and hollow otherwise; the same connected/disconnected phone-and-arcs glyph from the contact-detail header (`phoneIconHTML()`) sits where the old dot used to — green while alive, red once not, no blink, in both places. Every message push now routes through one `pushMessage()` helper that stamps `contact.lastActivityTick`, so the list sorts flagged-first and by actual recency within each group instead of creation order.

---

## v0.9.0 — Foundation & Story

> Win/lose conditions are live. The remaining gap is structural, not just narrative: the data
> model has two different shapes of caller mixed together, "scenario" is about to mean two
> unrelated things in the same codebase, and the story is thin. This version fixes the
> foundation — Person/Contact unification, the location system, the Scenario/Difficulty split —
> so v1.0.0's content has solid ground to build on. See design.md for the concepts behind these.
> Tutorial/onboarding content also ships as part of 0.9.0 — the full onboarding flow and the
> universal call-answering mechanic are both built and shipped, see "What's Shipped" above.
> Tutorial Content below now only tracks what's left of the walkthrough itself.

### Dispatch-to-Caller & Unit Comms — the core verb *(Up Next, priority)*

> The keystone build for 0.9.0, and it unblocks tutorial Incidents. Today a dispatch is "send unit
> to district, watch it passively engage/hide/scavenge" — none of which is "help the specific
> caller I'm on the line with." Dispatch is the title of the game; it can't be an afterthought.
> This makes it the central verb: read a call → send someone → live with what they find. Most of
> the plumbing already exists (`state.transits` supports `kind:'person'`, the `unit-enters` event,
> the script `onEnter` hook, `effectiveThreatMod()` exposure math) — this is mostly wiring, not new
> systems.
>
> **Core verb shipped & verified (commits d5b2c7e / 775fe39).** The `sim`-flag resolution model
> below is settled (see design.md, People → Persons and Content System → "On resolving a call"),
> with the `sim:true` save/lose roll deferred to its first caller. Checked items are live; unchecked
> items are the real resolution layer on top of the shipped scaffold.

- [x] **Targeted dispatch from inside the call thread.** *(shipped & verified — commit d5b2c7e.)* A
  "dispatch unit" control in an *opened* contact's detail view; picking a unit sends it via the
  transit system tagged with the caller's `districtId` + `personId`, scoped to that exact caller.
  The DISPATCH-window district move stays a separate tactical action (no caller, no busy state).
  Busy units aren't re-dispatchable until their call resolves; multiple units may target one caller.
- [x] **`RESPONDING` activity (busy state).** *(shipped & verified — insulation confirmed live:
  units survived responding in a 12-zombie district, then died only after returning to ENGAGE.)* A
  unit dispatched to a caller is **fully insulated from the sim** — excluded from the counterattack
  exposure *and* from spread suppression. It neither kills nor is killed while on a call. Anchor:
  **dispatch to a district is a win-the-sim move; dispatch to a caller is a story move.**
- [x] **Units become Contacts.** *(shipped & verified.)* First dispatch (either path) creates a
  `UNIT n` contact that opens with an outbound line (`10-4 dispatch, en route to {location}`) — no
  911 opener, no reply UI, no CALL BACK. Subsequent dispatches append to the same thread.
- [x] **Unit-contact indicators.** *(shipped & verified.)* Attention dot colored by leader role
  (police-blue confirmed live); filled = unread report, hollow ring = read.
- [x] **Arrival radio chrome + `onArrive` scaffold.** *(shipped.)* Automatic `en route` / `On scene`
  chrome on every dispatch. The arrival hook calls `script.onArrive(state, actions, { contact, unit,
  roles, hasRole })` if the caller's script defines one — no script does yet, so all current callers
  hit the generic placeholder below. This hook is the primitive the old "Rescue beat" and
  "Co-location detection" items build on.
- [x] **`completeResponse(unit)` script action.** *(shipped.)* In `SCRIPT_ACTIONS`; returns a unit
  to ENGAGE. For authored callers this is **script-driven, no timer** — the script calls it when its
  beat resolves. Only the generic path uses a timer (the response window, below).
- [x] **Multi-unit: first responder owns, backups support.** *(shipped & verified — commit 775fe39.)*
  First unit to arrive owns the caller's narrative resolution (reacts / fires `onArrive` once); later
  arrivals go RESPONDING and check in on their own thread ("Supporting unit on scene") without
  re-touching the caller or re-running the script. Same-tick arrivals resolve by sequential
  ownership. Caller-gone-on-arrival (died en route) yields a "too late" outcome, not a safe one.

> **The resolution model — settled this session; the `sim` flag is the dividing line.** How a call
> *ends* is governed entirely by the caller Person's `sim` flag (full treatment in design.md, People
> → Persons and Content System → "On resolving a call"). `sim:true` = lightweight filler the sim
> resolves by roll; `sim:false` = heavyweight spine character resolved only by their script. The
> items below build the real resolution on top of the shipped scaffold. Note: **there are currently
> zero `sim:true` callers** (ambient pulled from CONTACTS; the four scripted callers are all
> `sim:false` with no `onArrive`), so the generic roll is deferred until its first consumer exists —
> the tutorial practice callers / Incidents.

- [ ] **Pass force/composition to `onArrive`.** Extend the payload to `{ contact, unit, unitCount,
  roles, hasRole }` so authored content can react to *how many* and *which* units showed up (the
  scaffold already passes `unit`/`roles`/`hasRole` — add the count). Cheap; do with the next dispatch
  touch.
- [ ] **`sim:true` generic resolution — the save/lose roll *(DEFERRED to first `sim:true` caller).***
  Replace the placeholder flavor with a real, terminal outcome: at the end of the response window,
  **one** roll weighted by responding force (more units → better odds, diminishing returns) + district
  danger. **Saved = extracted:** the Person is evacuated *off the board* — removed from the district
  and the sim, permanently safe (the guarantee that a saved caller can't die after the unit leaves —
  saving them *is* removing them from danger). **Lost = the Person dies.** Sealed at that one moment.
  This is what makes under-committing a bad call a genuine failure — and blobbing still a mistake,
  since the responding units are off the sim the whole time.
- [ ] **Resolution closure messages.** Because there's no scoreboard, every resolution must leave the
  player closure. **On a save: both the caller and the unit sign off** — the caller's final message
  is the player's only "you did good" feedback ("you got us out, thank you — we're clear"), a
  character confirming they're safe and leaving the call log for good. **On a loss: the caller and/or
  the unit report it** (a last transmission / a unit confirming what they found). Without these, a
  `sim:true` caller would silently vanish and the player would never know how they did. The sign-off
  *is* the score.
- [ ] **`sim:false` = script-only; soften the current placeholder.** A `sim:false` caller never gets
  the roll — outcome is 100% authored (arrival beat + choice/timer flow; send no help → the script's
  own beat handles it). Until real `onArrive` content is authored, the four scripted callers fall
  through to the generic placeholder, which currently prints "subject safe" without resolving
  anything. Soften that to a neutral "holding with the caller" line so it doesn't *imply* an outcome
  that didn't happen.
- [ ] **(Candidate lose condition — later, not 0.9.0)** *Failing the job itself:* too many calls left
  unanswered / unresolved over the night = you failed as a dispatcher. The purest dispatcher-failure
  loss — you didn't have to lose the city, you just stopped doing the work. Recorded in design.md
  (Win/Lose) as a candidate; needs a definition of "too many" and which calls count, and depends on
  the resolution model above (so answered/resolved can be told apart from ignored).

### Ambient callers → unit-voiced COMMS *(Up Next, lands with the above)*

> Settled this session. It resolves three previously-scattered items at once — the old v1.0.0
> "Ambient-caller / COMMS unification," the v1.0.0 "COMMS retool — police-scanner framing," and the
> backlog "COMMS Tonal Degradation" — by making them one build. The dictum "COMMS broadcasts have
> no identity" is **dead** (design.md updated): COMMS today reads like perfect information out of
> thin air; this humanizes it and makes it imperfect.

- [ ] **(Interim — do first, before the dispatch build) Pull ambient callers out of the CONTACTS
  panel without deleting the system.** Just stop them spawning/rendering into CONTACTS to clear
  panel space ahead of the dispatch verb; leave `CALLER_POOL` / `CALL_TEMPLATES` / `getCallTier()`
  and the spawn logic intact and dormant, to be repurposed into the COMMS police-chatter version
  below rather than rewritten from scratch.
- [ ] **Retheme the ambient pool as police chatter, and move it from CONTACTS to COMMS.** The
  ambient caller pool stops being civilians-in-CONTACTS and becomes off-duty / quick-response
  **police officers** radioing district status over the scanner. The player's ~6 starting officers
  are the ready quick-response teams, not every cop in the city — others exist, report in, and
  aren't dispatchable. (Minor accepted immersion cost: "why can't I send them?") This empties
  CONTACTS of identity-less filler — every CONTACTS entry is now a story, an Incident, or a unit,
  so every call is a real shot at a story. The tier/escalation system (`getCallTier`, `CALLER_POOL`,
  `CALL_TEMPLATES`, keyed off real zombie count) carries over unchanged — it now selects which
  scanner line an officer in that district radios. The named-vs-unknown *civilian* distinction is
  dropped (deliberate reversal of the old "keep it" note — it's officers now). COMMS should read
  like the dispatch-log example: officers in districts calling in, dispatcher acknowledging.
- [ ] **Per-district COMMS degradation = the fog of war.** The same scanner lines garble as the
  *reporting district's* zombie ratio climbs — per-district, not a global clock, so a calm district
  still sounds calm while an overrun one sounds like hell at the same moment. Structured radio
  discipline ("be advised, 10-96…") corrupts over time into static, fragments, panic, screams — the
  officer is fighting to survive, not filing a clean report. A fully overrun district can go
  **silent** on the air (no more officers reporting) — silence as information, a small pocket of
  real fog. This is the early-warning radar *and* the fog of war in one mechanism: not blind, but
  the information decays exactly when the player most needs it clean. Implementation is word-level
  static replacement on the existing message strings, gated by district state — no new content
  pool needed.
  - **Resolved (naming):** ambient officers are labeled by **badge number** — a stand-in for the
    current ambient-caller name, revisitable later since it's purely a label. The player's
    dispatchable units stay `UNIT 2/3`, so "UNIT n" remains unambiguously the things you can send.
    One constraint to honor: a given badge number shouldn't be radioing in from six different
    districts within a few minutes — keep a badge tied to a plausible single location for a while.

### Tutorial Content

> Full first-time flow is built and shipping — see "What's Shipped" above (Onboarding flow,
> Universal call-answering mechanic, Contacts-list indicators) for what login → Barbara West →
> Yes/No → game-start actually does today, in detail. What's left here is finishing the
> walkthrough content itself: only DISPATCH is covered so far on the "Yes" path. Dead Air–
> specific scenario content is explicitly deferred until the walkthrough is fully fleshed out
> with plain reused caller content (see Scenario System below) — don't design that yet.

- [ ] **Broaden SCRIPT_ACTIONS as the walkthrough grows.** `revealWindow` got added this round because the script needed it. Explicit reminder, not a spec: expect more of the same as the rest of the walkthrough (below) gets written — add hooks when the content actually needs them, not ahead of time.
- [ ] **Finish the panel walkthrough.** Currently Barbara's "Yes" path only covers DISPATCH. Still needed: MAP, COMMS, ITEMS introduced the same way (reveal + spotlight), window min/max/reposition demonstrated, and 1–2 real scripted dispatches using the already-shipped travel system (not faked) — advancing on `unit-departs`/`unit-enters` at the right moments. Zero zombies seeded, main tick loop not running, but the decoupled `resolveTransits()` loop already runs independently, so travel still counts down in TRAVELING in real time.
- [ ] **Two practice callers — fire and police framing.** Spawn via the existing `spawnScript()`-style one-off mechanism, reusing today's plain caller content (civilian-role Person/contact, no real fire/crime simulation) — just narratively framed as "a fire" and "a police matter" so the player practices dispatching to specific unit roles. Explicitly not the Incidents system (still unbuilt, see Narrative Clock & Caller Arcs below) and not Dead Air content — deferred per design discussion.
- [ ] **End-of-tutorial handoff transit.** On her last node (after the practice dispatches), create a `kind: 'person'` transit record with `srcId: 'tutorial'` destined for a chosen residential district, then call `startGame()`. Needs a `'TU'` pseudo-code added to `DISTRICT_CODE` first — the TRAVELING row would otherwise show `??→XX`.
- [ ] **Tutorial colleague pickup as a real Person.** On arrival (existing `resolveTransits` + a new `person-arrives` event), she becomes a normal `sim: true` Person sitting in that district — exposed to the real simulation like anyone else from that point on. Makes her pickup-able as a recurring character later with no special-casing: once she lands, she's just a Person.

### Foundation

- [x] **Split the start screen into real SCENARIO and DIFFICULTY dropdowns.** Shipped: `#scenario-select` (`Dead Air` default, `Random`) and `#difficulty-select` (`Standard` default, `Apocalypse`, `Custom` — the renamed "Developer" mode, still gated behind `#custom-controls` with the same spread-rate slider + zone grid). No "Story" tier, per decision above.
- [x] **Rename `SCENARIOS` → `DIFFICULTIES` in code**, including `seedFromScenario()` → `seedFromDifficulty()`. Folded into the dropdown split above.
- [x] **Add an Apocalypse difficulty preset (mirrors Standard for now).** Literal copy of Standard's numbers with a `TODO: tune harder` comment — verified live, selecting Apocalypse seeds 12 zombies across 3 districts same as Standard. `Custom` stays special-cased in `startGame()`, not folded into the `DIFFICULTIES` data.
- [x] **Wire up `Dead Air` / `Random` scenario selection (no-op content for now).** `state.scenarioId` is set from `scenarioSelect.value` in `startGame()` — plumbed through, no branching content yet (that's Scenario System below).

- [ ] **Named story locations + contact message labels.** The exposure-multiplier core of the Location system has shipped (see "What's Shipped" below) — what's left is the authoring layer: 2–3 named story locations per district, created only when a script needs one (e.g. "Old Iron Works Loading Dock" for Webb), and surfacing the location as a text label in contact messages (e.g. "Marcus Webb — Old Iron Works, Loading Dock"). Right now every standalone Person's `location` is just `outside`/`business`/`residence` with no name and no display anywhere.
- [ ] **Outside-as-travel for callers.** Telling a caller to relocate puts them into Outside for a real exposure window — high risk, on foot, much higher per-hop danger than a unit's vehicle travel (see Unit Travel Time, v1.0.0). This is what makes player advice to civilians carry real weight instead of being a free suggestion. Exact tick duration for a transit window is an open tuning question, not urgent.
- [ ] **Co-location detection.** Director hook that fires when two specific Persons (sent independently to the same named location) are both present — the mechanism that makes long Scenarios with multiple intersecting characters possible without new infrastructure. Shares the targeted-arrival primitive from Dispatch-to-Caller (Up Next) — build on top of it, don't reinvent.

### Scenario System

- [ ] **Build the Scenario concept.** A Scenario selects which 1–3 named "spine" characters are active for a run, distinct from Difficulty (see the rename above) — chosen independently at the start screen. Scenario length is a dial: short = one character, a tight arc; long = multiple characters whose paths can intersect via co-location.
  - **Open question, unresolved:** how do the four existing scripted characters (E. Novak, Marcus Webb, Danny, Dep. Dir. Holt) map onto this system? One default scenario containing all four, or split across multiple? They're currently all always-on with no selection involved, which doesn't fit the new model as-is — needs a decision before this can be built.
  - **Resolved: yes, bias seeding, never guarantee it.** Picking a Scenario should weight initial zombie placement toward its anchor character's trigger district, making the call likely without forcing it on a fixed timer — a guaranteed/time-locked trigger would make the beat predictable on replay. Treat it as a probability nudge on top of whatever the chosen Difficulty's normal seeding does, not a separate forced placement.
- [ ] **Difficulty-banded filler pools.** Ambient/Incident content tagged by which difficulty band it's appropriate for, drawn only from the matching band — so randomizing filler timing doesn't accidentally compound with a hard difficulty pick into a brutal outlier run (or a trivial one on hard). The difficulty flag belongs on the script/pool entry, not on the spawned Person.
- [ ] **"Random" scenario option.** No guaranteed named arc, draws more heavily from filler — replay variety for players who've already seen the authored scenarios.

### Narrative Clock & Caller Arcs

- [x] **Removed generic "Ignored path" non-response death spirals from Danny, E. Novak, and Holt** (see "What's Shipped" — Universal call-answering mechanic). `holt-lost` was kept — it's shared with the legitimately-authored `holt-dig-in` path. `danny-quiet`, `danny-dark`, `webb-silent` were left alone on purpose — soft non-engagement lines, not death spirals, to be re-authored later when these scripts get a real pass.
- [ ] **Danny rewrite — full call-response-only arc.** Planned for after the tutorial script is finished: a much longer Danny arc where the player's choices actually save or lose him, not the placeholder 3-choice version that exists today. He's already `sim: false` (every `spawnScript`'d character is, by construction) — re-evaluate whether he should flip to `sim: true` as part of the rewrite, same open question already tracked above for Marcus Webb.
- [ ] **Narrative clock scripts.** Time-based Director beats for: pre-dawn opening context (ambient COMMS), first midnight (tone shift — this should be the one fixed, always-fires structural beat of the night), overnight atmosphere. Infrastructure ready — `{ type: 'game-time', hour: N }` triggers work. Non-interactive beats go directly in `main.js` as `director.register()`; interactive callers go in `scripts/`. Red herring / non-zombie early scripts to break up info density — Incidents, below, covers most of this need already.
- [ ] **Decide per-scripted-character `sim` flag.** The generic `person-death` → contact-closing handler shipped (see "What's Shipped" below) — what's still open is whether any of the four scripted characters should actually be killable by the sim instead of purely authored. Danny, Novak, and Holt should likely stay `sim: false` since their arcs are built around an authored ending; Marcus Webb is a good candidate for `sim: true` — he's explicitly in a dangerous district and his script already references losing someone, so it would be more honest if the sim could kill him too. Not yet decided or changed.
- [ ] **Sandra Hill narrative arc.** Was a named entry in the old ambient caller pool; once that pool is rethemed as anonymous police chatter (see *Ambient callers → unit-voiced COMMS*, Up Next), she's no longer "in" anything — author her fresh as a full scripted CONTACTS arc. Needs the same Scenario-mapping decision raised above: does she belong to an existing scenario, get her own, or stay scenario-independent? (RESPOND-choice visibility is no longer the blocker for this one — that fix is now promoted into Tutorial Content above, since it's needed much earlier than this arc. No naming collision with the tutorial colleague — she's Barbara West now.)
- [ ] **Rescue beat** *(renamed from "Rescue scenario" — "Scenario" now means something specific elsewhere, don't reuse the word)*. A story beat that fires when a unit enters a district where a scripted caller is hiding. Now a thin content layer on the targeted arrival hook (see Dispatch-to-Caller, Up Next) — not a new mechanism. The generic `unit-enters` event stays wired for non-targeted arrivals.
- [ ] **The Oblivious Guy** (levity caller). Calls about something completely unrelated. Does not believe in zombies. Resolves peacefully regardless of game state. No stakes — just tone balance. This is effectively the first instance of the Incidents category below — treat it as the template.
- [ ] **Incidents — non-zombie scripted events.** Fire calls, crime calls, welfare checks, false alarms — the routine 911 work that makes the world feel real and doubles as tutorial content (see Tutorial Content above). Reuses the existing script node format (text/choices/timer/resolve) exactly, just shorter and without a persistent named identity. Zero simulation overhead by design — no district property, no new tick phase, no item requirement (a fire truck has a hose because it's a fire truck). The real stakes are opportunity cost — a unit on a call enters the `RESPONDING` busy state (see Dispatch-to-Caller, Up Next) and can't engage zombies elsewhere while handling it. Some Incidents should be deliberately ambiguous about whether they're zombie-related at all (a welfare check that's probably nothing) — reinforces that the player can't sort calls by importance at a glance.

---

## v1.0.0 — Presentable

> 1.0 means a stranger who didn't build this can pick it up and understand it.
> That requires onboarding, a functional dispatch screen, real district consequences, a setting that feels specific, and the narrative feeling alive.

### Map & Units

- [ ] **Screen reactivity.** Contested districts blink or pulse. Fallen (overrun) districts go visually dark / all-black. Both respond to the sim without player input, making the map feel alive.
- [ ] **District consequences with gameplay weight.** OVERRUN: loot inaccessible, spread rate penalty, unit effectiveness reduced, distinct COMMS language. SECURED: slowed reinfection, distinct COMMS callout. Both are visual-only right now. This is the district-wide complement to the per-caller location-safety decay (v0.9.0 Foundation) — not a duplicate: location decay affects one Person's exposure, this affects everyone operating in the district, including units. The "distinct COMMS language" piece here is already most of the way handled by the per-district COMMS degradation in 0.9.0 (an overrun district's scanner chatter is already breaking down) — extend that, don't build a second COMMS path.
- [ ] **Real-world setting.** **City picked: Lexington, Kentucky** (see "What's Shipped" — the topbar title, desktop badge, and overall chrome already reflect this). What's left is the deeper rename: real, specific place names for districts (e.g. the actual hospital name instead of "Memorial") to ground the world; worth deciding what the city's declining industry was (steel? auto parts? textiles?) since that detail should flavor caller voice, not just signage. Bigger lift than a simple rename: district IDs are referenced throughout `main.js` (state, adjacency, loot pools) and in every script's `district` trigger field. Not needed for v0.9.0, but must land at or before v1.0.0 — changing the name after people have already seen it undercuts the first impression. **The map redraw is explicitly negotiable, not required** — renaming can happen directly on the existing district polygons, geography be damned. A redraw with more regular shapes and consistent corner orientation is a nice-to-have that can slide to v1.1+ without blocking 1.0 if it's not worth the time.

### Audio / Atmosphere

- [ ] **Sound Tier 1 — interface sounds only.** Drop `.wav` files in `sounds/`, call `new Audio(...).play()` in button handlers. No infrastructure needed. Lock the AudioContext unlock to the START MISSION click so everything fires freely after that.
- [ ] **Sound Tier 2 — ambient loops.** Small `AudioContext`-based manager with gain nodes for crossfading (~50 lines). API: `audio.playAmbient('id')`, `audio.stopAmbient()`. Midnight gets its own loop, triggered via `when.gameTime(0, 0)` Director beat.
- [ ] **Sound Tier 3 — event-triggered.** Wire Director hooks to stings: `person-death`, `unit-disbanded`. Script nodes get an optional `sound` field played on node entry. `broadcastEvent` accepts an optional sound param.
- [ ] **COMMS retool — police scanner framing.** Current format (`[time][LOCATION] STATUS TEXT`) reads like a structured log line, not overheard radio. Retool toward how an actual scanner sounds — callsigns, "go ahead," cross-talk, garbled fragments — same underlying event data, more human delivery. *The ambient-report half of this is promoted to 0.9.0 — see "Ambient callers → unit-voiced COMMS" (Up Next). This v1.0.0 entry now covers the remaining non-ambient COMMS lines (event broadcasts, dispatcher acks, unit-thread echoes) so they share the same scanner voice.*

### Systems

- ~~**Ambient-caller / COMMS unification.**~~ **Promoted into 0.9.0 and resolved as a design** — see *Ambient callers → unit-voiced COMMS* (Up Next). The relocation to COMMS, the tier-system carryover, and the named-vs-unknown question all live there now (with the latter deliberately reversed: it's police officers, not named/unknown civilians). The old "COMMS broadcasts have no identity" tension is gone — that rule was retired, not worked around.

- [ ] **Citizen groups forming mid-game.** As the situation escalates, survivor groups should contact dispatch and become dispatchable units — distinct from the scripted callers, these are emergent. A mid-game Director beat spawns a new civilian unit in a non-overrun residential district and opens a contact. Gives the player late-game roster relief and makes the world feel populated. (Spawned Persons aren't subtracted from the district's crowd count — Persons and the crowd are separate ledgers; see design.md.)
- [ ] **Search for survivors activity.** New unit action alongside ENGAGE/HIDE/SCAVENGE. Each tick: very low base chance (~1–2%) to find a survivor — spawns them as a new no-item member of the unit, fires an alert notification, emits a director event (`survivor-found`) for story beats. Flashlight in unit inventory boosts the chance slightly (maybe 1.5×). Across a full run this should happen ≤5 times across all units — rare enough to feel like an event. (Same note as above: a found survivor is a new Person, not deducted from the district's crowd count.) Secret sauce: `director.on('survivor-found', ...)` is where scripted arcs can hook in.
- [ ] **New items: knife, flashlight.** Knife: 0.15 hit chance, melee-only, added to loot tables (not spawned). Flashlight: no combat value, boosts survivor-search odds, added to loot tables; ~1/3 of starting civilian squad members spawn with one. Expand the **More items** list too: bolt cutters (unlocks certain loot), flare (reveals adjacent districts without binoculars), megaphone (civilian morale / zombie aggro mechanic). (No fire-hose item — Incidents, above, don't need one; a fire truck has a hose because it's a fire truck.)
- [ ] **Start the pure data removal pass.** Replace unit HP numbers with status words (HEALTHY / WOUNDED / CRITICAL). Single render change, meaningfully shifts the game toward its intended feel. Don't remove zombie counts yet — one step at a time.

---

## Backlog (v1.1+)

These are good ideas that aren't load-bearing for the core experience yet.

### More Levity Callers
- **The Prank Caller** — periodic, never useful, hangs up before you respond.
- **The Song Request Guy** — calls repeatedly until answered once. Yells a song request for a song that doesn't exist. Never calls again. Needs a `one-shot-acknowledged` resolve type.
- Both are good fits for the Incidents category (v0.9.0) — non-zombie, scripted, no/low stakes.

### Combat Mechanics
Does unit damage scale with unit size? Currently each person gets one attack roll per tick regardless. Larger units may feel more powerful through survivability alone, but concentrated firepower scaling is an open question.

### Windowed UI Flavor
Fake desktop icons, a desktop background that sells the dispatcher's office. Once the flavor of the dispatcher role is locked, this makes the whole thing feel like a place rather than a UI exercise.

### Right-Click Context Menus
`e.preventDefault()` on `contextmenu` event opens up right-click actions on districts (assign nearest unit, check intel). Add after core dispatch UX is stable. Note: suppresses browser Inspect shortcut during gameplay — fine in production.

### Unit-Scoped Morale
A morale meter on the Unit (not individual persons). Drops on bad outcomes, rises on success. Affects combat effectiveness or response time. Design after the core loop is tuned.

### Terminal Window
A dedicated TERMINAL window where game actions can be driven by typed commands — for fast typers and keyboard-preferrers. Example: `/dispatch 1 westgate` dispatches Unit 1 to Westgate; returns a success line or an error code if the unit or district isn't found, or the unit is already there. Ideally covers the most common actions first: dispatch, set activity, check district status. The window itself fits the aesthetic perfectly — it's already a game about sitting at a computer. Low priority but high ceiling; build after the core UX is fully stable so the command vocabulary doesn't drift.

### Map v2 — Infrastructure & Atmosphere
The current SVG map is right-angle polygons with flat fills, which reads well as a tactical CAD display and is correct for v1. When the map becomes a growth area again, the upgrade path is:

- **D3.js for pan/zoom.** `d3.zoom()` bound to the SVG — single call, gives smooth pinch/scroll zoom and drag-pan. Data joins for updating district state without touching the DOM manually.
- **SVG layers as `<g>` elements.** Dead simple to add: each infrastructure type (power grid, water mains, road network) is a `<g>` toggled with `display: none/block`. No new abstraction needed. Click a layer button, show/hide the group.
- **Canvas overlay for atmosphere.** Draw a `<canvas>` on top of the SVG at `position: absolute`. Use it for fog-of-war gradients, rain particle effects, static/flicker effects when a district goes dark. Canvas is cheap and doesn't affect SVG hit detection.
- **Unit transit paths.** When a unit is dispatched, animate a dot along a straight SVG line from origin to destination. Low implementation cost, high clarity payoff.
- **City shape.** Right angles are intentional and readable — a realistic street grid is secondary to the tactical aesthetic. Revisit only if the map becomes a major feature with zoom and street-level detail.

Build none of this until D3 is worth pulling in for other reasons too (e.g. data visualization in the SITREP panel).

### COMMS Tonal Degradation
**Promoted into 0.9.0 with a concrete mechanism** — see *Ambient callers → unit-voiced COMMS* (Up Next), "Per-district COMMS degradation." The old vague "tone shifts based on how the run is going" is now pinned down: per-district zombie ratio drives word-level static replacement on the scanner lines, so degradation is local and legible rather than a global mood dial.

### Camera Feeds
Faked CCTV-style windows showing animated loops — a dark street silhouette, rain on pavement, lightning that strobes the scene for a frame. Pure AV flavor, zero gameplay information, but enormous atmosphere payoff at fullscreen. Implementation: a single looping GIF or canvas animation per feed, maybe one or two feeds max. Pairs naturally with ambient rain audio from the sound system. Think how much Project Zomboid wrings out of its isometric camera — the same principle applied to a static feed. Build this last, after the Terminal window, once the rest of the game is solid enough that flavor is the marginal gain.

### Military Unit Type — National Guard
A late-game Director event unlocks a military contact once certain conditions are met (e.g., N hours survived, N districts lost, a specific story beat). Calling in the National Guard spawns one or more military units — a fourth role type distinct from police/fire/civilian. Higher base threat modifier, armed with a machine gun item (higher hit chance or multi-kill per attack roll). Arrives with fanfare and changes the tone of the endgame significantly. The "you almost didn't need us" feeling if the player has held on long enough.

### Full Pure Data Removal
- No zombie counts visible to player — just density words (CLEAR / LIGHT / HEAVY / OVERRUN)
- God mode removed from player-facing UI entirely
- The only source of truth is COMMS and the callers

---

## Known Issues / Polish

- Window resize from N/W edges doesn't clamp (can push off-screen — low priority)
- Contrast audit still needed in some panels — target: anything intentionally dim should still be legible; only decorative/idle elements near-invisible
