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
- **Tutorial trigger point** — START MISSION now spawns a script (`scripts/tutorial.js`, currently a minimal stub — see NEXT SESSION below) via the existing `spawnScript()` pattern instead of calling `startGame()` directly; the tutorial's final node calls the real `startGame()` to hand off. New SKIP TUTORIAL button on the start screen calls `startGame()` directly, bypassing the walkthrough entirely. Discovered along the way: `processNarrativeCallers()` (timers *and* choice reply-delays) was only ever called from inside the gated `tick()` loop, so even with a trigger point, a pre-game script using normal `choices`/`timer` fields would never advance — decoupled it into its own unconditional `setInterval(processNarrativeCallers, TICK_MS)`, the same treatment `resolveTransits()` got earlier this session. Also found `renderContactsPanel()` was only ever refreshed by `tick()`'s `render()`, so a contact spawned or advanced outside the tick loop wouldn't show up in the CONTACTS list — added explicit `renderContactsPanel()` calls in `spawnScript()` and at the end of `processNarrativeCallers()` (when it actually advanced something) to cover that. Verified live end-to-end: START MISSION → tutorial contact appears immediately with zero zombies seeded and `state.started` still `false` → spotlight dims every window but DISPATCH → a real unit dispatch resolves its full travel time pre-game-start → clicking the tutorial's choice clears the spotlight and calls `startGame()`, seeding zombies and starting the tick loop. SKIP TUTORIAL verified separately — goes straight to a normal game start, no tutorial contact. No console errors either path.
- **Lexington, KY setting selected + visual rebrand** — the real-city pick (see "Real-world setting" under v1.0.0 Foundation) is settled: **Lexington, Kentucky**. The district-rename lift described there is still open, but the surrounding chrome now matches the choice: topbar title changed from generic "DISPATCH" to "LEXINGTON 911" (`#game-title`); a real Lexington-Fayette Urban County Police badge SVG sits centered on the desktop background (`#desktop-badge`, masked white from its default-black source so it reads against the dark UI without touching the 133KB source file); five clickable desktop icons (`#desktop-icons` — CONTACTS/DISPATCH/MAP/COMMS/ITEMS) sit top-left in a column, each a white-masked SVG over a label, wired through a new shared `focusOrToggleWindow(id)` helper that the taskbar buttons now also use (previously duplicated inline); the same icon set was added to the left of each taskbar button's label via a `currentColor`-masked glyph so it tracks theme/hover/active color automatically with no extra per-state CSS; new **Terminal White** theme (grayscale, near-black background, white text — classic command-prompt look) added alongside Terminal Green as a monochrome pairing.

---

## NEXT SESSION — Tutorial Content

> The scripting infrastructure (window-manager API, `onEnter` hook, START MISSION trigger,
> SKIP TUTORIAL, the unconditional narrative-caller interval) shipped and was verified live —
> see "What's Shipped" above. `scripts/tutorial.js` exists today but is a deliberate stub (two
> nodes, no real dialogue) just to prove the plumbing works. What's left is writing the actual
> tutorial colleague and her script. The four existing scripted characters stay as-is for now
> (deferred, see Scenario System section). Read design.md's "Movement & Risk" section for the why.

### 1. Tutorial colleague & content

Day-shift handoff colleague: **female, friendly, generic coworker** — deliberately not deeply
characterized yet, since there's an open option to swap her for "a wildcard type" later. Her
script should: spotlight panels one at a time while introducing them, then walk through 1–2
*real* scripted dispatches using the actual dispatch UI and the real travel system already shipped
(not faked) — waiting on `unit-departs`/`unit-enters` to advance her dialogue at the right
moments. Zero zombies seeded, main tick loop not running, but the decoupled `resolveTransits()`
loop is already running independently (shipped, see "What's Shipped" above), so travel visibly
counts down in TRAVELING in real time regardless. She can also spawn a sample Incident-style
caller via the existing `spawnScript`-equivalent mechanism, to demonstrate CONTACTS during the
walkthrough.

**End-of-tutorial handoff:** on her last node, create a `kind: 'person'` transit record with
`srcId: 'tutorial'` destined for a chosen residential district. Note: `DISTRICT_CODE` has no
`'tutorial'` entry yet, so the TRAVELING row would show `??→XX` until a `TU` pseudo-code is added
to that lookup. On arrival (via the existing `resolveTransits` + the new `person-arrives` event),
she becomes a normal `sim: true` Person sitting in that district — exposed to the real simulation
like anyone else from that point on. This is what makes her pickup-able as a real recurring
character later without any special-casing: once she lands, she's just a Person.

---

## v0.9.0 — Foundation & Story

> Win/lose conditions are live. The remaining gap is structural, not just narrative: the data
> model has two different shapes of caller mixed together, "scenario" is about to mean two
> unrelated things in the same codebase, and the story is thin. This version fixes the
> foundation — Person/Contact unification, the location system, the Scenario/Difficulty split —
> so v1.0.0's content has solid ground to build on. See design.md for the concepts behind these.

