"""Bake the drivable road graph.

One-off asset step. Reads bake/config.json for the bbox, writes (repo root):
  public/data/roads.json   {nodes: {id: [lon, lat]}, edges: [{u, v, len, kph, hw, oneway, geom}]}

(The old pois.json output was superseded by places.json from districts.py and is gone.)

Run from spike-map/:  python bake/roads.py
"""
import json, os, sys, time
import osmnx as ox

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # repo root; data lives in public/data
cfg = json.load(open(os.path.join(HERE, "config.json")))
b = cfg["bbox"]
bbox = (b["west"], b["south"], b["east"], b["north"])   # osmnx 2.x: (left, bottom, right, top)
out = os.path.join(ROOT, "public", "data")
os.makedirs(out, exist_ok=True)

ox.settings.log_console = False
t0 = time.time()
print("downloading drive network for", bbox, flush=True)
G = ox.graph_from_bbox(bbox=bbox, network_type="drive", simplify=True)
print(f"  raw: {len(G.nodes)} nodes, {len(G.edges)} edges  ({time.time()-t0:.0f}s)", flush=True)

G = ox.routing.add_edge_speeds(G)
G = ox.routing.add_edge_travel_times(G)
G = ox.truncate.largest_component(G, strongly=True)
print(f"  strongly connected: {len(G.nodes)} nodes, {len(G.edges)} edges", flush=True)

nodes = {str(n): [round(d["x"], 6), round(d["y"], 6)] for n, d in G.nodes(data=True)}
edges = []
for u, v, d in G.edges(data=True):
    if "geometry" in d:
        geom = [[round(x, 6), round(y, 6)] for x, y in d["geometry"].coords]
    else:
        geom = [nodes[str(u)], nodes[str(v)]]
    hw = d.get("highway", "unclassified")
    if isinstance(hw, list):
        hw = hw[0]
    ow = d.get("oneway", False)
    if isinstance(ow, list):
        ow = any(ow)
    name = d.get("name")
    if isinstance(name, list):
        name = name[0]
    ref = d.get("ref")
    if isinstance(ref, list):
        ref = ref[0]
    edges.append({
        "u": str(u), "v": str(v),
        "name": name if isinstance(name, str) else None,
        "ref": ref if isinstance(ref, str) else None,
        "len": round(float(d["length"]), 1),
        "kph": round(float(d["speed_kph"]), 1),
        "hw": hw,
        "oneway": bool(ow),
        "geom": geom,
    })

roads_path = os.path.join(out, "roads.json")
with open(roads_path, "w") as f:
    json.dump({"bbox": bbox, "nodes": nodes, "edges": edges}, f, separators=(",", ":"))
print(f"wrote {roads_path}  ({os.path.getsize(roads_path)/1e6:.1f} MB)", flush=True)
