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
- **Win/lose conditions** — Win: survive to dawn (6 AM, 252 ticks). Lose 1: all units dead. Lose 2: 10+ districts reach ≥75% zombie ratio (CITY FALLEN). Lose 3: units lost ≥ limit (SITUATION UNCONTAINABLE). All three wired into the tick loop.
- **Person/Unit model** — Person is the core type; units are containers; `MAX_UNIT_SIZE = 4` cap; loot drops on death with 40% transfer to district pool; scavenging activity
- **Director system** — `register()` for polling beats, `on()`/`emit()` for sim hooks (`person-death`, `unit-disbanded`, `unit-enters`); auto-registers from script `trigger` fields
- **`when.*` vocabulary** — `zombiesIn`, `gameTime`, `humansGone`, `unitIn`, `random`, `allOf`, `anyOf`; `triggerToCondition()` maps script trigger descriptors to condition functions
- **Script system** — narrative scripts as ES modules in `scripts/`; scripted callers are `sim:false` Persons protected from combat; 4 characters live: E. Novak, Marcus Webb, Danny, Dep. Dir. Holt
- **COMMS feed** — time + location + body layout, static separators between transmissions, no age-based dimming
- **Game clock** — 9:00 AM start, 5 min/tick (12 ticks/hour), full night ~15 real minutes at 3.5s/tick
- **Map** — SVG districts, 3 map palettes (Tactical Dark / Post-it / Paper Map), unit dots by leader role, click to open unit detail; legend bar removed
- **Dispatch screen** — CARDS / BADGES layouts, always district-grouped with visible headers, role-colored SVG leader stars (encodes role + leader status in one glyph), floating layout select at bottom-right; unit detail view with LOCATION / CURRENTLY DOING / ROSTER / ITEMS sections, dispatch dropdown defaults to current location; layout select hidden when detail view is open
- **Theme system** — 6 palettes (Terminal Green, Morning Coffee, Midnight Purple, Cyberpunk, Windows 95, Blood Moon), live switcher, localStorage persistence; unified `.game-select` style across all dropdowns; PAUSE button in topbar
- **Difficulty system** — `SCENARIOS` object with `numDistricts`, `totalZombies`, `distribution`, `spreadChance`, `delay` fields; `seedFromScenario()` picks random non-government districts with Fisher-Yates shuffle; Standard / Developer modes; spread rate and zone grid are Developer-only
- **Code cleanup** — dead `.task-btn--utility` CSS removed; `WINDOW_THEMES` per-window override system removed; terminal green COMMS panel now inherits the global theme instead of frozen coffee colors; First Aid Kit code aligned with description (50 HP threshold, 20 HP restore)

---

## v0.9.0 — Story & Stakes

> Win/lose conditions are live. The remaining gap: the early game is too predictable and the story is thin.
> Fill out narrative clock, caller arcs, and story beats.

- [ ] **Narrative clock scripts.** Time-based Director beats for: pre-dawn opening context (ambient COMMS), first midnight (tone shift), overnight atmosphere. Infrastructure ready — `{ type: 'game-time', hour: N }` triggers work. Non-interactive beats go directly in `main.js` as `director.register()`; interactive callers go in `scripts/`. Timer values are in ticks (5 game-mins each). Red herring / non-zombie early scripts to break up the info density.
- [ ] **Caller silence on death.** When a scripted caller's person dies in the sim, their contact should go dark — final transmission tone-shifts (static, a cut-off mid-sentence line, or an ominous quiet), then the channel closes permanently. This is the core emotional beat of the design: "a cop absorbing hits while a civilian radios you, then going silent." Currently nothing happens to the contact when their person dies.
- [ ] **Contacts response options — visibility fix.** The RESPOND choices are easy to miss. Make them obviously interactive before the Sandra Hill arc ships.
- [ ] **Sandra Hill narrative arc.** Already in the ambient caller pool — promote to a full scripted arc.
- [ ] **Rescue scenario.** A story beat that fires when a unit enters a district where a scripted caller is hiding. The `director.on('unit-enters', ...)` hook is already wired and has never been used.
- [ ] **The Oblivious Guy** (levity caller). Calls about something completely unrelated. Does not believe in zombies. Resolves peacefully regardless of game state. No stakes — just tone balance.
- [ ] **Sound Tier 1 — interface sounds only.** Drop `.wav` files in `sounds/`, call `new Audio(...).play()` in button handlers. No infrastructure needed. Lock the AudioContext unlock to the START MISSION click so everything fires freely after that.

