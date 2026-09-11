# Dead Air — TODO

> Provisional. Not a changelog. Things move around here. design.md says what the game is; this
> file says what's built and what's next.

---

## Design North Star

**The outbreak is weather.** The sim spreads on its own and nothing the player does reduces it.
The player works inside it: answers named people at real addresses, sends a few cars to calls and
to reported situations on a map that starts blank, chooses who to stop for on the way, chooses
where the rescued go, and at dawn sees how they did. Trying to control a zombie outbreak is hubris;
the game is about doing the job anyway.

**Complete information, scattered.** Nothing is hidden from the player, but nothing is in one
place. The map, the call list, the scanner, the directory, the binder, the log — flipping between
them to assemble a picture *is* the work. If a whole night can be played looking only at the map,
the information hasn't been spread out enough.

**Nothing appears on the map until someone tells you, and sending a car is how you learn.** Marks
are beliefs; situations are the truth; the distance between them is where units get hurt.

**Pace: more than you can comfortably do, never click faster.** Not an RTS. Pause stays. The
target feeling is "I lost someone and I almost had it."

**Every ending is legible.** No score. A card that names its cause and tells the night in names
and places.

---

## Status after the re-center *(2026-09-10)*

Everything in "What's Shipped" below is real, working code, kept verbatim as the build record. But
the design was re-centered on 2026-09-10 (see design.md, "Superseded rulings"), so the shipped list
now splits in two:

**Kept — the foundation the new game is built on:** the windowed desktop, the window-manager
scripting API, the game clock, the Director and `when.*` vocabulary, the script system with
conditional routing and `then`, the universal call-answering mechanic, contacts-list indicators,
dispatch-to-caller with unit threads / RESPONDING / `onArrive` / first-responder-owns, the
badge-numbered COMMS chatter with per-district degradation, the onboarding flow (Barbara), the
difficulty/scenario split, the theme system, and **all of Map v3** (real Lexington, routing,
places, residences, one DISPATCH window, the map as the only dispatch surface, one click rule, one
Escape rule).

