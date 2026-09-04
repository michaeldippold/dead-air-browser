# spike-map — Dead Air real-Lexington map spike

Throwaway spike for the Map v3 decision (see `design.md` "The Map" and `todo.md` "Map v3").
**Owner-approved 2026-09-04.** The integration handoff is `../map-integration.md`; this code is
its reference implementation — port the modules, don't rewrite them from memory.
Judging: the dark real-city look, units driving real roads, district = state / position =
geography, hover/click, danger paint. Not production code.

## Run

```
npm --prefix spike-map install
npm --prefix spike-map run dev        # http://localhost:5679
```

Also registered in `.claude/launch.json` as `spike-map`.

Controls: click a unit (map or roster) to select it; click it again or press `Esc` to
deselect. With a unit selected, left-click a **district** to dispatch it there (it arrives at
the near edge, then patrols routed laps through the interior) or a **◆ place** to send it inside (the car disappears; the diamond wears a count badge).
Those are the only two targets; bare map deselects. Right-click anything for a context menu
(unit: select / follow / return to station; district: ENGAGE or HIDE; place: dispatch / show).
Middle-mouse drag rotates and pitches (right-drag is given to the menus). Hover a district with
a unit selected for its ETA; hover any named place for its name; click a ◆ place for its card.
Keys: `o` overview, `f` follow selected unit, `b` strong/subtle district boundaries, `p` cycle danger paint (shroud / streets / both),
`1`/`2`/`3` time scale 1×/6×/20×. The DANGER panel is a dev slider: it paints the district's streets red and bends routes
around it; the `cold` checkbox is "no humans left" and drops the dark shroud.

## Bake (one-off, already committed)

Data lives in `public/data/`. Four steps, in order:

```
# tiles: Protomaps daily build, cut to the bbox in bake/config.json (go-pmtiles CLI)
pmtiles extract https://build.protomaps.com/20260904.pmtiles public/data/lexington.pmtiles \
  --bbox=-84.63,37.96,-84.38,38.12 --maxzoom=15

# road graph (with street names) + emergency POIs (osmnx 2.x)
pip install osmnx
python bake/roads.py

# every named OSM feature a story could care about, with footprints and addresses
python bake/landmarks.py

# districts from named road corridors + the hand-picked authored places
python bake/districts.py
```

`roads.json` is the drivable graph (strongly connected component, directed, per-edge speed,
name and geometry). `landmarks.json` is the candidate pool (887 named features).
`districts.geojson` is nine polygons that follow real streets: each district in
`bake/districts.py` is a clockwise loop of street-name legs; the tool finds where consecutive
legs meet, routes along each named road between the junctions (short off-name detours at a
penalty), and emits the ring. `places.json` is the authored list, 5–10 per district, picked by
name from the landmark pool; when a name repeats (every Kroger) the one inside the district wins.
Edit the spec at the top of `bake/districts.py` and re-run to redraw.

## Stack

maplibre-gl 6, pmtiles 4, @protomaps/basemaps 5 (dark flavor, cut down), kdbush, Vite.
`vite.config.js` excludes maplibre-gl from dependency pre-bundling: its worker is a sibling
module resolved via `import.meta.url` and pre-bundling orphans it.

© OpenStreetMap contributors (ODbL).
