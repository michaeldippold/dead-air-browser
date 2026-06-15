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
- **Simulation** — SIR-based local spread (bell curve, peaks at 50% ratio), inter-district spread (probabilistic), unit suppression, activity system (ENGAGE / HIDE / SCAVENGE), combat with wound states
- **Person/Unit model** — Person is the core type; units are containers; loot drops on death with 40% transfer to district pool; scavenging activity
- **Director system** — `register()` for polling beats, `on()`/`emit()` for sim hooks (`person-death`, `unit-disbanded`, `unit-enters`); auto-registers from script `trigger` fields
- **`when.*` vocabulary** — `zombiesIn`, `gameTime`, `humansGone`, `unitIn`, `random`, `allOf`, `anyOf`; `triggerToCondition()` maps script trigger descriptors to condition functions
- **Script system** — narrative scripts as ES modules in `scripts/`; scripted callers are `sim:false` Persons protected from combat; 4 characters live: E. Novak, Marcus Webb, Danny, Dep. Dir. Holt
- **COMMS feed** — time + location + body layout, static separators between transmissions, no age-based dimming
- **Game clock** — 9:00 AM start, 5 min/tick (12 ticks/hour), full night ~15 real minutes at 3.5s/tick
- **Map** — SVG districts, Paper Map palette, unit dots by leader role, click to open unit detail
- **Roster** — EXPANDED / CONDENSED / BY DISTRICT views, activity badges, drag-and-drop dispatch
- **Theme system** — 6 palettes (Terminal Green, Morning Coffee, Midnight Purple, Cyberpunk, Windows 95, Blood Moon), live switcher, localStorage persistence

---

## v0.9.0 — Story & Stakes

> The gap that matters most: there is no win condition. Players have no destination.
> Fix that, add stakes to events the player currently misses, and fill out the story.

- [ ] **Win condition — survive to dawn.** Pick a tick count that represents first light. Wire a win-state check into the Director. The win screen should feel like a rumor that turned out to be true.
- [ ] **Notification / Alert system.** A popup layer for events the player must not miss — distinct from COMMS (ambient) and Contacts (requires action). First use: unit disbanded. Closeable via button or Escape. General enough that Director events, story beats, and district overrun can all push to it later.
- [ ] **Sandra Hill narrative arc.** Already in the ambient caller pool — promote to a full scripted arc.
- [ ] **Rescue scenario.** A story beat that fires when a unit enters a district where a scripted caller is hiding. The `director.on('unit-enters', ...)` hook is already wired and has never been used.
- [ ] **The Oblivious Guy** (levity caller). Calls about something completely unrelated. Does not believe in zombies. Resolves peacefully regardless of game state. No stakes — just tone balance.
- [ ] **Sound Tier 1 — interface sounds only.** Drop `.wav` files in `sounds/`, call `new Audio(...).play()` in button handlers. No infrastructure needed. Lock the AudioContext unlock to the START MISSION click so everything fires freely after that.
- [ ] **Code cleanup.** Remove dead CSS (`.task-btn--utility` is now unused). Audit stale TODO comments in source. Review `WINDOW_THEMES['morning-coffee']` in JS — it was built for per-window use and may be vestigial now that the global theme system exists.

---

## v1.0.0 — Presentable

> 1.0 means a stranger who didn't build this can pick it up and understand it.
> That requires onboarding, sound that makes the world feel real, and consequences that make the map matter.

- [ ] **Onboarding / Tutorial.** The first caller a new player gets is a scripted tutorial — walks through the interface before the real chaos starts. Panel spotlight mechanic: CSS class on `#desktop` dims all panels except the one being described. Tone: in-universe, interrupted by the real situation. Short; offer a skip on the start screen. Covers: map, contacts, dispatch roster, COMMS.
- [ ] **Sound Tier 2 — ambient loops.** Small `AudioContext`-based manager with gain nodes for crossfading (~50 lines). API: `audio.playAmbient('id')`, `audio.stopAmbient()`. Midnight gets its own loop, triggered via `when.gameTime(0, 0)` Director beat.
- [ ] **Sound Tier 3 — event-triggered.** Wire Director hooks to stings: `person-death`, `unit-disbanded`. Script nodes get an optional `sound` field played on node entry. `broadcastEvent` accepts an optional sound param.
- [ ] **District consequences with gameplay weight.** OVERRUN: loot inaccessible, spread rate penalty, unit effectiveness reduced, distinct COMMS language. SECURED: slowed reinfection, distinct COMMS callout. Both are visual-only right now.
- [ ] **Start the pure data removal pass.** Replace unit HP numbers with status words (HEALTHY / WOUNDED / CRITICAL). Single render change, meaningfully shifts the game toward its intended feel. Don't remove zombie counts yet — one step at a time.

---

## Backlog (v1.1+)

These are good ideas that aren't load-bearing for the core experience yet.

### More Levity Callers
- **The Prank Caller** — periodic, never useful, hangs up before you respond.
- **The Song Request Guy** — calls repeatedly until answered once. Yells a song request for a song that doesn't exist. Never calls again. Needs a `one-shot-acknowledged` resolve type.

### Combat Mechanics
Does unit damage scale with unit size? Currently each person gets one attack roll per tick regardless. Larger units may feel more powerful through survivability alone, but concentrated firepower scaling is an open question.

### Windowed UI Flavor
Fake desktop icons, a desktop background that sells the dispatcher's office. Once the flavor of the dispatcher role is locked, this makes the whole thing feel like a place rather than a UI exercise.

### Right-Click Context Menus
`e.preventDefault()` on `contextmenu` event opens up right-click actions on districts (assign nearest unit, check intel). Add after core dispatch UX is stable. Note: suppresses browser Inspect shortcut during gameplay — fine in production.

### Unit-Scoped Morale
A morale meter on the Unit (not individual persons). Drops on bad outcomes, rises on success. Affects combat effectiveness or response time. Design after the core loop is tuned.

### Full Pure Data Removal
- No zombie counts visible to player — just density words (CLEAR / LIGHT / HEAVY / OVERRUN)
- God mode removed from player-facing UI entirely
- The only source of truth is COMMS and the callers

---

## Known Issues / Polish

- Window resize from N/W edges doesn't clamp (can push off-screen — low priority)
- Contrast audit still needed in some panels — target: anything intentionally dim should still be legible; only decorative/idle elements near-invisible
