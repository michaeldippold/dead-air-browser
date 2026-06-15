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

---

## Active / Next

### More Narrative Scripts

Four characters shipped. Future content:

**Serious (write next):**
- Sandra Hill — already in the ambient caller pool, promote to a full narrative arc
- A story beat that reacts to a unit entering a district where a scripted caller is hiding (rescue scenario) — `director.on('unit-enters', ...)` hook is already in place for this

**Levity (write when tone needs balancing):**
- **The Oblivious Guy** — calls about something completely unrelated (parking dispute, noise complaint). Does not believe in zombies. Resolves peacefully regardless of game state. No stakes.
- **The Prank Caller** — periodic, never useful, hangs up before you respond. No arc, just noise.
- **The Song Request Guy** — calls repeatedly until you answer once. Yells a song request for a song that doesn't exist. Never calls again. Needs a `one-shot-acknowledged` resolve type.

### Onboarding / Tutorial

> Do this once the core loop feels compelling and the interface is stable.

Replace early randomness with scripted direction. The first caller a new player gets is a tutorial caller — walks you through the interface before the real chaos starts.

**Panel spotlight mechanic:** as the caller describes each panel, briefly dim all others so the described one feels lit. A CSS class on `#desktop` + per-panel overrides: `#desktop.spotlight [data-panel] { opacity: 0.25 }` with an explicit override to pull the current panel forward.

**What it should cover:**
1. The map — districts, what the colors mean
2. Contacts — how to open a call, how to reply
3. The dispatch roster — what units are, how to send them
4. COMMS — what the radio feed is and why to watch it
5. "Good luck. You're on your own from here."

**Tone:** in-universe. Someone on the other end of the line — a supervisor, a recorded training line that gets interrupted by the real situation. The handoff from tutorial to chaos should feel like a gear shift, not a menu. Keep it short; offer a skip on the start screen.

---

## Backlog

### Win Condition
Currently undefined. Options:
- Survive until dawn (fixed tick count) — simple
- Secure X% of the city — spatial
- Keep a specific district (City Hall?) alive the entire game — narrative
- All three in escalating difficulty tiers

### District Consequences
- `SECURED` status: zombies cleared, slowed reinfection, maybe unlocks something
- `OVERRUN` status already exists visually — needs gameplay weight (loot inaccessible, spreads faster, unit effectiveness reduced)
- Both states should push to the COMMS feed with distinct language

### Combat Mechanics
Does unit damage scale with unit size? Currently each person gets one attack roll per tick regardless — worth revisiting. Larger units may feel more powerful through survivability alone, but concentrated firepower scaling is an open question.

### Notification / Alert System
A lightweight popup layer for events the player must not miss — distinct from COMMS (ambient) and Contacts (requires action). First use: unit disbanded. Design as a general hook so Director events, story beats, and district overrun can all push to it. User must hit the panel close button (alerts cannot me minimized or maximized) OR can close this and only this panel with an escape key hit; visually distinct enough to catch peripheral attention.

### Windowed UI Flavor
We went to the trouble of making this look like a real computer — lean into it. Fake desktop icons (maybe corresponding to the windows). A desktop background that sells the dispatcher's office: civil emergency, federal radio operator, late-night dispatch center. Once the flavor of the dispatcher role is locked, this makes the whole thing feel like a place.

### Right-Click Context Menus
Browser right-click can be fully suppressed per-element with `e.preventDefault()` on the `contextmenu` event. Opens up "right-click a district for quick actions" (assign nearest unit, check intel, set as Director target). Add after core dispatch UX is stable. Note: suppresses the browser Inspect shortcut during gameplay — fine in production, worth keeping in mind during dev.

### Unit-Scoped Morale
A morale meter on the Unit (not individual persons). Drops on bad outcomes (member lost, nearby district overrun), rises on success. Affects combat effectiveness or response time. Mostly flavor for now — gives the unit card a second axis beyond HP. Design after the core loop is tuned.

### Pure Data Removal (long game)
Eventually:
- No HP numbers on units — just status words (HEALTHY / WOUNDED / CRITICAL)
- No zombie counts visible to player — just density words (CLEAR / LIGHT / HEAVY / OVERRUN)
- God mode stays as dev tool only; not exposed in final game
- The only source of truth is COMMS and the callers

Late-stage pass. Keep in mind when adding new UI — ask "can this be expressed narratively instead?"

### Sound System

Three tiers, build in order:

**1. Interface sounds** — no infrastructure needed. Drop `.mp3` or `.wav` in `sounds/`, call `new Audio('sounds/click.mp3').play()` in button handlers. Start here.

**2. Ambient loops** — small `AudioContext`-based manager with gain nodes for crossfading. ~50 lines. API: `audio.playAmbient('id')`, `audio.stopAmbient()`. Midnight gets its own loop. Time-based triggers via `when.gameTime(0, 0)` Director beat.

**3. Narrative/event-triggered sounds** — Director and script hooks are already in place:
- `director.on('person-death', ...)` → play a sting
- `director.on('unit-disbanded', ...)` → play a sound
- Script nodes can include an optional `sound` field; `advanceNarrativeCaller` plays it on node entry
- `broadcastEvent` can accept an optional sound parameter
- Zombie density in a district can trigger ambient shifts via `when.zombiesIn()`

**Gotcha:** browsers require a user gesture before audio plays. Fix: unlock `AudioContext` on the START MISSION click so everything fires freely after that.

**Format:** `.mp3` for ambient/narrative (wide compatibility, smaller files). `.wav` for short interface sounds (no compression artifacts on clicks and snaps).

**Not doing:** voice acting. The EBS crackle vibe works because players read text while hearing noise — their brain fills in the voice.

---

## Known Issues / Polish

- Window resize from N/W edges doesn't clamp (can push off-screen — low priority)
- Contrast audit still needed in some panels — target: anything intentionally dim should still be legible; only decorative/idle elements near-invisible
