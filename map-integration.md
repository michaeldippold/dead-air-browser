# Map v3 — Integration Handoff

> **Purpose.** Everything a fresh session needs to build the real-Lexington map into Dead Air
> without re-opening a single decision. `design.md` ("The Map") holds the *why*; this file holds
> the *what and how*: what was ruled, what the spike proved, the numbers to carry over, and the
> build order with the exact touchpoints in `main.js`. If something here contradicts `design.md`,
> `design.md` wins and this file has a bug. **Do not relitigate the Locked list.**
>
> Written 2026-09-04 at the end of the spike sessions. The spike lives in `spike-map/` and runs
> with `npm --prefix spike-map run dev` (port 5679; also `spike-map` in `.claude/launch.json`).
> Open it before starting — it is the visual spec.

---

## 1. Locked decisions (ruled by the owner, with their eyes on the spike)

| # | Decision | One-line why |
|---|---|---|
| 1 | **Stack: MapLibre GL JS + self-hosted PMTiles + our own baked road graph and A\* + a small authored GeoJSON.** | 911 Operator look; MapLibre already does tiles, labels, styling, pitch. three.js rejected. |
| 2 | **District = the sim's unit of *state*. Road position = the unit of *place*.** A unit always has a real position; its `districtId` is *derived* by point-in-polygon. | Kills "everyone lives in one apartment in the middle of the district." |
| 3 | **Nine districts, built from named road corridors, drawn by the map not the other way round.** Downtown, Northside, East End, Chevy Chase, University, Southside, Red Mile, West End, Hamburg. Names and count were declared non-sacred and this set was accepted as "naturalistic, dictated by the map." | The old 14 were a compromise for a flat SVG. |
| 4 | **Two tiers of places.** *Authored* (baked footprints, always drawn, always clickable, dispatch targets) and *free* (any named building from the tiles: hover name + card, **not** a dispatch target). | The map tells you where; callers tell you what. |
| 5 | **Only two dispatch targets: a district, or an authored place.** Bare map never dispatches. | Sending to the wrong place can gimp a run; be explicit. |
| 6 | **Left-click = select / dispatch-with-default. Right-click = context menu with the explicit verb** (district: ENGAGE / HIDE / SCAVENGE; place: dispatch / show; unit: select / follow / return to station). **Middle-drag = rotate + pitch. Left-drag = pan. Esc = close menu, then deselect. Clicking bare map deselects.** | Owner: "a MUCH more intuitive way to do it." |
| 7 | **Arrival at a district: ENGAGE patrols (routed laps to random interior nodes, never leaving the polygon); HIDE parks at the entry node; SCAVENGE wanders between the district's businesses.** Entry node = nearest routable node *inside* the polygon to where the unit is (near-edge arrival). | Six units look like six cars working a neighborhood. |
| 8 | **Arrival at a place: the unit goes INSIDE.** Car leaves the map; the place's diamond wears one badge per unit *type* (police blue, fire red, civilian white) in a row to the right, each a chunky white digit outlined in black. Units start the night inside their stations. Badges, diamond and footprint all click to the place. | A car at the curb reads as "parked outside"; the story beats happen inside. This is where the arriving-at-a-place script hook fires. |
| 9 | **In transit, a unit belongs to no district** even while its route crosses three of them. | Prevents "driving through" being free suppression. Predates the map. |
| 10 | **Travel time is derived from the route** (length over per-edge road speed, with danger multipliers). The hop constant retires. | Real geography, real ETAs. |
| 11 | **Danger paint = "streets": red heat blooming along the district's own roads**, weighted by the district's single danger number, pooling at big intersections. Boundary reddens with it. **Darkening ("cold" shroud) only when a district has no humans left.** Both together read as DIRE, which is the goal. | "Screams heatmap without being a heatmap." Flat red polygon was rejected. |
| 12 | **Danger paint, cold shroud, and district status are gated by intel** exactly like the sidebar (radio / binoculars / god mode). No intel, no paint. **No infection heat field, no per-cell grid, no sim layer finer than the district.** | The clean-numbers rule. Explicitly out of scope in `design.md`. |
| 13 | **Your own units are fully known.** Positions, routes, per-unit ETA on hover, ETA for every available unit on selecting a target — all encouraged. | Dispatchers know where their cars are. |
| 14 | **Caller pins appear on disclosure**; a caller sent Outside becomes a dashed *last-known* ring at the place they left. Caller movement is never animated. | See `design.md`, Movement & Risk. |
| 15 | **Routes read danger.** Edge cost multiplier from the district the edge runs through (`1 + 2.5 × danger`). Units bend around bad districts; the player watches it happen. | Blocked streets / held corridors are the natural later extension. |
| 16 | **Strong district boundaries are the default**, with a *map settings* toggle for the subtle look. Palette: residential cyan `#7fd6ff`, government violet `#b9a3ff`, retail amber `#ffcf5a`, industrial steel `#c9d2dc`, medical rose `#ff8fb0`. | Blues sank into the navy basemap; the strong look also lifts the roads. |
| 17 | **Follow mode flies to a chase view** (zoom +1.5, min 16.3, pitch 62) and owns the wheel while following. | Recentering every frame cancels MapLibre's zoom easing, so zoom felt dead. |
| 18 | **Layout: DISPATCH and MAP merge into one window** (roster as a collapsible strip over the map); CONTACTS and COMMS stay as closable sidebars. **It is still a window on the desktop — never full-bleed.** It takes most of the width by default and grows when a sidebar is closed, but the badge wallpaper, desktop icons and taskbar remain visible around it, and it drags, resizes, minimizes and maximizes like every other window. Desktop PC is the target. | Owner ruling, twice: the desktop is flavor and stays. Panels "need design TLC post-integration" — expected, not a blocker. |
| 19 | **Technical constraints are relaxed.** Build tools, vendored deps, a Python bake, paid hosting — all fine. The only rule: playable and fun in the browser. | Owner ruling. |
| 20 | **"© OpenStreetMap contributors" stays visible.** ODbL. | Non-negotiable. |