**Retired — shipped, now to be demolished (v0.9.0 step 1):** the combat loop (hit chances, HP,
counterattack, wound states, medics, rations), the activity system (ENGAGE / HIDE / SCAVENGE and
patrol), items and loot (`ITEMS`, `LOOT_POOLS`, `rollLoot`, the ITEMS window, item tags), the
`sim` flag and Location×Activity exposure, radio/binocular intel gating, the district-count and
units-disbanded lose conditions, win-at-dawn as a "win," and the SITREP god panel as anything but
a dev tool. The bullets below that describe these are history, not spec.

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
- **Map** *(superseded by Map v3, 2026-09-04 — see below)* — SVG districts, 3 map palettes (Tactical Dark / Post-it / Paper Map), unit dots by leader role, click to open unit detail; legend bar removed
- **Dispatch screen** *(superseded 2026-09-04: the roster is thin rows over the map; cards/badges CSS kept but unused)* — CARDS / BADGES layouts, always district-grouped with visible headers, role-colored SVG leader stars (encodes role + leader status in one glyph), floating layout select at bottom-right; unit detail view with LOCATION / CURRENTLY DOING / ROSTER / ITEMS sections, dispatch dropdown defaults to current location; layout select hidden when detail view is open
- **Theme system** — 7 palettes (Terminal Green, Terminal White, Morning Coffee, Midnight Purple, Cyberpunk, Windows 95, Blood Moon), live switcher, localStorage persistence; unified `.game-select` style across all dropdowns; PAUSE button in topbar
- **Difficulty system** — `SCENARIOS` object with `numDistricts`, `totalZombies`, `distribution`, `spreadChance`, `delay` fields; `seedFromScenario()` picks random non-government districts with Fisher-Yates shuffle; Standard / Developer modes; spread rate and zone grid are Developer-only
- **Code cleanup** — dead `.task-btn--utility` CSS removed; `WINDOW_THEMES` per-window override system removed; terminal green COMMS panel now inherits the global theme instead of frozen coffee colors; First Aid Kit code aligned with description (50 HP threshold, 20 HP restore)
- **Unit travel time** *(hop travel retired 2026-09-04: travel time is now the route's drive time on the real road graph — see Map v3)* — `computeHopDistances()` BFS over `adjacency`, generic `state.transits` (`kind: 'unit' | 'person'`, only `'unit'` produced so far), `dispatchUnit()` sets `districtId: null` and queues a transit instead of teleporting, `resolveTransits()` runs on its own unconditional `setInterval` decoupled from the gated `tick()` loop (ready for pre-game tutorial use later). TRAVELING panel in the MAP window shows 2-letter route codes and a smooth real-second countdown — each transit stores a wall-clock `etaMs` set once at dispatch, refreshed by its own 1s display interval, decoupled from `TICK_MS` so it counts down 1 at a time instead of jumping in tick-sized chunks. Each in-transit unit's dot gets a flashing red/blue siren glow (`.traveling-dot--siren`, `box-shadow` `@keyframes` with flat plateau stops at `0%, 49.9%` / `50%, 99.9%` — a sparse 2-keyframe version blended through a muddy purple on the implicit loop-back segment, fixed by holding each color flat). Clicking a TRAVELING row reopens that unit's detail view, which shows `EN ROUTE → {district} (m:ss)` while traveling. `renderUnitsPanel()` skips in-transit units (visible only in TRAVELING, consistent with them being absent from the map too). Verified live: dispatch → smooth countdown → clean siren flash → arrival → COMMS line, no console errors.
- **Map v3 — real Lexington** *(2026-09-04, one session; the spec is `map-integration.md`)* — MapLibre GL + self-hosted PMTiles + a baked road graph with A\* routing, nine road-corridor districts (adjacency derived from the polygons), 68 authored places with footprints, units driving real routes with route-derived travel time (tick-driven arrival, car paced to the tick, pause-aware transit clock), patrol laps on ENGAGE, INSIDE + occupancy badges at places, danger paint (streets heat + red boundary) and cold shroud gated by intel, caller pins on disclosure, one merged DISPATCH window (roster strip, floating district/place cards, compass, RESET VIEW, BORDERS toggle), context-menu verbs, Escape rule, double-click details, follow (F). Game moved onto Vite (`npm run dev` / `npm run build` → `dist/`; MapLibre worker vendored at build). The SVG map, palettes, drag-and-drop and hop constant are gone.
- **Alert quieting** — removed the `showAlert('INCOMING TRANSMISSION', ...)` popup that fired every time any narrative caller (E. Novak, Marcus Webb, Danny, Holt) first called in. Too frequent to stay meaningful; the CONTACTS panel's existing unread-dot already surfaces new calls without interrupting. ALERT is now reserved for LEADER DOWN and UNIT DISBANDED — genuinely rare events.
- **Caller/Person unification + Location×Activity exposure** — every caller (ambient or scripted) is now backed by a real Person; `checkCallerSurvival()` (the old `Math.random()` flag-flip) is gone entirely. `Person` gained `location` (`outside`/`business`/`residence`) and `activity` (`hide`/`default`/`scavenge`) fields. `effectiveThreatMod()` now computes exposure as `role weight × LOCATION_MOD × ACTIVITY_MOD` for everyone — units are treated as implicitly `outside` (they operate across the whole district) stacked with their existing ENGAGE/HIDE/SCAVENGE activity (a deliberate rebalance: e.g. an engaged police unit's weight went from `3` to `4.5`); standalone Persons (callers) use their own location/activity. `personsInDistrict()` now includes standalone `sim:true` Persons, not just unit members, and the combat block's old `if (districtUnits.length === 0) continue` gate is removed — so a caller alone in a zombie district with no unit present is now for-real exposed to the counterattack loop instead of a fake survival roll. A new generic `director.on('person-death', ...)` handler closes any contact whose `personId` matches, replacing the old narrative-only contact-closing logic. New ambient callers default to `location: 'residence', activity: 'hide'` (matches existing flavor text — "locked my door," "barricaded"). `scavenge` is modeled but nothing currently assigns it to a caller (no UI for it yet). Removed "Marcus Webb" from the ambient `CALLER_POOL` — it collided with the real scripted character of the same name.
- **Window-manager scripting API + script `onEnter` hook** — `closeWindow`/`minimizeWindow`/`maximizeWindow` (aliases over existing `toggleMinimize`/`toggleMaximize`), new `setWindowPosition(id,x,y)`, `setWindowOpacity(id,value)`, `spotlightWindow(id)`, `clearSpotlight()`. `setWindowOpacity` was reworked after first landing: it originally set `opacity` on the whole `.win` element (frame included), which made dimmed windows look translucent rather than "lights off." It now layers a black `.win-dim-overlay` div over just `.win-body` (titlebar stays fully visible and interactive) — `spotlightWindow` dims everything but the target window to 90% black. Script nodes gained an optional `onEnter(state, actions)` field, called from `advanceNarrativeCaller()` when a node is entered; `actions` is a small `SCRIPT_ACTIONS` capability object (the window-manager functions above + `bringToFront`/`showAlert`/`startGame`) handed to the script, since scripts are plain-data ES modules with no import access to main.js internals — this keeps that boundary intact instead of giving scripts a back door into the window manager.
- **Tutorial trigger point** — START MISSION spawns a script (`scripts/tutorial.js`) via the existing `spawnScript()` pattern instead of calling `startGame()` directly; the tutorial's final node calls the real `startGame()` to hand off (the standalone SKIP TUTORIAL button this originally shipped with is gone — see Onboarding flow, below; skipping is in-fiction now). Discovered along the way: `processNarrativeCallers()` (timers *and* choice reply-delays) was only ever called from inside the gated `tick()` loop, so even with a trigger point, a pre-game script using normal `choices`/`timer` fields would never advance — decoupled it into its own unconditional `setInterval(processNarrativeCallers, TICK_MS)`, the same treatment `resolveTransits()` got earlier this session. Also found `renderContactsPanel()` was only ever refreshed by `tick()`'s `render()`, so a contact spawned or advanced outside the tick loop wouldn't show up in the CONTACTS list — added explicit `renderContactsPanel()` calls to cover that.
- **Lexington, KY setting selected + visual rebrand** — the real-city pick (see "Real-world setting" under v1.0.0 Foundation) is settled: **Lexington, Kentucky**. The surrounding chrome matches the choice: a real Lexington-Fayette Urban County Police badge SVG sits centered on the desktop background (`#desktop-badge`); five clickable desktop icons (`#desktop-icons` — CONTACTS/DISPATCH/MAP/COMMS/ITEMS) sit top-left in a column, each an SVG over a label, wired through a new shared `focusOrToggleWindow(id)` helper that the taskbar buttons now also use (previously duplicated inline); the same icon set was added to the left of each taskbar button's label. The badge and every icon are masked from their default-black SVG source and recolored via `currentColor`/`background-color: currentColor`, so they automatically track whichever theme is active (green in Terminal Green, white in Terminal White, etc.) instead of being hardcoded white. New **Terminal White** theme (grayscale, near-black background, white text — classic command-prompt look) added alongside Terminal Green as a monochrome pairing. The topbar title reads **"DEAD AIR"** — that's the game's actual title (not the city, and not generic "Dispatch"); `#game-title` briefly read "LEXINGTON 911" mid-session before settling here. The district-rename lift is also done: every district's `label` (and the matching SVG map text + `DISTRICT_CODE` 2-letter travel code) now uses a real Lexington-flavored name — internal district IDs (`northgate`, `police-hq`, etc.) are untouched, so adjacency/loot/script triggers needed no changes. Mapping: Northgate→Joyland (JL), Millbrook→Winburn (WB), Eastridge→Castlewood (CW), Westgate→University of Kentucky (UK), Police HQ→LPD HQ (PD), Fire Station→Station No. 1 (S1), City Hall→LFUCG Govt Center (GC), Memorial→Good Samaritan Hospital (GS), Ironworks→Old Iron Works (IW), Riverside→Kendrick Ave (KA), Market District→Market St (MK), Commerce Park→Newtown Commerce (NC), Southend→The Red Mile (RM), Industrial Row→Lexington Quarry (LQ). Narrative scripts' in-dialogue references (E. Novak, Marcus Webb, Holt) and the seeded "City Hall" starter contact were updated to match. Two of these (Westgate, Southend) also got a `category` change to match their new identity — University of Kentucky is `government` (was `residential`), The Red Mile is `retail` (was `residential`) — which changes their loot pool (`LOOT_POOLS[category]`) accordingly. "University of Kentucky" is long enough that its SVG map label needed a smaller font-size override (14px vs the usual 18px) to fit its district box without overflowing. Northgate's rename went through two names in one session: it briefly became "Joyce Park" before settling on "Joyland" (JL) — a nod to the real historic Joyland amusement park, now a residential neighborhood; category stayed `residential` throughout.
- **Onboarding flow (Barbara West)** — required login (`showLoginBox`, name → `sessionStorage`, `{{name}}` interpolation via `resolveText`) gates `spawnScript('tutorial')`. The SKIP TUTORIAL button and the seeded LFUCG Govt Center starter contact are both gone — Barbara West is the only contact that exists at game start, and her in-fiction Yes/No RESPOND choice is the only skip path; both branches converge on `startGame()` → `resetLayout()`. All windows (`WIN_IDS`) start minimized via `initWindowManager()` — bare desktop, badge + icons only — and a new `revealWindow(id)` action in `SCRIPT_ACTIONS` lets scripts, not main.js, decide when each window appears; her "No" path reveals everything at once, her "Yes" path currently walks through DISPATCH only (see Tutorial Content below for what's left). RESPOND choices got a visual overhaul — 2px accent border, raised background, slow pulse, full color-invert on hover — so a live decision reads as urgent instead of blending into the panel. New CALL BACK button lets the player call back any contact, including resolved ones, appending a deduped "No response." system note and emitting a `player-callback` director event for future scripts to hook.
- **Universal call-answering mechanic** — every call except Barbara's (dialing 911 to onboard the player would be strange — see design.md, "On answering") opens with the dispatcher's own "911, what is your emergency?" line, a beat of three-dot typing delay (`chat-waiting-bounce`, staggered 0/0.15/0.3s), then the caller's actual first line — and none of it fires until the player opens that contact's thread for the first time (`maybeFireFirstOpen`, called from `showContactDetail`), not the moment the contact is created. An unopened caller carries no information at all until clicked — the literal mechanical expression of "nobody should be able to triage the call list at a glance." Ambient callers go through the identical `pendingNext`/`replyDelay` mechanism narrative scripts already used for choice replies; a `reportDistrictId` snapshot lets an unnamed "Unknown Caller" still report on the district that triggered them, resolved fresh against current zombie counts at open time rather than whatever was true when they first called. Generic non-response death spirals (a no-answer-at-all chain ending in `resolve: 'lost'`) were removed from Danny, E. Novak, and Holt's opening nodes as part of the same push — see design.md's "On silence and timers."
- **Contacts-list indicators: one "needs attention" dot, a shared connection icon, recency sort** — replaced three overlapping animated signals (whole-card opacity dimming for the dead, a flashing border for a pending choice, a dot trying to mean unread/lost/pending all at once) with two static ones. A small dot before the name is solid when `needsAttention(contact)` (unread, or a RESPOND choice still waiting) and hollow otherwise; the same connected/disconnected phone-and-arcs glyph from the contact-detail header (`phoneIconHTML()`) sits where the old dot used to — green while alive, red once not, no blink, in both places. Every message push now routes through one `pushMessage()` helper that stamps `contact.lastActivityTick`, so the list sorts flagged-first and by actual recency within each group instead of creation order.
- **Dispatch-to-caller — the core verb** — built and verified this session; the action the game is named after, which literally did not exist before. A unit can be sent to a *specific caller* from inside their open call thread (`renderDispatchControl` in the contact-detail view), not just to a district — the transit carries the caller's `personId` so arrival resolves scoped to that person. A dispatched unit becomes a one-way Contact (`UNIT n`, dot colored by leader role) that radios `en route` → `on scene` → outcome → `Task complete`; no 911 opener, no reply UI, no CALL BACK. On arrival it enters the new **`RESPONDING`** activity: present in the district but **fully insulated from the sim** — excluded from the counterattack exposure *and* spread suppression, so a unit on a call is not a multitasking zombie-killer — until the call resolves, then it reverts to ENGAGE. Arrival fires an authored `onArrive(state, actions, { contact, unit, roles, hasRole })` if the caller's script defines one (the first time authored content ever touches a specific unit), else a generic placeholder outcome with a timer-driven `completeResponse` (exposed to scripts via `SCRIPT_ACTIONS`; script-driven and clockless for authored callers). Multiple units may answer: the first to arrive owns the resolution, later arrivals are insulated backup ("Supporting unit on scene") that don't re-fire the caller's beat; same-tick arrivals resolve by sequential ownership; a caller who died en route is found "too late." Anchor (design.md): dispatch to a *district* is a win-the-sim move, to a *caller* a story move. The full **call-resolution model** (the `sim`-flag dividing line, the deferred `sim:true` save/lose-and-extract roll, the closure-message requirement) is settled and recorded in design.md + v0.9.0 below, but the roll itself is deferred to its first `sim:true` caller. Commits d5b2c7e / 775fe39.
- **Ambient callers → unit-voiced COMMS police chatter** — the old ambient caller pool, pulled out of CONTACTS and reborn in COMMS as off-duty / quick-response **police officers** (not dispatchable) radioing district status. `emitPoliceChatter` (replacing the parked `checkCallEvent`) emits a tier-selected line from new police-voiced `POLICE_CHATTER` (5 tiers; `getCallTier` carries over, the civilian `CALL_TEMPLATES`/`CALLER_POOL` were *replaced* not reused) for a still-reporting infected district each tick. Each district has one stable badge (`districtBadge` → `Badge #NNN`). `degradeChatter` does per-district word-level static replacement (reusing `STATIC_TAGS`) scaling with the reporting district's zombie ratio — clean below 0.20, fraying as it climbs; at/above `SILENT_RATIO` (0.75) the district emits one final broken line + `[no response]` and goes dark (recovers if pulled back below). Lines render `[Badge #NNN]: message` with the location substituted into the body via `$location` (after degradation, so the place name stays legible) — a fixed-width badge prefix for skimmability. The impersonal system broadcasts (movement detected, area clear, signal lost, unit en route/arrived, unit down, scavenge recovery) were **removed**, so COMMS is now exclusively the human scanner — every entry a district status update disguised as radio chatter. Commits d79f032 / fd566b7 / d50306e. Verified live including a district climbing clean → static → silence. (Dead civilian-ambient code left inert for a cleanup pass — see v0.9.0.)

---

## v0.9.0 — The Desk *(the re-center; design.md 2026-09-10)*

> The whole version is one job: turn the shipped foundation into the game design.md now describes.
> Build order below is chosen so that every step is playable and visibly verifiable on its own, and
> so that demolition happens *first* — two parallel systems is how the last COMMS change got
> confusing. Each step names its `main.js` / `src/map` touchpoints so a fresh session can start
> without re-reading everything. Numbers in here are placeholders to tune, not rulings.

### 1. Demolition — remove the sim the player was scored against

- [ ] **Tick loop:** delete the attack phase, counterattack, medic phase and rations block from
  `tick()`; keep local SIR spread and inter-district spread. Delete `getHitChance`,
  `effectiveThreatMod`, `pickCounterTarget`, `woundState`, `handlePersonDeath`'s combat path (keep
  a plain "person removed" helper for scripts), `districtHasRadio`, `districtHasBinoView`,
  `personsInDistrict`'s exposure logic, `isRespondingMember`.
- [ ] **Items and loot:** delete `ITEMS`, `ITEM_ABBREV`, `LOOT_POOLS`, `rollLoot`, `weightedPick`,
  `district.loot`, `person.items`, `itemTag`, `openItemsReference`, the ITEMS window (`index.html`,
  `WIN_IDS`, taskbar/desktop icon, `style.css`), `callerItems` on scripts.
- [ ] **Activities:** delete ENGAGE / HIDE / SCAVENGE (`unit.activity` values, the context-menu
  verbs in `src/map/interact.js`, the roster buttons, `setUnitsView`), and patrol laps in
  `src/map/mover.js`. Unit states become `available | enroute | onscene | holding` (see step 4).
  Arrival at a district just parks.
- [ ] **Persons:** drop `sim`, `location`, `activity`, `health` from `makePerson`; drop `respondTimer`
  from `makeUnit` once the arrival roll (step 4) replaces `genericArrivalOutcome`.
- [ ] **Win/lose:** delete `checkWin` and the district-count / disband-limit branches of `checkLose`
  (`DISTRICTS_LOST_LIMIT`, unit-loss limit). Dawn and no-hands are re-added as *endings* in step 10.
- [ ] **Dead civilian-ambient code** (carried over): remove `checkCallEvent`, `CALLER_POOL`,
  `CALL_TEMPLATES`, the `type:'ambient'` branches in `makeContact` / `maybeFireFirstOpen` /
  `showContactDetail` / `processNarrativeCallers`. Keep `getCallTier` — it's the tier now.
- [ ] **SITREP / god panel:** keep as a dev tool behind the existing toggle, but it must never be
  player-facing; note it in the panel title.
- [ ] Verify: a night runs start to dawn with spread only, units drive and park, scripts fire, no
  console errors. Then commit — this is the milestone the rest builds on.

### 2. Situations, marks and reports — "nothing appears until someone tells you"

- [ ] **Situations (ground truth).** `state.situations[id] = { kind: 'fire'|'block'|'crowd'|'horde',
  pos, node, districtId, bornTick, lifecycle }`. A spawner in `director.tick()` reads each
  district's tier and rolls spawn rate and kind mix per tier (`SITUATION_RATES[tier]`), placing on
  a random road node inside the polygon. Hidden lifecycles: a fire burns out after N ticks (house
  gone), a block may self-clear, a crowd disperses. **Consistency guards:** no spawns in districts
  with `humans === 0` except hordes; no horde below tier 2; kind mix must match tier.
- [ ] **Marks (belief).** `state.marks[id] = { kind, pos, node, districtId, reportedTick,
  reportedBy: 'caller'|'badge'|'unit', situationId|null, label }`. Marks never move or expire.
  A mark is created by a report, never by the spawner.
- [ ] **Reports on COMMS.** `emitPoliceChatter` gains a second pool: `REPORT_LINES[kind][tier]`
  voiced by the district's badge, naming a street (nearest named way to the situation's node —
  bake a `roads.json` name lookup or use the tile feature). Each report creates a mark with
  `reportedBy: 'badge'`. Rate scales with tier; a fraction of situations are never reported.
- [ ] **Marks layer on the map.** New layer in `src/map/layers.js` + glyphs in `icons.js`: kind
  glyph, timestamp label, age styling (older = dimmer, never gone). Hover: kind, reported when, by
  whom. Click: selects like a place (card in the DISPATCH window: what was reported, when, dispatch
  target). Renderer `get.marks()`.
- [ ] **Dispatchable marks — the Check verb.** `dispatchUnit(unitId, { markId })`: route to the
  mark's node, arrive `onscene`. Resolution (until step 4's roll): compare the mark to the current
  truth — situation still there (confirm: refresh `reportedTick`), resolved by the right role (fire
  out / road cleared: delete situation + mark), or gone (delete mark, unit line "nothing here"). Unit
  thread lines for each. Horde: confirm or gone, never resolve.
