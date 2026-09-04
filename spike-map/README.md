# spike-map — Dead Air real-Lexington map spike

Throwaway spike for the Map v3 decision (see `design.md` "The Map" and `todo.md` "Map v3").
Judging: the dark real-city look, units driving real roads, district = state / position =
geography, hover/click, danger paint. Not production code.

## Run

```
npm --prefix spike-map install
npm --prefix spike-map run dev        # http://localhost:5679
```

Also registered in `.claude/launch.json` as `spike-map`.

Controls: click a roster row or a unit to select it. Click a district to dispatch there
(near-edge arrival, then patrol). Click any road to drive to that point. Hover a district with
a unit selected for its ETA. Hover any named place for its name; click it for the place card.
Keys: `o` overview, `f` follow selected unit, `1`/`2`/`3` time scale 1×/6×/20×.
The DANGER panel is a dev slider: it darkens the district and bends routes around it.

## Bake (one-off, already committed)

Data lives in `public/data/`. Reproduce with:

```
# tiles: Protomaps daily build, cut to the bbox in bake/config.json (go-pmtiles CLI)
pmtiles extract https://build.protomaps.com/20260904.pmtiles public/data/lexington.pmtiles \
  --bbox=-84.63,37.96,-84.38,38.12 --maxzoom=15

# road graph + emergency POIs (osmnx 2.x)
pip install osmnx
python bake/roads.py
```

`roads.json` is the drivable graph (strongly connected component, directed, per-edge speed and
geometry). `pois.json` is every named police station, fire station and hospital in the box.

## Stack

maplibre-gl 6, pmtiles 4, @protomaps/basemaps 5 (dark flavor, cut down), kdbush, Vite.
`vite.config.js` excludes maplibre-gl from dependency pre-bundling: its worker is a sibling
module resolved via `import.meta.url` and pre-bundling orphans it.

© OpenStreetMap contributors (ODbL).
