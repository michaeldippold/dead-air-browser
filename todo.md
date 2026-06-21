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

## NEXT SESSION — Travel System & Tutorial Infrastructure

> Planned in detail, not yet written to disk. Jumps ahead of the v0.9.0 Foundation items below
> on purpose — the tutorial needs this regardless of where Scenario/Person-unification work
> lands, and the four existing scripted characters stay as-is for now (deferred, see Scenario
> System section). Read design.md's "Movement & Risk" section for the why; this is the how.
> Existing map geometry stays as-is for this work — no map redraw needed or wanted here.

### 1. Hop-distance over the existing adjacency graph

Right after the `adjacency` object (`main.js`, currently ~line 567), add a BFS precompute:

```js
function computeHopDistances(graph) {
  const dist = {}
  for (const start of Object.keys(graph)) {
    dist[start] = { [start]: 0 }
    const queue = [start]
    while (queue.length) {
      const cur = queue.shift()
      const d = dist[start][cur]
      for (const next of graph[cur] || []) {
        if (dist[start][next] === undefined) { dist[start][next] = d + 1; queue.push(next) }
      }
    }
  }
  return dist
}
const HOP_DISTANCE = computeHopDistances(adjacency)
const hopsBetween = (a, b) => HOP_DISTANCE[a]?.[b] ?? 1
```

Add travel speed constants near the top config block: `UNIT_TICKS_PER_HOP` (fast — vehicle) and
reserve `PERSON_TICKS_PER_HOP` (slow — on foot) for later caller Outside-travel work (v0.9.0
Foundation) even though nothing uses it yet — keep the transit data model (next section) generic
enough that adding it later doesn't require touching the resolution loop again.

### 2. Generic transit record, `state.transits`

Add `transits: []` to the `state` object. Shape: `{ id, kind: 'unit' | 'person', refId, srcId,
destId, ticksRemaining, totalTicks }`. Generic over unit/person on purpose — the tutorial only
needs `kind: 'unit'` for the dispatch-and-wait beats, but the end-of-tutorial handoff (depositing
the colleague into a residential district, see section 6) needs `kind: 'person'`, and so will
caller Outside-travel later. Build it generic once rather than twice.

### 3. Rewrite `dispatchUnit()` (currently ~line 1321) to take real time

Currently it teleports instantly: removes from `src.unitIds`, pushes to `dest.unitIds`, sets
`unit.districtId = destId`, all in one call. New version: remove from `src.unitIds`, set
`unit.districtId = null` (in transit — not "in" any district, which is what already makes the
unit invisible to the map and to combat with zero extra code, since `unitsInDistrict()` only
ever reads from `district.unitIds`), push a new transit record (ticks = `hopsBetween(srcId,
destId) * UNIT_TICKS_PER_HOP`), emit `director.emit('unit-departs', { unitId, srcId, destId })`
(**new event**), broadcast the existing "en route" message, re-render. The two existing callers
(`btnUdvSend` click handler and the drag-drop `drop` handler) don't need any changes — they
already just call `dispatchUnit(unitId, destId)` and handle closing the detail view themselves.

### 4. `resolveTransits()` on its own decoupled interval

This is the piece that makes the tutorial possible at all: it must run independently of
`state.started` and the main gated `tick()` interval, because the tutorial happens *before*
`state.started` is ever set true (no zombies, no main sim loop) but still needs real,
watchable countdown time for travel demonstrations.

```js
function resolveTransits() {
  if (state.transits.length === 0) return
  const remaining = []
  for (const t of state.transits) {
    t.ticksRemaining--
    if (t.ticksRemaining > 0) { remaining.push(t); continue }
    if (t.kind === 'unit') {
      const unit = state.units[t.refId]
      if (unit) {
        unit.districtId = t.destId
        state.districts[t.destId]?.unitIds.push(t.refId)
        director.emit('unit-enters', { unitId: t.refId, destId: t.destId, srcId: t.srcId })
        broadcastEvent(`[${state.districts[t.destId]?.label?.toUpperCase() ?? '?'}] Unit arrived from ${state.districts[t.srcId]?.label ?? t.srcId}.`)
      }
    } else if (t.kind === 'person') {
      const person = state.people[t.refId]
      if (person) {
        person.districtId = t.destId
        director.emit('person-arrives', { personId: t.refId, destId: t.destId, srcId: t.srcId })
      }
    }
  }
  state.transits = remaining
  renderUnitsPanel(); renderUnitDots(); renderTravelingPanel(); renderDistrictDetail()
}
setInterval(resolveTransits, TICK_MS)  // unconditional — starts at page load, not gated by state.started
```

