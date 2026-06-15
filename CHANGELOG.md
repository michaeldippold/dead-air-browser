# Changelog

All notable changes to Dispatch will be documented here.

---

## [0.6.0] — 2026-06-15

### Overview

Code quality pass, game clock refactor, and Director system. Dead code removed throughout. The game world now runs on a 24-hour clock starting at Day 1, 09:00. A Director layer decouples authored narrative beats from the simulation loop.

---

### Game Clock

- Game world time replaces real-elapsed time everywhere. Clock starts at **Day 1, 09:00** and advances 15 game-minutes per tick
- Topbar time display updated: `DAY 1 · 09:00`, advances each tick, rolls over to Day 2 correctly
- All contact message timestamps, radio feed timestamps, and win/lose overlay now show game time (e.g. `[11:00]`) instead of real elapsed seconds
- `ticksFor(hour, min)` helper converts game-world time to tick index for Director conditions

---

### Director System

- New `director` object: a collection of authored beats, each with a `condition(state)` and `trigger(state)` function
- `director.tick()` runs each game tick, firing beats whose conditions are met. Beats marked `once: true` fire exactly once; repeating beats support a `cooldown` (in ticks)
- All four narrative caller spawns (E. Novak, Marcus Webb, Danny, Dep. Dir. Holt) migrated from inline tick logic to registered Director beats
- `_narrativeSpawned` Set removed — Director handles deduplication internally via `_fired` flag
- Adding new scripted events now means adding a `director.register(...)` call; the simulation loop stays clean

---

### Code Cleanup

- Removed dead `btn-card-layout` IIFE (button was removed in a prior refactor)
- Removed vestigial `contact.group` and `contact.unitId` fields from `makeContact` (relics from old caller architecture)
- `pendingNext` and `replyDelay` moved into `makeContact` so all contacts carry the fields — prevents silent bugs when Director creates narrative callers
- `spawnNarrativeCaller` simplified accordingly
- Radio feed TTL filter moved from `renderRadio` (side-effect in a render function) into `broadcastEvent` where it belongs
- `state?.startTime` optional chain removed; `state.started` boolean flag replaces `startTime` as the game-running guard
- CSS: removed landscape card layout rules, dead `#btn-card-layout` styles, dead `.roster-wound-row`, dead `.hp-bar`/`.hp-seg` rules
- CSS: fixed specificity collision where landscape-era `#item-description-view #idv-name` was overriding the current `#idv-name` styles — IDV name now renders at the correct size
- CSS: removed duplicate `#udv-type` and `#udv-location` declarations (first definitions were stale, second always won)

---

## [0.5.0] — 2026-06-15

### Overview

Major UI overhaul. The interface is now a windowed OS-style environment — four independent windows (CONTACTS, DISPATCH, MAP, COMMS) pinned to a desktop, each with a titlebar, pin toggle, minimize, resize, and close. Every window can be repositioned and resized by dragging. The map and dispatch roster are now separate panels. The information density and readability of nearly every view was improved.

---

### Windowed UI

- Four taskbar buttons (CONTACTS, DISPATCH, MAP, COMMS) toggle their respective windows; layout resets via "Reset UI"
- Each window has a titlebar with pin, minimize, resize, and close controls
- Default layout: Contacts left · Dispatch center-left · Map center-right · Comms right — full height, edge to edge
- Windows can be freely moved and resized; pin locks position so the window can't be accidentally dragged

---

### DISPATCH window

- Split from the old combined MAP VIEW panel into its own dedicated window
- **EXPANDED / CONDENSED** card layout switcher in a fixed header toolbar:
  - EXPANDED — portrait image, full card with name, role, items, member dots
  - CONDENSED — no portrait; a narrow colored role-strip on the left edge of the card instead
- Responsive card grid: `auto-fill / minmax(150px, 1fr)` — 2 columns at default width, pops to 3 at wider sizes
- Equal padding on all four sides of the grid

---

### MAP window

- Separate from DISPATCH; retains the city SVG, district selection, and intel display
- **Two-bar header**:
  - Top bar (taller): district name, category, and intel (humans · infected) all inline on one row
  - Bottom bar (shorter): category legend with colored swatches
- Legend swatches enlarged to 16 × 16px with 6px border-radius
- **Selected district pushpin**: a flat SVG thumbtack (red head, silver needle) placed at the horizontal center of the selected district, 8px from the top. Renders above the map boundary via `overflow: visible` — intentional
- Selection no longer uses an inner stroke border (previously caused rendering artifacts); hover and selected states use the existing darker fill variants only

---

### Unit detail view

- Removed the two-column (leader / other members) layout
- All members now in a single full-width list, leader indicated with ★
- No more "No other members" empty state — the leader is always a member
- Member row text, dot, and star scaled up for readability

---

### Person model (v0.4.x carry-forward, documented here)

- `Person` is the core simulation type: `{ id, name, role, health, items, unitId }`
- `Unit` is a container: `{ id, label, districtId, personIds, leaderPersonId }`
- Wound states: HEALTHY (≥70 HP) · WOUNDED (30–69) · CRITICAL (<30) — shown on cards and in detail view
- Leader star pulses red on CRITICAL