- [ ] **Routing on marks.** `src/map/graph.js` edge cost: blocked-road marks make their edge
  impassable; horde marks add a heavy cost within a radius. Remove the true-danger multiplier from
  edge cost (keep it for drive-time *pacing* only if it still reads right; otherwise drop). Verify a
  route bends around a mark and not around an unreported situation.
- [ ] Verify live: a district climbs, COMMS reports a fire at a street, a mark appears, a fire unit
  sent to it puts it out and reports; a police unit sent to a stale fire finds the house gone.

### 3. Hordes — wandering fires

- [ ] **Piece, not count.** `kind: 'horde'` situations get `heading`, `size: 'few'|'crowd'|'wall'`,
  and a wander: every few ticks step to an adjacent road node, biased to stay inside the polygon.
  Count per district set by tier (`HORDES_PER_TIER`), spawned/removed by the spawner as tier changes.
- [ ] **Spread is a crossing.** When the inter-district spread roll fires, pick a horde in the source
  district and move it across the boundary to the destination (spawn one if none). The +1 zombie
  stays; the horde is the fiction for it.
- [ ] **Sighting reports.** A horde near a caller's house or a badge's district produces a
  `horde` report → mark at its position now. Verify (police Check) confirms if the horde is within
  R of the mark, else "gone" and the mark clears.