**Event repurposing, intentional:** `unit-enters` already exists (`director.on('unit-enters', ...)`
is wired today, fired instantly at dispatch-click). Moving its firing point to *actual arrival*
is correct, not a regression — the existing "Rescue beat" backlog item already assumes "a unit
enters a district" means physically arriving there, which wasn't true until now. `unit-departs`
is the new event for the leaving side, since "dispatched" and "arrived" are different moments
now that travel takes time.

### 5. Fix `renderUnitsPanel()` for in-transit units

It currently groups `Object.values(state.units)` by `unit.districtId` with no null-check — an
in-transit unit (`districtId: null`) would render as a bogus "null" district group in the
DISPATCH panel. Add `if (!unit.districtId) continue` (or filter before grouping) so in-transit
units simply don't appear in the roster, consistent with them not appearing on the map either.

### 6. TRAVELING panel — UI

New `#traveling-panel` div, absolutely positioned inside `#map-svg-wrap` (already `position:
relative; overflow: visible` — no layout restructuring needed), bottom-left corner, always
visible regardless of `data-view`/district selection. Header "TRAVELING" + a list div. Sort
`state.transits` by `ticksRemaining` ascending. Countdown shown as **real seconds remaining**
(`ticksRemaining * TICK_MS / 1000`, formatted `m:ss`), not in-game-clock time. Route shown with
2-letter district codes: `NG MB ER WG PD FS CH MM IW RV MK CP SE IR` (Northgate → Industrial Row,
full table already drafted in the Map & Units section below) — plus a special pseudo-code `TU`
for "Tutorial" as the source of the colleague's end-of-tutorial transit (section 7).

Row format: unit rows show a small role-colored dot (reuse `--unit-police` / `--unit-fire` /
`--unit-civilian`, same vars `.member-dot--*` already uses, just as a new small `.traveling-dot`
class rather than reusing `.member-dot` directly so the siren effect below doesn't leak into the
roster) plus the **leader's name** (not "Unit N"); caller/person rows are bare names, no dot —
this was already settled earlier: dots are the map's language for "a unit is here," stars mean
something narrower (leadership within a roster), and bare names preserve caller ambiguity.

Flavor: `.traveling-dot--siren::before` — a `conic-gradient(from 0deg, red 0deg 180deg, blue
180deg 360deg)` positioned ring around the dot, spun via a CSS `@keyframes` rotation. Pure CSS,
no JS animation loop. Open question (not urgent): universal red/blue, or vary by role.

### 7. Window-manager scripting API

Small new functions, all reusing existing `winState`/`applyWinGeometry`/`toggleMinimize`/
`toggleMaximize` internals — this is what lets a tutorial script puppet the UI:

- `closeWindow(id)` → `toggleMinimize(id)` (matches existing "close = minimize" semantics)
- `minimizeWindow(id)` → `toggleMinimize(id)` (alias; same behavior, clearer name for script intent)
- `maximizeWindow(id)` → `toggleMaximize(id)`
- `setWindowPosition(id, x, y)` → set `winState[id].x/y`, call `clampWin(id)` then `applyWinGeometry(id)` — **new, doesn't exist today**
- `setWindowOpacity(id, value)` → `document.getElementById('win-'+id).style.opacity = value` — **new**
- `spotlightWindow(id)` → convenience wrapper: `setWindowOpacity` to ~0.25 on every window except `id`, 1.0 on `id`. This *is* the "panel spotlight" mechanic the original Onboarding/Tutorial todo item already called for — implement it as this reusable function instead of a one-off CSS class on `#desktop`.
- `showAlert(title, body)` already exists and is already reusable as-is — no change needed.

### 8. Script node `onEnter` side-effect field

Extend the script node shape (`{ text, choices, timer, timerNext, resolve }`) with an optional
`onEnter(state)`, called from `advanceNarrativeCaller(contact, nodeId)` when a node is entered.
This is what lets a tutorial node show dialogue *and* dim a window, spawn a caller, or fire an
alert in the same step — without it, the script system stays narration-only.

