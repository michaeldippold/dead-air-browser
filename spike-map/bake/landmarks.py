"""Bake landmark candidates: every named feature in the box under tags a story could care about.

Writes public/data/landmarks.json: [{name, kind, tag, lonlat, area_m2, footprint?, addr?}]
The authored place list is hand-picked from this file, not generated.

Run from spike-map/:  python bake/landmarks.py
"""
import json, os
import osmnx as ox

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # repo root; data lives in public/data
cfg = json.load(open(os.path.join(HERE, "config.json")))
b = cfg["bbox"]
bbox = (b["west"], b["south"], b["east"], b["north"])

TAGS = {
    "amenity": ["hospital", "police", "fire_station", "university", "college", "library", "townhall",
                "courthouse", "school", "place_of_worship", "community_centre", "bus_station", "prison",
                "theatre", "cinema", "arts_centre", "marketplace", "social_facility", "nursing_home"],
    "shop": ["mall", "supermarket", "department_store", "wholesale", "hardware", "doityourself"],
    "leisure": ["stadium", "park", "sports_centre", "ice_rink", "golf_course", "racetrack", "water_park"],
    "tourism": ["attraction", "museum", "zoo", "hotel"],
    "aeroway": ["aerodrome"],
    "landuse": ["cemetery", "industrial", "retail"],
    "building": ["stadium", "hospital", "university", "warehouse", "industrial", "hotel", "retail"],
    "historic": True,
}

print("downloading features for", bbox, flush=True)
gdf = ox.features.features_from_bbox(bbox=bbox, tags=TAGS)
print(f"  {len(gdf)} features", flush=True)

# Project once for areas in metres.
proj = ox.projection.project_gdf(gdf)
out = []
for (idx, row), (_, prow) in zip(gdf.iterrows(), proj.iterrows()):
    name = row.get("name")
    if not isinstance(name, str) or not name.strip():
        continue
    geom = row.geometry
    tag = kind = None
    for k in ["amenity", "shop", "leisure", "tourism", "aeroway", "landuse", "building", "historic"]:
        v = row.get(k)
        if isinstance(v, str) and (TAGS[k] is True or v in TAGS[k]):
            tag, kind = k, v
            break
    if not kind:
        continue
    c = geom.centroid
    area = float(prow.geometry.area) if geom.geom_type in ("Polygon", "MultiPolygon") else 0.0
    rec = {"name": name.strip(), "kind": kind, "tag": tag, "lonlat": [round(c.x, 6), round(c.y, 6)], "area_m2": round(area)}
    if geom.geom_type == "Polygon":
        ring = [[round(x, 6), round(y, 6)] for x, y in geom.exterior.coords]
        if len(ring) <= 120:
            rec["footprint"] = ring
    elif geom.geom_type == "MultiPolygon":
        big = max(geom.geoms, key=lambda g: g.area)
        ring = [[round(x, 6), round(y, 6)] for x, y in big.exterior.coords]
        if len(ring) <= 120:
            rec["footprint"] = ring
    hn, st = row.get("addr:housenumber"), row.get("addr:street")
    if isinstance(hn, str) and isinstance(st, str):
        rec["addr"] = f"{hn} {st}"
    out.append(rec)

# Dedupe by (name, kind): keep the largest footprint.
best = {}
for r in out:
    k = (r["name"].lower(), r["kind"])
    if k not in best or r["area_m2"] > best[k]["area_m2"]:
        best[k] = r
out = sorted(best.values(), key=lambda r: (r["tag"], r["kind"], -r["area_m2"], r["name"]))
path = os.path.join(ROOT, "public", "data", "landmarks.json")
json.dump(out, open(path, "w"), separators=(",", ":"))
print(f"wrote {path}  ({len(out)} named landmarks, {os.path.getsize(path)/1e6:.1f} MB)", flush=True)
from collections import Counter
print(Counter((r["tag"], r["kind"]) for r in out).most_common(40))
