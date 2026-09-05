"""Bake the residence pool: anonymous houses a scripted caller can be "at home" in.

Writes public/data/residences.json:
  { "note": ..., "districts": { districtId: [ { "id": osmWayId, "c": [lon, lat], "a": area_m2 }, ... ] } }

Candidates are OSM buildings inside a district polygon that look like single-family houses:
tagged house-ish (or the untagged `building=yes` that most Lexington houses carry), with a
footprint between MIN_AREA and MAX_AREA m², no name, no amenity/shop/office tag. Up to PER_DISTRICT
are sampled per district (seeded, so re-runs are stable). Ids in public/data/residence-exclude.json
are dropped — that list is hand-curated from the in-game HOUSES test view. No addresses are stored
on purpose: the game shows "Private residence", never a real street address.

Run from the repo root or spike-map/:  python bake/residences.py
"""
import json, os, random
import osmnx as ox
from shapely.geometry import Point, shape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # repo root; data lives in public/data
DATA = os.path.join(ROOT, "public", "data")
cfg = json.load(open(os.path.join(HERE, "config.json")))
b = cfg["bbox"]
bbox = (b["west"], b["south"], b["east"], b["north"])

HOUSE_TAGS = {"house", "detached", "semidetached_house", "bungalow", "terrace", "residential", "yes"}
NOT_HOUSE_KEYS = {"amenity", "shop", "office", "name", "tourism", "leisure", "healthcare", "craft",
                  "industrial", "religion", "school", "brand", "operator"}
MIN_AREA, MAX_AREA = 70, 320     # m² — a single-family footprint; below is a shed, above is a block
PER_DISTRICT = 300
SEED = 20260904

districts = json.load(open(os.path.join(DATA, "districts.geojson")))
polys = [(f["properties"]["id"], shape(f["geometry"])) for f in districts["features"]]
exclude_path = os.path.join(DATA, "residence-exclude.json")
exclude = set(json.load(open(exclude_path))) if os.path.exists(exclude_path) else set()

print("downloading buildings for", bbox, flush=True)
gdf = ox.features.features_from_bbox(bbox=bbox, tags={"building": True})
print("buildings:", len(gdf), flush=True)

# metric area via a local UTM projection
gdf_m = ox.projection.project_gdf(gdf)
areas = gdf_m.geometry.area

pool = {d: [] for d, _ in polys}
kept = dropped_tag = dropped_size = dropped_named = 0
for idx, row in gdf.iterrows():
    kind, osmid = idx if isinstance(idx, tuple) else ("way", idx)
    if kind != "way":
        continue
    geom = row.geometry
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        continue
    btag = row.get("building")
    if not isinstance(btag, str) or btag not in HOUSE_TAGS:
        dropped_tag += 1
        continue
    if any(isinstance(row.get(k), str) for k in NOT_HOUSE_KEYS):
        dropped_named += 1
        continue
    a = float(areas.loc[idx])
    if not (MIN_AREA <= a <= MAX_AREA):
        dropped_size += 1
        continue
    if int(osmid) in exclude:
        continue
    c = geom.centroid
    p = Point(c.x, c.y)
    for did, poly in polys:
        if poly.contains(p):
            pool[did].append({"id": int(osmid), "c": [round(c.x, 6), round(c.y, 6)], "a": round(a)})
            kept += 1
            break

rng = random.Random(SEED)
for did in pool:
    rng.shuffle(pool[did])
    pool[did] = pool[did][:PER_DISTRICT]

out = {
    "note": "Anonymous residence candidates per district (OSM way ids + centroids, no addresses). Curate via residence-exclude.json and re-bake.",
    "districts": pool,
}
path = os.path.join(DATA, "residences.json")
json.dump(out, open(path, "w"), separators=(",", ":"))
print(f"kept {kept} candidates (dropped: tag {dropped_tag}, named/tagged {dropped_named}, size {dropped_size}, excluded {len(exclude)})")
for did, lst in pool.items():
    print(f"  {did:11s} {len(lst):4d}")
print("wrote", path, f"({os.path.getsize(path)/1e3:.0f} KB)")
