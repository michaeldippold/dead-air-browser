// Districts: the sim's unit of state. Geometry comes from the bake; everything here is
// derived (which district a point is in, which roads and nodes are inside, patrol legs).
import { graph, pointInRing, nearestNode, dist, route } from './graph.js'
export const cold = {}   // district id -> true once no humans are left

// Baked by bake/districts.py: polygons that follow real roads, from named corridors.
export const DISTRICTS = []
export async function loadDistricts(url = '/data/districts.geojson') {
  const fc = await (await fetch(url)).json()
  DISTRICTS.length = 0
  for (const f of fc.features) {
    const ring = f.geometry.coordinates[0].slice(0, -1)
    DISTRICTS.push({ id: f.properties.id, label: f.properties.label, category: f.properties.category, ring })
    danger[f.properties.id] = 0
  }
  return DISTRICTS
}

export const CATEGORY_COLOR = {
  residential: '#7fd6ff', government: '#b9a3ff', medical: '#ff8fb0', retail: '#ffcf5a', industrial: '#c9d2dc',
}

// Live per-district danger 0..1 (dev slider in the spike; district ratio in the game).
export const danger = {}

export function districtAt(lonlat) {
  for (const d of DISTRICTS) if (pointInRing(lonlat, d.ring)) return d
  return null
}

// Tag every road edge with the district containing its midpoint, and collect each
// district's interior nodes, once the graph is loaded.
const interior = {}
export function tagEdges() {
  graph.edgeDistrict = graph.edges.map(e => {
    const m = e.geom[Math.floor(e.geom.length / 2)]
    return districtAt(m)?.id ?? null
  })
  for (const d of DISTRICTS) interior[d.id] = []
  for (const id of graph.ids) { const d = districtAt(graph.nodes[id]); if (d) interior[d.id].push(id) }
}

// Routing multiplier: 1 clean, up to 3.5 deep in a bad district.
export const dangerMultiplier = e => {
  const id = graph.edgeDistrict[e.id]
  return id ? 1 + 2.5 * danger[id] : 1
}

// Nearest routable node inside the district to a given position — the "near edge" rule.
export function entryNode(district, fromLonlat) {
  let best = null, bd = Infinity
  for (const id of interior[district.id] ?? []) {
    const d = dist(fromLonlat, graph.nodes[id])
    if (d < bd) { bd = d; best = id }
  }
  return best
}

// A patrol leg: a routed lap to a random interior node at least 150 m away, never leaving
// the district. A one-edge random walk ping-pongs at dead ends and stalls at the boundary;
// a routed leg reads as a car cruising the neighborhood.
export function patrolRoute(fromId, district) {
  const pool = interior[district.id] ?? []
  if (!pool.length) return null
  const from = graph.nodes[fromId]
  const inside = e => graph.edgeDistrict[e.id] === district.id ? 1 : Infinity
  for (let tries = 0; tries < 10; tries++) {
    const to = pool[Math.floor(Math.random() * pool.length)]
    if (to === fromId || dist(from, graph.nodes[to]) < 150) continue
    const r = route(fromId, to, { multiplier: inside })
    if (r && r.edges.length) return r
  }
  // Boxed in (a node whose in-district roads are all one-way out): take any road out.
  const any = (graph.out[fromId] ?? [])[0]
  return any ? { coords: any.geom, edges: [any], seconds: any.len / (any.kph / 3.6), metres: any.len } : null
}

// Adjacency derived from the geometry (map-integration.md §4: never hand-maintain it). The rings
// come from the same road graph, so two districts that share a boundary share its exact vertices;
// a corner touch is one or two vertices, a real shared boundary is dozens.
export function adjacencyFromPolygons(minShared = 3) {
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6)
  const sets = DISTRICTS.map(d => new Set(d.ring.map(key)))
  const adj = {}
  DISTRICTS.forEach((a, i) => {
    adj[a.id] = []
    DISTRICTS.forEach((b, j) => {
      if (i === j) return
      let n = 0
      for (const k of sets[i]) if (sets[j].has(k)) n++
      if (n >= minShared) adj[a.id].push(b.id)
    })
  })
  return adj
}

// Area centroid of a ring (shoelace). Labels anchor here, once per district.
export function centroid(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f
  }
  a *= 0.5
  return a === 0 ? ring[0] : [cx / (6 * a), cy / (6 * a)]
}
export function districtLabelsGeoJSON() {
  return { type: 'FeatureCollection', features: DISTRICTS.map(d => ({
    type: 'Feature', id: d.id,
    properties: { id: d.id, label: d.label, color: CATEGORY_COLOR[d.category], cold: !!cold[d.id] },
    geometry: { type: 'Point', coordinates: centroid(d.ring) } })) }
}

export function districtsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: DISTRICTS.map(d => ({
      type: 'Feature', id: d.id,
      properties: { id: d.id, label: d.label, category: d.category, color: CATEGORY_COLOR[d.category], danger: danger[d.id], cold: !!cold[d.id] },
      geometry: { type: 'Polygon', coordinates: [[...d.ring, d.ring[0]]] },
    })),
  }
}

export { nearestNode }