- [ ] **Falls.** A horde reaching a place node with people inside (refuge, step 7) overruns it.
- [ ] Never drawn directly. Dev-only overlay behind the god toggle for tuning.

### 4. Unit states, roles and the arrival roll

- [ ] **Roles:** issued units are `police | fire | ems` (civilian issued units → EMS at spawn in the
  starting-units block; names/colors/icons in `icons.js` and `style.css`). `civilian` remains as the
  earned role only.
- [ ] **States:** `unit.state = 'available' | 'enroute' | 'onscene' | 'holding'` replaces
  `activity` + `respondTimer`; `unitStatusText` / roster rows / place badges read it.
- [ ] **The arrival roll.** One function `arrivalRoll(unit, target)` → `success | partial | loss`,
  weighted by `ROLE_FIT[unit.role][target.kind]` × `TIER_RISK[tier]`. `partial` removes one member
  (named in the unit line); `loss` disbands the unit (the surviving LEADER DOWN / UNIT DISBANDED
  alert). Used by `arriveOnCall` for generated callers and by Check for marks. Scripted callers
  (`onArrive`) never roll. Outcome lines per kind × outcome in a `UNIT_LINES` pool.
- [ ] Starting unit count is a tuning knob (`DIFFICULTIES`); bump it so the first bad roll isn't the
  end of the night.