---

## v1.0.0 — Presentable

> 1.0 means a stranger who didn't build this can pick it up and understand it.
> That requires onboarding, a functional dispatch screen, real district consequences, and the narrative feeling alive.

- [ ] **Citizen groups forming mid-game.** As the situation escalates, survivor groups should contact dispatch and become dispatchable units — distinct from the scripted callers, these are emergent. A mid-game Director beat spawns a new civilian unit in a non-overrun residential district and opens a contact. Gives the player late-game roster relief and makes the world feel populated. Design doc calls this out as a core mechanic; not yet implemented.
- [ ] **Screen reactivity.** Contested districts blink or pulse. Fallen (overrun) districts go visually dark / all-black. Both respond to the sim without player input, making the map feel alive.
- [ ] **Onboarding / Tutorial.** The first caller a new player gets is a scripted tutorial — walks through the interface before the real chaos starts. Panel spotlight mechanic: CSS class on `#desktop` dims all panels except the one being described. Tone: in-universe, interrupted by the real situation. Short; offer a skip on the start screen. Covers: map, contacts, dispatch roster, COMMS.
- [ ] **Sound Tier 2 — ambient loops.** Small `AudioContext`-based manager with gain nodes for crossfading (~50 lines). API: `audio.playAmbient('id')`, `audio.stopAmbient()`. Midnight gets its own loop, triggered via `when.gameTime(0, 0)` Director beat.
- [ ] **Sound Tier 3 — event-triggered.** Wire Director hooks to stings: `person-death`, `unit-disbanded`. Script nodes get an optional `sound` field played on node entry. `broadcastEvent` accepts an optional sound param.
- [ ] **District consequences with gameplay weight.** OVERRUN: loot inaccessible, spread rate penalty, unit effectiveness reduced, distinct COMMS language. SECURED: slowed reinfection, distinct COMMS callout. Both are visual-only right now.
- [ ] **Search for survivors activity.** New unit action alongside ENGAGE/HIDE/SCAVENGE. Each tick: very low base chance (~1–2%) to find a survivor — spawns them as a new no-item member of the unit, fires an alert notification, emits a director event (`survivor-found`) for story beats. Flashlight in unit inventory boosts the chance slightly (maybe 1.5×). Across a full 23-hour run this should happen ≤5 times across all units — rare enough to feel like an event. Secret sauce: `director.on('survivor-found', ...)` is where scripted arcs can hook in (a named NPC survivor with a story, a planted item, a reveal).
- [ ] **New items: knife, flashlight.** Knife: 0.15 hit chance, melee-only, added to loot tables (not spawned). Flashlight: no combat value, boosts survivor-search odds, added to loot tables; ~1/3 of starting civilian squad members spawn with one. Expand the **More items** list too: bolt cutters (unlocks certain loot), flare (reveals adjacent districts without binoculars), megaphone (civilian morale / zombie aggro mechanic).
- [ ] **Start the pure data removal pass.** Replace unit HP numbers with status words (HEALTHY / WOUNDED / CRITICAL). Single render change, meaningfully shifts the game toward its intended feel. Don't remove zombie counts yet — one step at a time.

---

## Backlog (v1.1+)

These are good ideas that aren't load-bearing for the core experience yet.

### Fire Mechanics
A rare sim event spawns a fire in a district. Fire spreads independently (adjacent districts, slower than zombies), kills both humans AND zombies, and creates a double-edged pressure. Hose item added to fire unit loadout — only fire units can suppress it. The longer it burns, the worse the damage. Player cannot cause fire. Implementation: new district property `fire: boolean`, new sim phase after zombie spread, new `fire-hose` item. Build after 1.0.0 is locked.

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