---

### COMMS window

- Inbound-only radio/emergency broadcast feed styled as scanner chatter
- Messages generated from game events: units engaging, districts falling, spread events, clears
- Static noise markers (`<wzzt>`, `<szzt>`) embedded in transmissions

---

## [0.1.0] — 2026-06-13

### Overview

First playable version. Dispatch is a browser-based zombie outbreak coordinator — the player sits at a command center, dispatches government units across a city map, and must contain an outbreak using incomplete information. The core design tension is that the player never sees exact zombie counts unless they actively build that awareness through radio units or god mode. The game is technically winnable but not easily so, and the real experience is the city and the people in it rather than the score.

---

### Map

- 14 named districts across 5 categories: Residential, Government, Medical, Retail, Industrial
- Fixed inline SVG map, no scrolling or panning — a paper map pinned to the desk
- Pastel category fills (color = identity, never threat level)
- Click to select a district; hover brightens fill only
- Selected district shows a red inner-stroke border (clip-path technique to prevent bleed into neighbors)
- District labels and category text rendered on the SVG in dark ink

---

### Simulation

- Tick-based loop (3.5 seconds per tick)
- Local spread: each tick, zombies in a district convert a portion of the human population (rate suppressed by units present — each unit reduces local spread rate by 12%, capped at 80%)
- Inter-district spread: 10% chance per tick that zombies spill from an infected district into a random neighbor (units in the source district can block this — 15% per unit, capped at 70%)
- Outbreak seeds at game start based on selected scenario

---

### Units

Three unit types, each with a starting location and loadout:

| Type | Starting Location | Items |
|---|---|---|
| Police | Police HQ | Gun × 3 |
| Fire | Fire Station | Fire Axe × 3 |
| Civilian | City Hall | First Aid Kit + Radio × 2, First Aid Kit × 1 |

- Each unit has 100 HP; units can die permanently
- Units are displayed as colored cards in the left panel, grouped by district
- HP shown as a 10-segment bar (green → amber → red as health drops)
- Clicking a unit card opens its detail view: type, location, HP bar, item chips, dispatch controls

---

### Combat

When units are present in a district with zombies, combat resolves each tick:

- **Attack phase** — each unit rolls to kill one zombie. Hit chance: Gun 70%, Fire Axe 65%, unarmed 50%
- **Counterattack phase** — zombies strike back. Number of strikes = unit count at start of tick. Each strike targets a unit weighted by threat modifier (Police 3×, Fire 2×, Civilian 1×), so front-line units absorb the majority of hits. Damage: 10 HP per hit
- **Medic phase** — after counterattacks, Civilian units carrying a First Aid Kit heal the most critically wounded unit in the district (≤50 HP threshold). Restores 20 HP. Kit is consumed on use

---

### Information Design

Player information is deliberately restricted:

- **Default state** — clicking a district shows its name and category only. No counts
- **God mode** — toggleable overlay (persists in localStorage). Reveals a full situation report: all 14 districts alphabetized with live human count, zombie count, and effective spread rate. Spread rate shown in teal when suppressed by units
- **Radio intel** — when a Civilian carrying a Radio is present in a district, that district's live counts are visible in the info panel (marked RADIO INTEL). If the Civilian dies or redeploys, intel goes dark
- **Contacts panel** — callers drip-feed zone information via a texting-style interface. 10% chance per tick that an infected district triggers a call. Messages are timestamped with game time. Contacts accumulate over the game; unread messages show a teal dot. Caller pool includes named individuals and unknown callers

---

### Items

Each item is displayed as a colored chip in the unit detail view. Clicking a chip opens a description panel with mechanical details.

| Item | Color | Effect |
|---|---|---|
| Gun | Brass | Attack hit chance 70% |
| Fire Axe | Orange | Attack hit chance 65% |
| First Aid Kit | Red | Civilian heals most critical unit at ≤50 HP; consumed on use |
| Radio | Grey | Reveals live counts for the unit's current district |

---

### UI Structure

- **Three-column layout** — units/contacts panel (left), city map (center), district info/legend/situation report (right)
- **Left panel states** — base view (units + contacts list) → unit detail → item description; or base view → contact chat thread. All transitions use the same slide-over pattern
- **Topbar** — tick counter and elapsed game time (white, always visible), god mode toggle

---

### Start Screen

- Title screen overlays the game until the player starts
- Scenario dropdown with two options:
  - **Default** — 15 zombies seed in Millbrook at game start
  - **Custom** — exposes all 14 districts with +/− controls to set any starting count per zone
- Tick loop does not start until Start Mission is clicked

---

### Win / Lose

- **Win** — all zombies eliminated. "OUTBREAK CONTAINED" overlay shows tick count and elapsed time
- **Lose** — all units dead. "ALL UNITS LOST" overlay shows tick count and elapsed time
- Both end states offer a Restart button that reloads to the start screen