### 5. Interrupts — stopping on the way

- [ ] In `resolveTransits`, each tick a moving unit checks situations within R of its current route
  segment (renderer `pos` is off-limits to the sim — use the transit's tick-indexed route node
  instead). Roll for an interrupt by kind; an unreported horde on the route rolls `arrivalRoll`
  immediately (can hurt/kill before a choice).
- [ ] Interrupt = a RESPOND choice on the unit's thread (`STOP` / `CONTINUE`), reusing the existing
  choice UI. Stop: retarget the transit to the situation (the mid-route re-dispatch path exists),
  mark created, roll on arrival, then the original target is *offered* again. Continue: unit line,
  mark created, drive on.
- [ ] `INTERRUPT_LINES[kind][tier]` pool: the ask, and outcome lines. Written with care — these are
  the memorable decisions.
- [ ] Route choice: the context menu gains "route via" (or the card offers the two shortest
  routes) so "go around" is a real choice. Small; do after the rest works.

### 6. Citizens and the DIRECTORY

- [ ] **Directory data.** Bake `public/data/directory.json`: ~N fictional names × phone numbers,
  each pre-assigned to a residence id (from `residences.json`) so name → house is fixed per run
  seed. Reserve entries for scripted callers' relatives (Danny's David Reyes).
- [ ] **DIRECTORY window.** New `.win` (`WIN_IDS`, taskbar icon, desktop icon): a search box over
  name / number / district; a result row lights the house and flies the camera (reuse `litPlace` /
  `flyTo` / `spawnResidence`-style transient place). Used entries are flagged.
