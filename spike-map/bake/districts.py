"""Build district polygons that follow real roads, from a spec of named corridors.

Each district is a clockwise loop of LEGS; a leg is a set of street names (the same road
changes name along its length). The tool finds where consecutive legs meet, routes along
each leg between those junctions (off-name detours allowed at a penalty, so a gap between
two names doesn't break the loop), and emits the ring. It also assigns the authored places.

Writes public/data/districts.geojson and public/data/places.json.
Run from spike-map/:  python bake/districts.py
"""
import json, os, heapq, math, itertools
from collections import defaultdict
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "public", "data")

NC = ["New Circle Road", "East New Circle Road", "West New Circle Road"]
MOW = ["Man O War Boulevard"]

DISTRICTS = [
    {"id": "downtown", "label": "Downtown", "category": "government",
     "legs": [["Newtown Pike", "Oliver Lewis Way"], ["West Loudon Avenue", "East Loudon Avenue"], ["North Limestone"],
              ["East Third Street"], ["Midland Avenue"], ["East High Street", "West High Street"]],
     "places": ["Rupp Arena", "Lexington-Fayette Urban County Government Center", "Lexington Public Library - Central Branch",
                "Lexington Police Department", "Fire Station #1", "Transylvania University", "Kentucky Theatre", "Thoroughbred Park",
                "Lexington Opera House"]},
    {"id": "northside", "label": "Northside", "category": "residential",
     "legs": [["Newtown Pike"], NC, ["Winchester Road"], ["East Third Street"], ["North Limestone"], ["East Loudon Avenue", "West Loudon Avenue"]],
     "places": ["Castlewood Park", "Legends Field", "Lexmark International", "Bluegrass Community Technical College", "Kroger",
                "Lexington Fire Department Station 2", "FedEx"]},
    {"id": "eastend", "label": "East End", "category": "residential",
     "legs": [["Winchester Road"], NC, ["Richmond Road", "East Main Street"], ["Midland Avenue"]],
     "places": ["Idle Hour Country Club", "Idle Hour Park", "Breckinridge Elementary School", "Johnson Heights Park", "Kentucky Ballet Theatre"]},
    {"id": "chevychase", "label": "Chevy Chase", "category": "residential",
     "legs": [["Richmond Road", "East Main Street"], NC, ["Tates Creek Road"], ["East High Street"]],
     "places": ["Ashland - The Henry Clay Estate", "Woodland Park", "Henry Clay High School", "Kentucky Children's Richmond Road",
                "Ecton Park", "Fire Station #9", "Lexington Ice Center"]},
    {"id": "university", "label": "University", "category": "government",
     "legs": [["East High Street", "West High Street"], ["Tates Creek Road"], ["Alumni Drive"], ["Nicholasville Road"],
              ["Lane Allen Road", "Rosemont Garden"], ["Harrodsburg Road", "South Broadway"]],
     "places": ["Kroger Field", "Albert B. Chandler Hospital", "Good Samaritan Hospital", "Memorial Coliseum",
                "VA Troy Bowling Campus", "University of Kentucky Arboretum", "Baptist Health", "Fire Station #5", "William T. Young Library"]},
    {"id": "southside", "label": "Southside", "category": "retail",
     "legs": [["Alumni Drive"], ["Tates Creek Road"], MOW, ["Clays Mill Road"], ["Lane Allen Road", "Rosemont Garden"], ["Nicholasville Road"]],
     "places": ["Fayette Mall", "Shillito Park", "Lexington Christian Academy", "Zandale Park", "Lexington Public Library-Tates Creek Branch",
                "Fire Station #15", "The Summit at Fritz Farm", "Kirklevington Park"]},
    {"id": "redmile", "label": "Red Mile", "category": "retail",
     "legs": [["South Broadway", "Harrodsburg Road"], NC, ["Versailles Road"], ["West Main Street", "Oliver Lewis Way"]],
     "places": ["Red Mile", "Saint Joseph Hospital", "Turfland Mall", "Cardinal Hill Rehabilitation Hospital",
                "Picadome Elementary School", "Lafayette High School", "Fire Station #6", "Gay Brewer Jr Golf Course"]},
    {"id": "westend", "label": "West End", "category": "industrial",
     "legs": [["Versailles Road"], NC, ["Newtown Pike"], ["West Main Street"]],
     "places": ["Calvary Cemetery", "Cove Haven Cemetery", "McConnell Springs", "Douglass Park", "Marathon Terminal",
                "Kentucky Utilities", "Cardinal Valley Elementary School", "Marksbury Family Branch Public Library", "Fire Station #3"]},
    {"id": "hamburg", "label": "Hamburg", "category": "retail",
     "legs": [["Winchester Road"], MOW, ["Richmond Road"], NC],
     "places": ["Hamburg Pavilion", "Costco", "Meijer", "Walmart Supercenter", "Target", "Baptist Health Hamburg", "Sam's Club",
                "Frederick Douglass High School", "Regal Cinemas"]},
]

