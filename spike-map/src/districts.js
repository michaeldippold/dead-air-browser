// Hand-traced spike districts over real Lexington neighborhoods. Rough on purpose:
// the spike is judging the look and the position/state split, not the boundaries.
// Real districts get traced properly once the landmarks are pinned.
import { graph, pointInRing, nearestNode, dist, route } from './graph.js'

export const DISTRICTS = [
  { id: 'downtown', label: 'Downtown', category: 'government',
    ring: [[-84.5105, 38.0395], [-84.5105, 38.0555], [-84.4835, 38.0555], [-84.4835, 38.0395]] },
  { id: 'uk', label: 'University of Kentucky', category: 'government',
    ring: [[-84.5160, 38.0185], [-84.5160, 38.0395], [-84.4955, 38.0395], [-84.4955, 38.0185]] },
  { id: 'chevychase', label: 'Chevy Chase', category: 'residential',
    ring: [[-84.4955, 38.0185], [-84.4955, 38.0395], [-84.4700, 38.0395], [-84.4700, 38.0185]] },
  { id: 'joyland', label: 'Joyland', category: 'residential',
    ring: [[-84.5060, 38.0740], [-84.5060, 38.1010], [-84.4700, 38.1010], [-84.4700, 38.0740]] },
  { id: 'redmile', label: 'The Red Mile', category: 'retail',
    ring: [[-84.5300, 38.0250], [-84.5300, 38.0480], [-84.5105, 38.0480], [-84.5105, 38.0250]] },
  { id: 'fayettemall', label: 'Fayette Mall', category: 'retail',
    ring: [[-84.5190, 37.9740], [-84.5190, 37.9960], [-84.4930, 37.9960], [-84.4930, 37.9740]] },
]

export const CATEGORY_COLOR = {
  residential: '#4f7ac9', government: '#6f63c7', medical: '#c95c7d', retail: '#c9a04f', industrial: '#8a8f9a',
}

// Live per-district danger 0..1 (dev slider in the spike; district ratio in the game).
export const danger = Object.fromEntries(DISTRICTS.map(d => [d.id, 0]))

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

export function districtsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: DISTRICTS.map(d => ({
      type: 'Feature', id: d.id,
      properties: { id: d.id, label: d.label, category: d.category, color: CATEGORY_COLOR[d.category], danger: danger[d.id] },
      geometry: { type: 'Polygon', coordinates: [[...d.ring, d.ring[0]]] },
    })),
  }
}

export { nearestNode }