- [ ] **Generated citizens.** A citizen spawner in `director.tick()` per district tier: draw an unused
  directory entry in that district, create Person + Contact + house pin (disclosed on first open),
  opening line from `CITIZEN_OPENERS[kind][tier]` (welfare, fire, injury, trapped, "I saw them"),
  and a **survival window**. On window close: last line, thread closes, entry stays used. Some
  openers reference nearby marks (corroboration). Some are routine and stay routine.
- [ ] **Hunkering down is never safe forever — enforce it.** The survival window is *not* a fixed
  number set at spawn: each tick the caller's remaining time is drained at a rate read from their
  district's **current** tier (tier 0 drains nothing; tier 4 drains fast) and their location class
  (a residence drains slower than outside). A caller in a district that collapses around them runs
  out of time even if they were fine an hour ago. That's the counterweight to "go": stay is safe
  *now* and deadly *later*; go is one roll *now* and possibly pure upside (alive somewhere safer,
  and they saw something on the way). Without this drain, stay is the dominant strategy. The game
  has no such mechanism today; this is where it lands.
- [ ] **Rescue → destination.** On a successful arrival for a citizen, the unit thread asks *where
  to* (see step 7); the caller's closing line lands when they arrive there.
- [ ] Fence: a house with a live caller is never drawn again; scripted "same house" beats only.