OFF_NAME_PENALTY = 8.0

# ---------- graph ----------
roads = json.load(open(os.path.join(DATA, "roads.json")))
nodes = roads["nodes"]
KLAT = 111_320
KLON = KLAT * math.cos(38.03 * math.pi / 180)
def dist(a, b): return math.hypot((a[0] - b[0]) * KLON, (a[1] - b[1]) * KLAT)

adj = defaultdict(list)          # undirected: node -> [(nbr, len, name, geom(from node))]
nodes_by_name = defaultdict(set)
all_names = set()
for e in roads["edges"]:
    n = e.get("name")
    if n: all_names.add(n); nodes_by_name[n].add(e["u"]); nodes_by_name[n].add(e["v"])
    adj[e["u"]].append((e["v"], e["len"], n, e["geom"]))
    adj[e["v"]].append((e["u"], e["len"], n, list(reversed(e["geom"]))))

unknown = sorted({n for d in DISTRICTS for leg in d["legs"] for n in leg if n not in all_names})
if unknown: print("UNKNOWN NAMES:", unknown)

def leg_nodes(leg): return set().union(*(nodes_by_name[n] for n in leg))

def dijkstra(src, dst, names):
    best = {src: 0.0}; prev = {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst: break
        if d > best.get(u, 1e18): continue
        for v, ln, nm, geom in adj[u]:
            c = d + ln * (1.0 if nm in names else OFF_NAME_PENALTY)
            if c < best.get(v, 1e18):
                best[v] = c; prev[v] = (u, geom); heapq.heappush(pq, (c, v))
    if dst not in best: return None, None
    path = []
    n = dst
    while n != src:
        u, geom = prev[n]; path.append(geom); n = u
    path.reverse()
    coords = [path[0][0]] if path else [nodes[src]]
    for g in path: coords.extend(g[1:])
    return best[dst], coords

def cluster(cands, r=250):
    """Thin a set of junction nodes to one representative per ~r metres."""
    reps = []
    for n in sorted(cands):
        p = nodes[n]
        if all(dist(p, nodes[m]) > r for m in reps): reps.append(n)
    return reps[:8]

def junctions(legA, legB):
    a, b = leg_nodes(legA), leg_nodes(legB)
    both = a & b
    if both: return cluster(both)
    # No shared node: closest pair, use the node on leg A (the path will detour onto B).
    best = None
    for x in a:
        px = nodes[x]
        for y in b:
            d = dist(px, nodes[y])
            if best is None or d < best[0]: best = (d, x)
    print(f"    no shared node between {legA[0]} and {legB[0]}; closest pair {best[0]:.0f} m")
    return [best[1]]

def build(d):
    legs = d["legs"]; n = len(legs)
    J = [junctions(legs[k], legs[(k + 1) % n]) for k in range(n)]   # J[k]: where leg k meets leg k+1
    # leg k runs from J[k-1] to J[k]. DP over choices, fixing J[n-1] choice.
    best_total = None
    for start in J[n - 1]:
        # state: chosen node for J[k-1]; cost so far
        states = {start: (0.0, [])}
        for k in range(n):
            nxt = {}
            for prev_node, (cost, chain) in states.items():
                for cand in J[k] if k < n - 1 else [start]:
                    c, coords = dijkstra(prev_node, cand, set(legs[k]))
                    if c is None: continue
                    tot = cost + c
                    if cand not in nxt or tot < nxt[cand][0]:
                        nxt[cand] = (tot, chain + [(k, prev_node, cand, coords)])
            states = nxt
            if not states: break
        if start in states and (best_total is None or states[start][0] < best_total[0]):
            best_total = states[start]
    if not best_total: raise SystemExit(f"district {d['id']}: could not close the loop")
    ring = []
    for k, a, b, coords in best_total[1]:
        for p in coords:
            if not ring or ring[-1] != p: ring.append(p)
    if ring[0] != ring[-1]: ring.append(ring[0])
    poly = Polygon(ring)
    if not poly.is_valid: poly = poly.buffer(0)
    if poly.geom_type == "MultiPolygon": poly = max(poly.geoms, key=lambda g: g.area)
    ring = [[round(x, 6), round(y, 6)] for x, y in poly.exterior.coords]
    area_km2 = Polygon([(x * KLON, y * KLAT) for x, y in ring]).area / 1e6
    print(f"  {d['id']:11} {len(ring):4} pts  {area_km2:5.1f} km2   legs: " + ", ".join(f"{legs[k][0]}>{legs[(k+1)%n][0]}" for k, *_ in best_total[1]))
    return ring, poly

features = []; polys = {}
print("building districts")
for d in DISTRICTS:
    ring, poly = build(d)
    polys[d["id"]] = poly

# Holes: two neighbouring loops can pick different roads for what should be one shared edge,
# leaving a block group that belongs to nobody. Fold each fully-enclosed hole into the
# district it shares the most boundary with.
merged = unary_union(list(polys.values()))
for g in (merged.geoms if merged.geom_type == "MultiPolygon" else [merged]):
    for interior in g.interiors:
        hole = Polygon(interior)
        best = max(polys, key=lambda k: polys[k].exterior.intersection(hole.exterior.buffer(3e-5)).length)
        polys[best] = polys[best].union(hole).buffer(0)
        if polys[best].geom_type == "MultiPolygon": polys[best] = max(polys[best].geoms, key=lambda p: p.area)
        km2 = Polygon([(x * KLON, y * KLAT) for x, y in hole.exterior.coords]).area / 1e6
        print(f"  hole of {km2:.2f} km2 folded into {best}")

for d in DISTRICTS:
    ring = [[round(x, 6), round(y, 6)] for x, y in polys[d["id"]].exterior.coords]
    features.append({"type": "Feature", "id": d["id"],
                     "properties": {"id": d["id"], "label": d["label"], "category": d["category"]},
                     "geometry": {"type": "Polygon", "coordinates": [ring]}})

# Overlap report: adjacent districts share roads, so tiny slivers are expected; big ones are a spec bug.
for a, b in itertools.combinations(polys, 2):
    ov = polys[a].intersection(polys[b])
    if not ov.is_empty:
        ov_km2 = Polygon([(x * KLON, y * KLAT) for x, y in ov.exterior.coords]).area / 1e6 if ov.geom_type == "Polygon" else sum(
            Polygon([(x * KLON, y * KLAT) for x, y in g.exterior.coords]).area / 1e6 for g in getattr(ov, "geoms", []) if g.geom_type == "Polygon")
        if ov_km2 > 0.05: print(f"  OVERLAP {a} / {b}: {ov_km2:.2f} km2")

json.dump({"type": "FeatureCollection", "features": features}, open(os.path.join(DATA, "districts.geojson"), "w"), separators=(",", ":"))

# ---------- authored places ----------
landmarks = json.load(open(os.path.join(DATA, "landmarks.json")))
by_name = defaultdict(list)
for l in landmarks: by_name[l["name"]].append(l)
KIND_MAP = {"hospital": "hospital", "police": "police", "fire_station": "fire", "stadium": "venue", "mall": "retail",
            "supermarket": "retail", "wholesale": "retail", "department_store": "retail", "park": "park", "school": "school",
            "university": "campus", "college": "campus", "library": "civic", "townhall": "civic", "cinema": "venue",
            "theatre": "venue", "sports_centre": "venue", "golf_course": "park", "ice_rink": "venue", "cemetery": "park",
            "industrial": "industrial", "retail": "retail", "manor": "landmark", "community_centre": "civic"}
places = []; missing = []
for d in DISTRICTS:
    for name in d["places"]:
        cands = by_name.get(name)
        if not cands: missing.append(name); continue
        # Same name, several buildings (every Kroger): prefer the one inside this district.
        inside_c = [c for c in cands if polys[d["id"]].contains(Point(c["lonlat"]))]
        l = max(inside_c or cands, key=lambda x: x["area_m2"])
        inside = polys[d["id"]].contains(Point(l["lonlat"]))
        home = next((dd["id"] for dd in DISTRICTS if polys[dd["id"]].contains(Point(l["lonlat"]))), None)
        if not inside: print(f"  NOTE {name!r} is not inside {d['id']} (it is in {home})")
        if home is None: continue
        places.append({"id": name.lower().replace(" ", "-").replace("'", "")[:40], "name": name, "kind": KIND_MAP.get(l["kind"], "landmark"),
                       "osm": f"{l['tag']}={l['kind']}", "lonlat": l["lonlat"], "district": home or d["id"],
                       "footprint": l.get("footprint"), "addr": l.get("addr")})
if missing: print("MISSING PLACES:", missing)
json.dump(places, open(os.path.join(DATA, "places.json"), "w"), separators=(",", ":"))
print(f"wrote districts.geojson ({len(features)}) and places.json ({len(places)})")

# What else is in each district, for picking: big or important named things.
IMPORTANT = {"hospital", "police", "fire_station", "stadium", "mall", "university", "college", "library", "townhall", "cinema", "theatre", "ice_rink", "supermarket", "department_store", "wholesale"}
for d in DISTRICTS:
    chosen = set(d["places"])
    inside = [l for l in landmarks if polys[d["id"]].contains(Point(l["lonlat"])) and l["name"] not in chosen
              and (l["kind"] in IMPORTANT or l["area_m2"] > 30000)]
    inside.sort(key=lambda l: -l["area_m2"])
    print(f"\n{d['label']}: other candidates: " + "; ".join(f"{l['name']} [{l['kind']}]" for l in inside[:14]))