### Foundation

- [ ] **Rename `SCENARIOS` → `DIFFICULTIES` in code.** The existing `SCENARIOS` object (numDistricts, totalZombies, distribution, spreadChance, delay) is actually difficulty presets, not story content. Do this *before* building the Scenario concept below, or the two ideas become impossible to discuss clearly in code or commit messages.
- [ ] **Named story locations + contact message labels.** The exposure-multiplier core of the Location system has shipped (see "What's Shipped" below) — what's left is the authoring layer: 2–3 named story locations per district, created only when a script needs one (e.g. "Ironworks Loading Dock" for Webb), and surfacing the location as a text label in contact messages (e.g. "Marcus Webb — Ironworks, Loading Dock"). Right now every standalone Person's `location` is just `outside`/`business`/`residence` with no name and no display anywhere.
- [ ] **Outside-as-travel for callers.** Telling a caller to relocate puts them into Outside for a real exposure window — high risk, on foot, much higher per-hop danger than a unit's vehicle travel (see Unit Travel Time, v1.0.0). This is what makes player advice to civilians carry real weight instead of being a free suggestion. Exact tick duration for a transit window is an open tuning question, not urgent.
- [ ] **Co-location detection.** Director hook that fires when two specific Persons (sent independently to the same named location) are both present — the mechanism that makes long Scenarios with multiple intersecting characters possible without new infrastructure.

### Scenario System

- [ ] **Build the Scenario concept.** A Scenario selects which 1–3 named "spine" characters are active for a run, distinct from Difficulty (see the rename above) — chosen independently at the start screen. Scenario length is a dial: short = one character, a tight arc; long = multiple characters whose paths can intersect via co-location.
  - **Open question, unresolved:** how do the four existing scripted characters (E. Novak, Marcus Webb, Danny, Dep. Dir. Holt) map onto this system? One default scenario containing all four, or split across multiple? They're currently all always-on with no selection involved, which doesn't fit the new model as-is — needs a decision before this can be built.
  - **Resolved: yes, bias seeding, never guarantee it.** Picking a Scenario should weight initial zombie placement toward its anchor character's trigger district, making the call likely without forcing it on a fixed timer — a guaranteed/time-locked trigger would make the beat predictable on replay. Treat it as a probability nudge on top of whatever the chosen Difficulty's normal seeding does, not a separate forced placement.
- [ ] **Difficulty-banded filler pools.** Ambient/Incident content tagged by which difficulty band it's appropriate for, drawn only from the matching band — so randomizing filler timing doesn't accidentally compound with a hard difficulty pick into a brutal outlier run (or a trivial one on hard). The difficulty flag belongs on the script/pool entry, not on the spawned Person.
- [ ] **"Random" scenario option.** No guaranteed named arc, draws more heavily from filler — replay variety for players who've already seen the authored scenarios.

### Narrative Clock & Caller Arcs