### 7. Refuges — where the saved go

- [ ] `state.refuges[placeId] = { people: [personId…], heldBy: unitId|null, fallen: false }`.
  Any authored place can be one; the first time someone is sent there it appears on the map as a
  refuge (badge + roster in the place card).
- [ ] **Hold verb:** a unit dispatched to a place with `hold: true` stays `holding` inside; the place
  card shows it. Unheld refuges are just buildings with people in them.
- [ ] **Falls:** a horde reaching the place → `fallen`, everyone inside lost (each a closure line on
  the LOG, names on the dawn card), the place's glyph/footprint restyled *on report* — the report is
  a last call from inside or the next unit to arrive. A held refuge gets a roll to hold instead.
- [ ] **Evacuating a refuge:** re-dispatching a unit from a refuge with people can carry them (cap
  by headcount) to another refuge — the "town hall is about to fall" scramble.
- [ ] Groups → units by script only (`actions.formUnit(personIds, name)` in `SCRIPT_ACTIONS`).

### 8. BINDER, memos and LOG

- [ ] **BINDER window.** Static SOP pages (one per call kind: what to send, what not to do, district
  level rules) as data (`public/data/binder.json`), rendered as a paged document. Memos arrive as
  Director beats (`game-time` + state) and pin to the top with a timestamp; a new memo flags the
  window.
- [ ] **Rules as data.** Each SOP/memo rule is checkable: `{ id, when, forbids | requires }` over
  a dispatch (`{ unit, target, tier }`). `dispatchUnit` evaluates rules → `state.violations[]`
  (insubordination) ; unanswered-after-window citizens → `state.neglect[]` (negligence). Both feed
  Holt (step 10). No meter shown; the binder is the meter.
- [ ] **LOG window.** Append-only, timestamped: every call opened, dispatch, arrival, outcome, memo,
  refuge change. The impersonal status lines removed from COMMS go here. Filter by unit / caller.
  This is the save/resume surface later (v1.0).

### 9. The heat rule

- [ ] `syncMapPaint`: `danger[id]` = true ratio only if `state.districts[id].lastContactTick` is
  within `HEAT_RECENCY`; else paint grey and set the district card line "no word since HH:MM".
  `lastContactTick` is stamped by any call, report, or unit line from that district. Fallen shroud
  stays ungated. God mode still overrides for dev.

### 10. Endings

- [ ] **Dawn card** (`showEndScreen` → a real card): saved by name and refuge, lost by name, never
  answered (count), each spine character's fate, each unit's fate, refuges held / fallen. Read from
  `state.people`, `state.refuges`, `state.contacts`, the LOG.
- [ ] **Relieved of duty:** Holt's authored warning calls fire off `state.violations.length` /
  `state.neglect.length` thresholds (two separate ladders, two separate voices). Third strike on
  either → the ending card, naming which.
- [ ] **No hands:** all units gone → **open** (design.md): card now, or let the night run to dawn
  with talk only. Build the "let it run" version first since it's free; decide after a playtest.

### 11. Stay or go — caller travel

- [ ] `person-trip`: a citizen told to move (a choice in their template, or a script action
  `actions.sendOutside(contact, destPlaceId|null)`) leaves a `lastknown` mark at their house, runs a
  hidden trip (`ticks` from route length on foot), and resolves with `arrivalRoll`-shaped odds
  weighted by tier and any horde near the path: arrive (check in from the destination, maybe with a
  report → mark), or silent. A car already heading to the house arrives to "nobody here."