Explicitly *deferred* (not blockers, don't build them first): per-building tint by district (needs our own buildings layer), heat-look fine tuning, a badge digit that reads at overview zoom, the address pool for generic callers, caller Outside travel, SCAVENGE wander (needs place kinds), blocked streets.

---

## 2. What the spike proved, and what to carry over

`spike-map/` is throwaway *code* but its **modules are the reference implementation** — port them, don't rewrite from memory.

| Spike file | Carries over as | Notes |
|---|---|---|
| `src/graph.js` | `src/map/graph.js` | Load `roads.json`, `kdbush` nearest-node snap, A\* with time cost, emergency factor, U-turn penalty (45 s), `pointInRing`. Verbatim. |
| `src/districts.js` | `src/map/districts.js` | `loadDistricts()`, `districtAt()`, `tagEdges()` (edge → district by midpoint; interior node lists), `entryNode()`, `patrolRoute()`, `dangerMultiplier`, `centroid()`. Verbatim. |
| `src/main.js` — style section | `src/map/style.js` | The flavor overrides, the `DROP` regex (pois, address labels, shields, boundaries, country/region places, oneway arrows), `roads_labels_minor` at z≥15.5, `roads_labels_major` at z≥14, subplace labels at z≥13 at 55%, buildings as `fill-extrusion` (height `coalesce(height, 7)`, fade in 13.5→14.5, vertical gradient). |
| `src/main.js` — icons | `src/map/icons.js` | `carIcon`, `placeIcon` (diamond), `badgeIcon` (role dot + outlined digit), all canvas-drawn, `map.addImage`. Pre-generate `badge-{role}-{1..9}`. |
| `src/main.js` — units / mover | `src/map/mover.js` (renderer-side) + sim changes (§4c) | `buildRoute` (coords, cumulative metres, per-segment kph, per-segment edge index), `advance`, `arrive`, `nextNodeAndRemainder` (re-dispatch mid-edge continues from the far end of the current edge — no teleport), `remainingSeconds`. |
| `src/main.js` — layers | `src/map/layers.js` | Order matters (see §2.1). |
| `src/main.js` — interaction | `src/map/interact.js` | `hit()` priority: units → badges → places → footprint → free POI → district. Hover tooltip, click semantics, context menu, middle-drag rotate, follow. |
| `src/spike.css` | game CSS | Panel / row / badge / context-menu styles are placeholders; the game's theme system replaces the colors. Keep the *structure* (`#ctx`, `.ctx-item`, `.row .status.{moving,patrol,inside}`). |
| `vite.config.js` | root `vite.config.js` | `optimizeDeps.exclude: ['maplibre-gl']` is **required** — pre-bundling orphans MapLibre's worker module (404, style never loads). |

### 2.1 Layer order (bottom → top)

`district-fill` (under `buildings`) → `roads-dim` (shroud helper, under `buildings`) → `footprint-fill` (under `buildings`) → basemap `buildings` (extrusions) → `district-shroud` → `heat` → `district-glow` → `district-line` → `district-label` (own point source, one centroid per district — *not* the polygon source, or labels repeat per tile) → `poi-hit` (invisible circles over tile POIs) → `footprint-line` → `place-ring` (gold, only with contacts) → `places` (diamond + label) → `place-badge-0/1/2` → `route-glow` → `route-line` (animated dash) → `unit-halo` → `units` (car + name).

### 2.2 Numbers (all verified live; change deliberately, not by accident)

| Thing | Value |
|---|---|
| Camera default | center `[-84.4977, 38.0406]`, zoom 13.4, pitch 52, bearing −12; `minZoom` 11, `maxZoom` 18; `maxBounds` = bbox padded 0.03° |
| Bbox (bake config) | W −84.63, S 37.96, E −84.38, N 38.12 — includes Fayette Mall, Keeneland, Hamburg, the airport |
| Moving speed | edge kph × 1.15 (lights and sirens), per segment, so cars slow on residential streets |
| Patrol speed | min(edge kph, 30) |
| A\* cost | `len / (kph/3.6)`; × 0.7 when `emergency`; × `dangerMultiplier`; + 45 s U-turn penalty |
| Danger multiplier | `1 + 2.5 × danger[district]` (edge's district by midpoint; 1 outside coverage) |
| Patrol leg | random interior node ≥ 150 m away, route restricted to in-district edges (off-district edges cost ∞), 10 tries, fallback: any outgoing edge |
| Heat layer | weight = district danger; points = every 3rd vertex of every in-district edge; radius z12 9 → z14 18 → z16 40; intensity z12 0.16 → z14 0.26 → z16 0.45; ramp 0 transparent, 0.15 `rgba(70,4,18,.4)`, 0.45 `rgba(150,12,30,.6)`, 0.75 `rgba(215,40,40,.78)`, 1 `rgba(255,90,60,.9)`; opacity 0.85 |
| Cold shroud | fill `#03050a` at 0.7 over the district (above buildings, so rooftops poke through in the pitched view); label greys to `#4a5570` |
| District fill | strong: 0.20 (default); subtle: 0.09; +0.08 on hover |
| District line | strong: 3.2 px (+1 × danger); subtle: 2.2; hover 3.5; color → `#ff3b3b` at danger 1; glow 9 px blur 4 at 0.30 (strong) / 0.14 (subtle) |
| Place icon | 36 px diamond; `icon-size` z12 0.8 → z16 1.35; label 12.5 px from z12.6 |
| Badges | 34 px; `icon-offset` `[34 + slot×30, 0]` (icon pixels, scale with icon-size); slots fill police → fire → civilian |
| Car icon | 48 px; `icon-size` z12 0.5 → z16 1.1; `icon-rotate` = bearing, map-aligned |
| Follow | target zoom `max(current + 1.5, 16.3)`, pitch 62, fly 1100 ms; wheel: `target −= deltaY × 0.0035`, clamped 13–18, eased at 8/s |
| Time scale | spike keys 1/2/3 = 1× / 6× / 20×. **The game's clock is 20×** (1 tick = 3 s real = 1 game minute), so real road times map directly: a 5-minute drive = 5 ticks = 15 real seconds. |

---

## 3. Data and the bake (one-off; all outputs committed in `spike-map/public/data/`)

| File | Made by | What |
|---|---|---|
| `lexington.pmtiles` (10 MB) | `pmtiles extract https://build.protomaps.com/20260904.pmtiles … --bbox=-84.63,37.96,-84.38,38.12 --maxzoom=15` (go-pmtiles CLI) | Basemap tiles. Served statically; needs HTTP Range (Vite, `serve`, GitHub Pages, Netlify all do). |
| `roads.json` (7 MB) | `bake/roads.py` (osmnx 2.x) | Drivable graph: strongly-connected, directed, per-edge `len`, `kph`, `hw`, `name`, `ref`, `oneway`, `geom`. 11 264 nodes / 27 363 edges. |
| `landmarks.json` (0.5 MB) | `bake/landmarks.py` | 887 named OSM features a story could care about (hospitals, schools, parks, stadiums, malls, churches, industrial…), with footprints (≤120 pts) and addresses. **The authoring pool.** |
| `districts.geojson` | `bake/districts.py` | Nine road-following polygons. |
| `places.json` | `bake/districts.py` | The 69 authored places (`id, name, kind, osm, lonlat, district, footprint?, addr?`). |
| `pois.json` | `bake/roads.py` | Legacy; superseded by `places.json`. Delete when convenient. |
| `config.json` | hand | bbox, center, build URL. Every script and the runtime read it. |

**How districts are built** (so you can move a boundary in one minute): each entry at the top of `bake/districts.py` is a clockwise loop of *legs*; a leg is a set of street names (the same road changes name). The tool finds junction nodes between consecutive legs (clustered to one per 250 m), routes along each leg between junctions with **off-name detours at an 8× penalty** (so a gap between two names doesn't break the loop), DP-picks the junction combination with the shortest total, emits the ring, then **folds any fully-enclosed hole into the neighbor sharing the most boundary** (Woodward Heights was orphaned this way and is now Downtown). "no shared node … closest pair N m" lines are informational. `OVERLAP` lines over ~0.1 km² are a spec bug. To change a boundary: name the road, edit the leg, re-run (≈40 s).

**Places are picked by name** in the same spec; when a name repeats (every Kroger) the candidate inside the district wins; a place outside every district is dropped with a `NOTE`. Add a place: append its exact OSM name (look in `landmarks.json`) to the district's list.

---

## 4. The districts (as baked)

| id | Label | Category | km² | Adjacent to | Places (n) |
|---|---|---|---|---|---|
| `downtown` | Downtown | government | 3.7 | northside, eastend, chevychase, university, redmile, westend | 10 — Rupp Arena, LFUCG Government Center, Central Library, LPD HQ, Transylvania, Kentucky Theatre, Thoroughbred Park, Opera House, BCTC, Fire Station #3 |
| `northside` | Northside | residential | 8.2 | downtown, eastend, westend | 6 — Castlewood Park, Legends Field, Lexmark, Fire Station #1, LFD Station 2, FedEx |
| `eastend` | East End | residential | 5.9 | downtown, northside, chevychase, hamburg | 5 — Idle Hour CC, Idle Hour Park, Breckinridge ES, Johnson Heights Park, Kentucky Ballet Theatre |
| `chevychase` | Chevy Chase | residential | 11.8 | downtown, eastend, university, southside, hamburg | 6 — Ashland (Henry Clay Estate), Woodland Park, Henry Clay HS, Kentucky Children's, Ecton Park, Fire Station #9 |
| `university` | University | government | 8.0 | downtown, chevychase, southside, redmile | 10 — Kroger Field, Chandler Hospital, Good Samaritan, Memorial Coliseum, VA, W.T. Young Library, Fire Station #5, Fire Station #6, Picadome ES, Lafayette HS |
| `southside` | Southside | retail | 22.8 | chevychase, university | 10 — Fayette Mall, Shillito Park, Baptist Health, UK Arboretum, Lexington Christian, Zandale Park, Tates Creek Library, Fire Station #15, The Summit, Kirklevington Park |
| `redmile` | Red Mile | retail | 11.1 | downtown, university, westend | 5 — Red Mile, Saint Joseph Hospital, Turfland Mall, Cardinal Hill, Gay Brewer Golf Course |
| `westend` | West End | industrial | 11.5 | downtown, northside, redmile | 8 — Calvary Cemetery, Cove Haven Cemetery, McConnell Springs, Douglass Park, Marathon Terminal, Kentucky Utilities, Cardinal Valley ES, Marksbury Library |
| `hamburg` | Hamburg | retail | 15.5 | eastend, chevychase | 9 — Hamburg Pavilion, Costco, Meijer, Walmart, Baptist Health Hamburg, Sam's Club, Frederick Douglass HS, Regal Cinemas, Target |

Adjacency above is *derived from the polygons* (shared boundary > 300 m). **Compute it at load from the geometry**; don't hand-maintain a table. Ground outside every district (beyond New Circle except Southside/Hamburg) is *outside coverage*: rendered, hoverable, never a dispatch target, never simulated.

**Old → new id mapping** (for scripts, loot, seeds):
`northgate`, `millbrook` → `northside` · `eastridge` → `eastend` · `westgate`, `memorial` → `university` · `police-hq`, `fire-station`, `city-hall`, `market` → `downtown` · `ironworks`, `industrial` → `westend` · `riverside` → `chevychase` · `commerce` → `hamburg` · `southend` → `redmile`.

**Two-letter codes** (`DISTRICT_CODE`): DT, NS, EE, CC, UN, SS, RM, WE, HB. (`TU` for the tutorial pseudo-source still needed, per todo.md.)

**Starting humans** (same ~11k total as today, roughly by real population; tune later): downtown 900, northside 1400, eastend 1100, chevychase 1500, university 1300, southside 1800, redmile 1000, westend 900, hamburg 1100.

**Lose threshold**: `DISTRICTS_LOST_LIMIT` is 10 of 14 (71%). Make it **6 of 9** (67%).

---

## 5. Build order, with `main.js` touchpoints

Each step leaves the game playable. Line numbers are from `main.js` @ commit `3faeecd` (2 984 lines) and will drift; grep the symbol.

### a. Tooling — move the game onto Vite *(done 2026-09-04)*
- `npm init` at repo root; deps `maplibre-gl@6`, `pmtiles@4`, `@protomaps/basemaps@5`, `kdbush@4`; dev dep `vite`. Copy `spike-map/vite.config.js` (the `optimizeDeps.exclude` line is load-bearing).
- `index.html` already loads `main.js` as a module; Vite serves it as-is. `scripts/*.js` are static ES modules — fine.
- Move `spike-map/public/data/*` to `public/data/`. Delete `pois.json`.
- `.claude/launch.json`: `dispatch` becomes `npm run dev` on 5678. `RELEASE.md`: add `vite build` → deploy `dist/`. Hosting: any static host with Range support (GitHub Pages works for a 10 MB tile file; the repo is `michaeldippold/dead-air-browser`).
- Keep `?map=2d` as a switch that skips map init and shows the SVG, until step **i**.
- *As built:* root `package.json` / `vite.config.js` / `.gitignore`; `public/data/` (pois.json gone) and
  `public/images/` (the icon SVGs are referenced from inline `style` attributes, which Vite does not
  bundle — anything under `public/` is copied verbatim). The spike still runs, with `publicDir: '../public'`,
  and the bake scripts write to the root `public/data/`. `MAP_2D` constant is in `main.js`, unused until §5d.
  Launch configs: `dispatch` (dev, 5678), `dist-preview` (`vite preview` of `dist/`, 4173), `spike-map` (5679).

### b. Re-key the districts *(done 2026-09-04)*
- `state.districts` (~L793): nine entries per §4 with `label`, `category`, `humans`, `zombies: 0`, `unitIds: []`, `loot: rollLoot(id, category, n)`.
- `LOOT_POOLS` (~L755): keep the *category* pools; drop per-district overrides unless a district wants one.
- `adjacency` (~L862) → computed from `districts.geojson` at load (shapely-style: shared boundary length; port the 25 m buffer / 300 m rule from the bake, or simpler: two rings share ≥ 3 vertices). `computeHopDistances` (~L879) stays for spread only, or retire it.
- `DISTRICT_CODE` (~L899) per §4.
- `DISTRICTS_LOST_LIMIT` → 6. `seedFromDifficulty` (~L2610) is generic; `numDistricts` in `SCENARIOS` (L23/31) still fine.
- Scripts: `scripts/danny.js` `northgate` → `northside`; `scripts/e-novak.js` `memorial` → `university`; `scripts/marcus-webb.js` `ironworks` → `westend`. Update in-dialogue place names (E. Novak is at Good Samaritan, which is in University; Marcus Webb's "Old Iron Works, Loading Dock" → Marathon Terminal or Kentucky Utilities in West End — owner's call, both are real industrial footprints).
- `index.html` SVG polygons and labels: leave for `?map=2d`, or delete with step **i**.
- *As built:* `state.districts` is filled from `districts.geojson` at load (`src/map/districts.js`, ported verbatim from
  the spike, plus `adjacencyFromPolygons()` — shared boundary vertices, ≥3, matches the §4 table exactly). Starting
  humans / loot depth live in `DISTRICT_SEED`. Units spawn in `downtown` (LPD, Govt Center) and `northside`
  (Fire Station #1) until §5c/f put them inside the stations. Marcus Webb's opening line is now the Marathon
  terminal loading dock and his push is "east" (the terminal is west of downtown). The SVG fallback is a
  schematic 3×3 of the nine districts.

### c. Sim: position vs state *(done 2026-09-04)*
- `makeUnit` (~L82): add `pos: [lon,lat]`, `node`, `route: null`, `progress: 0`, `place: null`, `home: placeId`. `districtId` stays as a field but is **written only by** `arrive()` / `districtAt(pos)`, never by dispatch.
- `dispatchUnit` (~L1983): replace `hopsBetween × UNIT_TICKS_PER_HOP` with a route: `route(from, toNode, { emergency: true, multiplier: dangerMultiplier })`. Target is `{ district, activity }` or `{ place }` (§1 #5). Push a transit as today (`kind: 'unit'`, `srcId`, `destId`, `etaMs`) but with `ticksRemaining = ceil(route.seconds / 60)` and the route attached; the TRAVELING panel, `unit-departs` / `unit-enters` director events, and `respondContactId` keep working unchanged.
- `resolveTransits` (~L2024): on tick, `ticksRemaining--` as today; **arrival is still tick-driven** (deterministic for scripts). The *renderer* interpolates the car along the route on wall clock at 20× between ticks (spike's `advance` with `timeScale = 20`), clamped so it never visually arrives before the tick does. On arrival: `arrive()` sets `pos`, `node`, `districtId = districtAt(pos)` (or `place`), then patrol / park / inside per activity (§1 #7–8).
- Patrol is renderer-side motion **plus** a sim fact: while patrolling, the unit's `districtId` is the district; its `pos` wanders. `unitsInDistrict` (~L616) and everything downstream keep reading `districtId`. Nothing in the tick loop reads `pos`.
- `UNIT_TICKS_PER_HOP` retires. `PERSON_TICKS_PER_HOP` stays for caller Outside travel (deferred).
- Intel: `districtHasRadio` / `districtHasBinoView` (~L716) unchanged; the renderer's `danger[id]` is `zombies/(humans+zombies)` **only if** intel, else 0; `cold[id] = humans === 0` **only if** intel (silence otherwise — COMMS going dark already carries it).

### d. Renderer module and window *(done 2026-09-04)*
- New `src/map/` from §2. Map container is `#map-container`'s body (the SVG wrap is replaced). MapLibre needs a `ResizeObserver` on the container calling `map.resize()` — the window manager resizes/maximizes windows (`toggleMaximize`, edge drags) — MapLibre's own `trackResize` covers most but not CSS-driven layout changes; observe explicitly.
- Hooks in, not imports out: the renderer receives `{ units, districts, places, danger, cold, contacts }` getters and emits `select-unit`, `dispatch`, `select-place`, `select-district`. The sim never imports the renderer (spike architecture; also the idle-civ rule).
- `renderUnitDots` (~L2418) → `pushUnits()`; `renderTravelingPanel` (~L2460) stays as the list (it already sorts by soonest arrival).

### e. Layout merge (§1 #18) *(done 2026-09-04)*
- **Windowed, not full-bleed.** The merged window is one more `.win` managed by `initWindowManager` — titlebar, pin, minimize, maximize, edge-resize, all as today. The desktop (`#desktop-badge`, `#desktop-icons`, taskbar) stays exactly as it is and stays visible around the windows. Do not make the map the page background.
- `WIN_IDS` / `LAYOUT_WIN_IDS` (~L937): `dispatch` and `map` become one window id `ops` (or keep `map` and fold DISPATCH's body in). `resetLayout` (~L957): `contacts` on the left, `radio` on the right, `ops` fills everything between them — on a 1080p desktop that is most of the width already. Closing or minimizing a sidebar lets `ops` widen into its space (recompute in `resetLayout`, or just let the player drag; both are fine). Maximize gives the map the full desktop minus the taskbar, which is as close to full-bleed as it ever gets, and it is the player's choice.
- The unit roster (`#units-list`, cards/badges layouts) becomes a collapsible strip over the map (top-left in the spike). Roster hover → unit hover state + route highlight; roster click → select. Unit detail (`#unit-detail-view`) stays as the strip's expanded state; its dispatch `<select>` is now redundant with map dispatch — keep for keyboard users or drop.
- District detail (`#district-detail-panel`, `renderDistrictDetail` ~L1517) becomes the district card (right side). Place card is new (§2 spike `showPlace`: name, kind, address, district, units inside, en route, named callers with status, dispatch link).
- Wallpaper (`#desktop-badge`) untouched.

### f. Places and callers *(done 2026-09-04; caller Outside travel / last-known ring deferred as planned)*
- `places.json` loads; `contacts` gain `placeId | null`, `disclosed: false`, `lastKnownPlaceId`. `makeContact` (~L86) `location` (district) stays for the sim; the pin is `placeId` once `disclosed`. Scripts set `place: 'good-samaritan-hospital'` next to `district`; the opening node (or a `disclose` action in `SCRIPT_ACTIONS`) flips `disclosed`. Ambient/generic callers: no pin until the address pool exists (deferred) — they show on the district only.
- Existing four + Barbara (**settled by the owner 2026-09-04; easy to move later**): E. Novak → `good-samaritan-hospital`; Marcus Webb → `marathon-terminal` (West End; his "Old Iron Works, Loading Dock" line becomes the terminal's loading dock); Danny → `castlewood-park` (Northside); Holt is mobile (no pin); Barbara none.
- `arriveOnCall` (~L153): when the responding unit reaches the contact's place, it goes INSIDE (§1 #8); that is the hook for "meeting survivors" beats.

### g. Verbs *(done 2026-09-04; SCAVENGE parks like HIDE until the wander lands)*
- Context menu (§1 #6). ENGAGE / HIDE / SCAVENGE map to the existing `unit.activity` (`'engage' | 'hide' | 'scavenge'`, ~L1623). SCAVENGE's wander is deferred; it parks like HIDE until then.

### h. Settings *(done 2026-09-04 — MAP select in the taskbar; the dev danger sliders were not ported, god mode + SITREP cover it)*
- Map settings (in the existing theme/UI area): boundaries strong / subtle. Paint-mode cycling and danger sliders are **dev-only** (god mode).

### i. Retire the SVG map *(done 2026-09-04)*
- Delete `#map-svg-wrap`, the polygons, `map-palette-select`, `#districts polygon` CSS, `renderUnitDots`, `roster-hover` polygon code, and `?map=2d`.

### j. Attribution *(done 2026-09-04)*
- `© OpenStreetMap contributors · Protomaps` visible in the map window's corner. Already in the spike.

### As built (2026-09-04) — notes for the next session

- **Module map.** `src/map/graph.js`, `districts.js` (verbatim + `adjacencyFromPolygons`), `style.js`, `icons.js`,
  `layers.js`, `mover.js`, `interact.js`, `index.js` (`createMapRenderer({ stage, mapEl, tipEl, ctxEl, cfg, get, on })`).
  `main.js` talks to the renderer only through `mapRenderer.{refresh, pushDistricts, setSelected, hoverUnitById,
  litPlace, flyTo, setBoundaries}` and the `get`/`on` hooks. `window.DA` is a dev hook (state, PLACES, map, mover).
- **Unit fields.** `pos, node, bearing, route, progress, status ('moving'|'patrol'|'parked'|'inside'), place, home,
  targetLabel`. The tick loop reads none of them. `dispatchUnit(unitId, target, opts)` takes a district id string,
  `{ districtId, activity }` or `{ placeId }`; a caller dispatch is redirected to the caller's place once disclosed.
- **Pacing.** `ticks = ceil(driveSeconds / 60)`; `mover.pace()` stretches the car's motion so it lands on the tick.
  `driveSeconds` = sum of len / (kph x 1.15 / 3.6) x dangerMultiplier per segment; the A* cost (x0.7 emergency) only
  picks the path. Renderer time scale is 20x (0 when paused).
- **Patrol.** Arrival at a district parks; the renderer's loop starts a patrol leg when `activity === 'engage'` and
  parks again when it isn't, so the ENGAGE/HIDE buttons and the context-menu verbs both just set `unit.activity`.
- **Paint.** `syncMapPaint()` (each render + god toggle + SITREP close) writes `danger[id]` / `cold[id]` in
  `districts.js` and pushes when the key changes. Closing SITREP turns god mode off, which clears the paint; that
  is the gate working, not a bug.
- **Contacts.** `placeId` (from the script's `place`), `disclosed` flips on the first opened thread; `contactsAtPlace()`
  feeds the gold ring, the place card and the tooltip. `lastKnownPlaceId` exists but nothing writes it yet.
- **Worker.** `tools/copy-maplibre-worker.mjs` (predev/prebuild) vendors MapLibre's worker + shared chunk into
  `public/vendor/maplibre/` (git-ignored) and `index.js` calls `setWorkerUrl`. Without it the build 404s the worker
  and dev throws "document is not defined" from the worker's injected HMR client.
- **Dev-server gotcha.** Rewriting `style.css` several times in one second once left Vite serving an empty stylesheet
  (page rendered unstyled); touching the file again fixed it. Not a code problem.
- **UI pass 1 (2026-09-04, owner-directed).** Roster = thin rows (`renderUnitRow`, `unitStatusText` column),
  selection (`selectUnit` / `deselectUnit`) is separate from details (`openUnitDetail` / `closeUnitDetail`,
  unfolds under the list). No dispatch control in the details: the map is the only dispatch surface. One Escape
  rule in main.js (menu → details → unit selection → district/place card + highlight). District selection is a
  `selected` feature-state on the districts source. Cards float inside `#map-stage`. `itemTag()` + a document
  click handler open the ITEMS window at the entry. `renderUnitCard` + card CSS kept but unused.

### Verification checklist (done live 2026-09-04 unless noted)
1. Dispatch to each of the nine districts from LPD; car drives real streets, arrives at the near edge, patrols without stalling for 2 minutes at 20×; roster shows PATROL. *(Hamburg and Southside verified; the other seven were not individually driven, same code path.)*
2. Dispatch to a place; car vanishes; badge appears; place card lists it; re-dispatch brings the car out at the entrance.
3. Two units of different roles in one place → two badges in a row (blue then red).
4. God mode: set a district to 90% → streets bloom red, boundary reddens, ETA through it roughly doubles, routes bend around it. Kill all humans → cold shroud + grey label. Turn god mode off with no radio there → no paint at all.
5. Scripts fire on the new district ids (Danny, E. Novak, Marcus Webb).
6. Window resize / maximize → map re-lays out, no black bars.
7. `vite build` output runs from a static host with the PMTiles loading (Network tab: 206 responses). *(Verified with `vite preview`; a real remote host not yet tried.)*

---

## 6. Things that will tempt you, and the answer

- *"Should the heat be a real infection field?"* No (§1 #12). One number per district.
- *"Should districts be smaller / more of them?"* Nine was accepted. Move a boundary if a road is wrong; don't add districts without the owner.
- *"Should the car stay visible at a place?"* No (§1 #8).
- *"Can we let the player click anywhere to dispatch?"* No (§1 #5).
- *"Right-drag to rotate like every map?"* No; right-click is the game's (§1 #6).
- *"Can the sim read `pos`?"* No. The sim reads `districtId`; `pos` is the renderer's (§1 #2, §5c).
- *"Keep the SVG as a fallback forever?"* Only until step **i**. It was already demoted.