- [ ] **Narrative clock scripts.** Time-based Director beats for: pre-dawn opening context (ambient COMMS), first midnight (tone shift — this should be the one fixed, always-fires structural beat of the night), overnight atmosphere. Infrastructure ready — `{ type: 'game-time', hour: N }` triggers work. Non-interactive beats go directly in `main.js` as `director.register()`; interactive callers go in `scripts/`. Red herring / non-zombie early scripts to break up info density — Incidents, below, covers most of this need already.
- [ ] **Decide per-scripted-character `sim` flag.** The generic `person-death` → contact-closing handler shipped (see "What's Shipped" below) — what's still open is whether any of the four scripted characters should actually be killable by the sim instead of purely authored. Danny, Novak, and Holt should likely stay `sim: false` since their arcs are built around an authored ending; Marcus Webb is a good candidate for `sim: true` — he's explicitly in a dangerous district and his script already references losing someone, so it would be more honest if the sim could kill him too. Not yet decided or changed.
- [ ] **Contacts response options — visibility fix.** The RESPOND choices are easy to miss. Make them obviously interactive before the Sandra Hill arc ships.
- [ ] **Sandra Hill narrative arc.** Already in the ambient caller pool — promote to a full scripted arc. Needs the same Scenario-mapping decision raised above: does she belong to an existing scenario, get her own, or stay scenario-independent?
- [ ] **Rescue beat** *(renamed from "Rescue scenario" — "Scenario" now means something specific elsewhere, don't reuse the word)*. A story beat that fires when a unit enters a district where a scripted caller is hiding. The `director.on('unit-enters', ...)` hook is already wired and has never been used.
- [ ] **The Oblivious Guy** (levity caller). Calls about something completely unrelated. Does not believe in zombies. Resolves peacefully regardless of game state. No stakes — just tone balance. This is effectively the first instance of the Incidents category below — treat it as the template.
- [ ] **Incidents — non-zombie scripted events.** Fire calls, crime calls, welfare checks, false alarms — the routine 911 work that makes the world feel real and doubles as tutorial content (see Onboarding, v1.0.0). Reuses the existing script node format (text/choices/timer/resolve) exactly, just shorter and without a persistent named identity. Zero simulation overhead by design — no district property, no new tick phase, no item requirement (a fire truck has a hose because it's a fire truck). The real stakes are opportunity cost: a unit tied up on an Incident is unavailable elsewhere. Some Incidents should be deliberately ambiguous about whether they're zombie-related at all (a welfare check that's probably nothing) — reinforces that the player can't sort calls by importance at a glance.
- [ ] **Sound Tier 1 — interface sounds only.** Drop `.wav` files in `sounds/`, call `new Audio(...).play()` in button handlers. No infrastructure needed. Lock the AudioContext unlock to the START MISSION click so everything fires freely after that.

---

## v1.0.0 — Presentable

> 1.0 means a stranger who didn't build this can pick it up and understand it.
> That requires onboarding, a functional dispatch screen, real district consequences, a setting that feels specific, and the narrative feeling alive.

### Onboarding

- [ ] **Onboarding / Tutorial.** Reframe as the tail end of the day shift — a colleague hands the board off to you before the real situation starts, told in-fiction, not as a UI overlay with arrows. Runs *before* the game clock starts at all; skipping lands the player at the same starting state with a one-line summary instead of a walkthrough. Teaches by doing real (if mundane) dispatcher work — an Incident or two, a routine dispatch — rather than narrating the interface directly. Panel spotlight mechanic for the moments that do need to point at something: CSS class on `#desktop` dims all panels except the one being described.

### Map & Units

- [ ] **Screen reactivity.** Contested districts blink or pulse. Fallen (overrun) districts go visually dark / all-black. Both respond to the sim without player input, making the map feel alive.
- [ ] **District consequences with gameplay weight.** OVERRUN: loot inaccessible, spread rate penalty, unit effectiveness reduced, distinct COMMS language. SECURED: slowed reinfection, distinct COMMS callout. Both are visual-only right now. This is the district-wide complement to the per-caller location-safety decay (v0.9.0 Foundation) — not a duplicate: location decay affects one Person's exposure, this affects everyone operating in the district, including units.
- [ ] **Real-world setting.** **City picked: Lexington, Kentucky** (see "What's Shipped" — the topbar title, desktop badge, and overall chrome already reflect this). What's left is the deeper rename: real, specific place names for districts (e.g. the actual hospital name instead of "Memorial") to ground the world; worth deciding what the city's declining industry was (steel? auto parts? textiles?) since that detail should flavor caller voice, not just signage. Bigger lift than a simple rename: district IDs are referenced throughout `main.js` (state, adjacency, loot pools) and in every script's `district` trigger field. Not needed for v0.9.0, but must land at or before v1.0.0 — changing the name after people have already seen it undercuts the first impression. **The map redraw is explicitly negotiable, not required** — renaming can happen directly on the existing district polygons, geography be damned. A redraw with more regular shapes and consistent corner orientation is a nice-to-have that can slide to v1.1+ without blocking 1.0 if it's not worth the time.

### Audio / Atmosphere

- [ ] **Sound Tier 2 — ambient loops.** Small `AudioContext`-based manager with gain nodes for crossfading (~50 lines). API: `audio.playAmbient('id')`, `audio.stopAmbient()`. Midnight gets its own loop, triggered via `when.gameTime(0, 0)` Director beat.
- [ ] **Sound Tier 3 — event-triggered.** Wire Director hooks to stings: `person-death`, `unit-disbanded`. Script nodes get an optional `sound` field played on node entry. `broadcastEvent` accepts an optional sound param.
- [ ] **COMMS retool — police scanner framing.** Current format (`[time][LOCATION] STATUS TEXT`) reads like a structured log line, not overheard radio. Retool toward how an actual scanner sounds — callsigns, "go ahead," cross-talk, garbled fragments — same underlying event data, more human delivery.

### Systems

- [ ] **Player-callback hook.** Let the player call back any contact — including resolved or `lost` ones — from the contact detail view. Default behavior, no script attached: always appends a "no response" message, no matter how many times it's pressed. The real value is the hook itself: emit a director event (`player-callback`, `{ contactId, tick }`) that does nothing until a script explicitly wires a handler for it. A script can compare the callback tick against an earlier moment to determine outcome — called back in time vs. too late. Infrastructure is small (one button, one event, one no-op default); the dramatic potential is the point, not the code. The player is too passive with callers right now — this is the one hook that lets a future script make "doing nothing" and "trying again" feel different. Caution: callback must never undo an already-`lost` resolution — calling a dead contact back should just confirm they're gone, which is its own beat, not a rewind button.

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
Tabled idea, not urgent: COMMS tone shifts based on how the run is going. Early or winning: full coherent sentences. Late or losing: progressively degrades toward fragments, screams, sobs, pure static — or doesn't, if the player's actually containing things. No mechanism decided yet. Pairs with the COMMS scanner retool (v1.0.0) but is a bigger, separate lift — get the baseline retool right first.

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