For "wait for the player to actually do something" steps (e.g. "advance once the tutorial unit
arrives"), hand-wire a one-off `director.on('unit-enters', ...)` handler scoped to the tutorial's
specific unit that calls `advanceNarrativeCaller(tutorialContact, nextNodeId)` when it fires.
Don't generalize this into the script format yet — there's only one use case so far.

### 9. Tutorial trigger point — before the game even starts

The existing four scripted characters trigger via Director `condition`/`trigger` polling, which
only runs inside `tick()` — but the tutorial must run *before* `state.started` is ever true.
Plan: clicking **START MISSION** spawns the tutorial script (via the existing `spawnScript()`
pattern) instead of immediately calling `startGame()`. The tutorial's final node calls the real
`startGame()` (zombie seeding, `state.started = true`, main tick interval start) to hand off into
the real game. A new **SKIP TUTORIAL** button calls `startGame()` directly — same starting state,
no walkthrough, per design.md's Onboarding section.

### 10. Tutorial colleague & content

Day-shift handoff colleague: **female, friendly, generic coworker** — deliberately not deeply
characterized yet, since there's an open option to swap her for "a wildcard type" later. Her
script should: spotlight panels one at a time while introducing them, then walk through 1–2
*real* scripted dispatches using the actual dispatch UI and the real travel system built above
(not faked) — waiting on `unit-departs`/`unit-enters` to advance her dialogue at the right
moments. Zero zombies seeded, main tick loop not running, but the decoupled transit-resolution
loop (section 4) is already running independently, so travel visibly counts down in TRAVELING in
real time regardless. She can also spawn a sample Incident-style caller via the existing
`spawnScript`-equivalent mechanism, to demonstrate CONTACTS during the walkthrough.

**End-of-tutorial handoff:** on her last node, create a `kind: 'person'` transit record with
`srcId: 'tutorial'` (renders as `TU` in the TRAVELING list) destined for a chosen residential
district. On arrival (via the existing `resolveTransits` + the new `person-arrives` event), she
becomes a normal `sim: true` Person sitting in that district — exposed to the real simulation
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
- [ ] **Give every caller a real Person.** Scripted callers have a Person (`sim: false`) today; ambient callers don't — they're just a Contact with a location, and `checkCallerSurvival()` fakes their death with a probability roll instead of letting the sim actually kill them. Unify: every caller, named or anonymous, gets a Person. Ambient callers then die through the same combat/location system as everyone else, and `checkCallerSurvival()` goes away entirely.
- [ ] **Location system.** General categories (Outside / Private Residence / Business) with identical rules in every district, plus 2–3 named story locations per district authored only when a script needs one (e.g. "Ironworks Loading Dock" for Webb). Never rendered on the map — it's a modifier on the existing threat-weight system (the same lever HIDE already uses) and a text label in contact messages. Safety degrades as district zombie ratio rises rather than granting permanent immunity — a secure Residence buys time, not a free pass.
- [ ] **Generalize HIDE to standalone Persons.** `activity` (engage/hide/scavenge) currently lives on Unit, not Person — a caller who isn't in a unit has no activity field, but the location system above assumes a caller can "take the hiding action." Needs a Person-level flag, not routed through Unit.
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
- [ ] **Caller silence on death.** When a caller's Person dies, their contact should go dark — final transmission tone-shifts, then the channel closes permanently. This is the core emotional beat: "a cop absorbing hits while a civilian radios you, then going silent." Once every caller has a real Person (Foundation, above), this generalizes for free via the existing `person-death` hook — wire a handler that closes any contact whose `personId` matches. Decide per scripted character whether their death is sim-driven or purely authored: Danny, Novak, and Holt should likely stay `sim: false` since their arcs are built around an authored ending; Marcus Webb is a good candidate for `sim: true` — he's explicitly in a dangerous district and his script already references losing someone, so it would be more honest if the sim could kill him too.
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

- [ ] **Night-shift timeframe.** Change the game clock from the current 9:00 AM start / survive-to-6AM-next-day (21 game-hours) to a proper night shift: **20:00 start, win at dawn 06:00** (10 game-hours). Pair with a tick-rate change — current math (5 game-min/tick, 3.5s real/tick) was tuned for the old 21-hour day and produces a ~7 minute run at the new duration, too short. Target is **~30 real minutes per run**; the cleanest fix is dropping to **1 game-minute per tick** (~3s real/tick), which also lets story beats schedule with 1-minute precision instead of 5. Running ~5x more ticks per hour means `SPREAD_RATE` needs proportional retuning, or this becomes an intentional difficulty lever instead of an accident.
- [ ] **Onboarding / Tutorial.** Reframe as the tail end of the day shift — a colleague hands the board off to you before the real situation starts, told in-fiction, not as a UI overlay with arrows. Runs *before* the game clock starts at all; skipping lands the player at the same starting state with a one-line summary instead of a walkthrough. Teaches by doing real (if mundane) dispatcher work — an Incident or two, a routine dispatch — rather than narrating the interface directly. Panel spotlight mechanic for the moments that do need to point at something: CSS class on `#desktop` dims all panels except the one being described.

### Map & Units

- [ ] **Unit travel time + TRAVELING panel.** Units currently teleport instantly between districts — no delay, no distance concept. Fix: travel time = hop count over the existing `adjacency` graph (already-existing data, no new geometry, cheap to precompute once at load) × a per-hop tick cost. Units move fast per hop (vehicle-equipped); a caller's Outside-travel (v0.9.0 Foundation) is much slower per hop (on foot) using the same underlying distance concept. Surface this with a persistent **TRAVELING** panel in the MAP window: everyone currently in transit, sorted soonest-arrival-first, auto-removed on arrival, countdown shown as real seconds remaining (not in-game-clock time — what the player actually perceives ticking down). Merge unit-transit and caller-transit into one shared list — the stakes differ (units = opportunity cost, callers = real danger) but the row format doesn't telegraph which, consistent with the caller-ambiguity goal. Unit rows use the existing role-colored map unit-dot (not the leader star, which already means something narrower — leadership within a roster); caller rows are bare names. While in transit, a unit/caller is removed from the map and unclickable — falls out for free from the existing transit-state model. Flavor add-on: an animated `conic-gradient` ring (half red, half blue) spinning around traveling unit dots via pure CSS — reads as a police/emergency siren while in motion, gives the eye something to land on in an otherwise still screen. Open question: universal red/blue, or vary the gradient pairing by leader role. District 2-letter codes for compact display (`Jane Doe [0:16] [IW→RV]`) — draft table: NG Northgate · MB Millbrook · ER Eastridge · WG Westgate · PD Police HQ · FS Fire Station · CH City Hall · MM Memorial · IW Ironworks · RV Riverside · MK Market District · CP Commerce Park · SE Southend · IR Industrial Row.
- [ ] **Screen reactivity.** Contested districts blink or pulse. Fallen (overrun) districts go visually dark / all-black. Both respond to the sim without player input, making the map feel alive.
- [ ] **District consequences with gameplay weight.** OVERRUN: loot inaccessible, spread rate penalty, unit effectiveness reduced, distinct COMMS language. SECURED: slowed reinfection, distinct COMMS callout. Both are visual-only right now. This is the district-wide complement to the per-caller location-safety decay (v0.9.0 Foundation) — not a duplicate: location decay affects one Person's exposure, this affects everyone operating in the district, including units.
- [ ] **Real-world setting.** Replace the fictional town with a real Kentucky city not already used by Project Zomboid's map — candidates under consideration: Lexington, Bowling Green, Owensboro. Use real, specific place names for districts (e.g. the actual hospital name instead of "Memorial") to ground the world; worth deciding what the city's declining industry was (steel? auto parts? textiles?) since that detail should flavor caller voice, not just signage. Bigger lift than a simple rename: district IDs are referenced throughout `main.js` (state, adjacency, loot pools) and in every script's `district` trigger field. Not needed for v0.9.0, but must land at or before v1.0.0 — changing the name after people have already seen it undercuts the first impression. **The map redraw is explicitly negotiable, not required** — renaming can happen directly on the existing district polygons, geography be damned. A redraw with more regular shapes and consistent corner orientation is a nice-to-have that can slide to v1.1+ without blocking 1.0 if it's not worth the time.

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