- [ ] Scripted callers route on conditions instead: add `horde-near` (scriptId, radius) and
  `place-fallen` (placeId) to `evalRouteCond`; document in scripting.md when built.

### 12. Scenario: the mall

- [ ] Pick the mall place; make it the anchor. Author the cast: people heading there, calling from
  it, asking for units, a road cleared, whether it can hold. It's the run's biggest refuge and can
  fall. Test: does it feel baked into the *whole* run? If not, the scenario feature is rethought.
- [ ] Re-home the existing four (Novak, Webb, Danny, Holt) under the scenario model — Holt is
  scenario-independent (he's the job); the other three either join the mall cast or wait for a
  second scenario. Danny's rewrite uses stay-or-go for real.
- [ ] `state.scenarioId` finally selects a cast; "Random" loads none.

### 13. Tutorial refresh

- [ ] Barbara's walkthrough teaches the new verbs by doing: a routine fire report → Check with a fire
  unit; a welfare-check caller → DIRECTORY lookup → Respond; a memo in the BINDER. Then her handoff
  transit home (existing todo), landing as a citizen in the directory.

### 14. Docs

- [ ] scripting.md: document `formUnit`, `sendOutside`, the new conditions, roles, and the
  "scripted callers never roll" rule once each lands. Keep it in step with the code, not ahead.

---

## v1.0.0 — Presentable

> 1.0 means a stranger who didn't build this can pick it up and understand it, and a full night
> feels like a story they'd retell.

- [ ] **Inquiries.** The cast above Holt: the governor (calling because the president called), a
  Louisville dispatcher, a reporter, a relative asking about an address. Each is a caller who wants
  an *answer* you find in the binder / log / map; each costs time. Some are the job-failure ending
  calling ahead.
- [ ] **Services you phone.** Tow, utility crew — a request with an address and a delay, no car,
  not on the map as yours. A CONTACTS entry with a form, not a unit.
- [ ] **National Guard.** At the end of one inquiry tree: new issued units late in the night, or
  permission to call for them. Arrives with fanfare; the "you almost didn't need us" beat.
- [ ] **Save / resume** off the LOG + state snapshot, so a 30-minute night can be walked away from.
- [ ] **Loss legibility wiring.** Districts greying, COMMS silence, Holt sharpening, unit threads
  thinning — make sure each ending's approach is visible on its own surface before it fires.
- [ ] **Playtest tuning:** call / report / interrupt volume per hour (the early hour routine but not
  empty), starting unit count, survival windows, horde counts, `HEAT_RECENCY`.
- [ ] **Audio.** Tier 1 interface sounds (AudioContext unlocked on START MISSION); Tier 2 ambient
  loops with a midnight loop; Tier 3 stings on `unit-disbanded`, a refuge falling, a memo arriving;
  script nodes get an optional `sound`.
- [ ] **A second scenario**, so "Scenario" is a real choice.
- [ ] **Contrast audit; window resize from N/W edges; district-card interior tuning** (carried).
- [ ] Still open from Setting: the city's declining industry, to flavor caller voice.

---

## Backlog (v1.1+)

### Levity callers
The Oblivious Guy (doesn't believe in zombies), the Prank Caller, the Song Request Guy. All are
citizens with no stakes — tone balance, and one more reason the list can't be triaged at a glance.

### The Biker Gang
A rare citizen group pinned down somewhere; a successful rescue forms them into an earned unit by
script (not extraction). The memorable "saved → recruited" swing. Needs step 7's `formUnit`.

### Information relay
Mostly absorbed by Inquiries: a beat where caller A tells you something caller B needs, and you have
to carry it. What's left is the fiction — what's worth relaying, and what goes wrong if you carry it
wrong.

### Terminal window
Typed commands (`/dispatch 3 good-samaritan`) for keyboard players. Fits the desk perfectly. After
the verbs stop changing.

### Camera feeds
Faked CCTV windows — a dark street, rain, a lightning strobe. Pure atmosphere at first; later a
feed can *be* a report source (a camera shows a road blocked) and can go down with a district's
power. Build after the terminal.

### Unit-scoped morale *(benched, not rejected)*
A per-unit or per-district "hope" value feeding emergent events. Only if a specific mechanic needs
it; never a master score (design.md, Out of Scope).

### Windowed UI flavor
More desk: a clock that's a clock, a coffee ring, a sticky note with the shift roster. Cheap, and
it's the whole game.

---

## Known Issues / Polish

- Window resize from N/W edges doesn't clamp (can push off-screen — low priority)
- Contrast audit still needed in some panels — target: anything intentionally dim should still be legible; only decorative/idle elements near-invisible
- `renderUnitCard` + cards/badges CSS are kept but unused since the roster became thin rows; delete
  in the demolition pass.
