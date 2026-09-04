// Road graph: load roads.json, build adjacency, nearest-node snap, A*.
// Works in [lon, lat] and metres. Never touches the map.
import KDBush from 'kdbush'

const KLAT = 111_320
let KLON = KLAT * Math.cos(38.03 * Math.PI / 180)

export const dist = (a, b) => Math.hypot((a[0] - b[0]) * KLON, (a[1] - b[1]) * KLAT)
export const bearingDeg = (a, b) => {
  const dx = (b[0] - a[0]) * KLON, dy = (b[1] - a[1]) * KLAT
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
}

export const graph = {
  nodes: {},        // id -> [lon, lat]
  ids: [],          // index -> id (for kdbush)
  out: {},          // id -> [edge, ...]
  edges: [],        // {u, v, len, kph, hw, geom, id}
  maxKph: 1,
  index: null,
  edgeDistrict: [], // edge id -> district id | null (filled by districts.js)
  ready: false,
}

export async function loadGraph(url = '/data/roads.json') {
  const data = await (await fetch(url)).json()
  const lat0 = (data.bbox[1] + data.bbox[3]) / 2
  KLON = KLAT * Math.cos(lat0 * Math.PI / 180)
  graph.nodes = data.nodes
  graph.ids = Object.keys(data.nodes)
  graph.out = {}
  graph.edges = data.edges.map((e, i) => ({ ...e, id: i }))
  for (const e of graph.edges) {
    ;(graph.out[e.u] ??= []).push(e)
    if (e.kph > graph.maxKph) graph.maxKph = e.kph
  }
  const idx = new KDBush(graph.ids.length)
  for (const id of graph.ids) { const p = data.nodes[id]; idx.add(p[0] * KLON, p[1] * KLAT) }
  idx.finish()
  graph.index = idx
  graph.ready = true
  return graph
}

// Nearest graph node to a [lon, lat]. Optional predicate filters candidates (e.g. inside polygon).
export function nearestNode(lonlat, pred = null, radiusM = 400) {
  const x = lonlat[0] * KLON, y = lonlat[1] * KLAT
  let r = radiusM
  for (let tries = 0; tries < 5; tries++) {
    const hits = graph.index.within(x, y, r)
    let best = null, bd = Infinity
    for (const i of hits) {
      const id = graph.ids[i]
      if (pred && !pred(graph.nodes[id])) continue
      const d = dist(lonlat, graph.nodes[id])
      if (d < bd) { bd = d; best = id }
    }
    if (best) return best
    r *= 3
  }
  return null
}

// Edge cost in seconds. `world.multiplier(edge)` lets danger bend routes.
function edgeCost(e, opts) {
  let t = e.len / (e.kph / 3.6)
  if (opts.emergency) t *= 0.7
  if (opts.multiplier) t *= opts.multiplier(e)
  return t
}

class Heap {
  constructor() { this.a = [] }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop()
    if (a.length) { a[0] = last; let i = 0
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m } }
    return top }
  get size() { return this.a.length }
}

// A* from node id to node id. Returns {coords, edges, seconds, metres} or null.
export function route(fromId, toId, opts = {}) {
  if (fromId === toId) return { coords: [graph.nodes[fromId]], edges: [], seconds: 0, metres: 0 }
  const goal = graph.nodes[toId]
  const h = id => dist(graph.nodes[id], goal) / (graph.maxKph / 3.6)
  const g = new Map([[fromId, 0]])
  const came = new Map()
  const open = new Heap(); open.push(h(fromId), fromId)
  const closed = new Set()
  while (open.size) {
    const [, cur] = open.pop()
    if (cur === toId) break
    if (closed.has(cur)) continue
    closed.add(cur)
    const gc = g.get(cur)
    for (const e of graph.out[cur] ?? []) {
      const c = edgeCost(e, opts)
      if (!isFinite(c)) continue
      // U-turn penalty: bouncing straight back along a dual carriageway.
      const prev = came.get(cur)
      const uturn = prev && prev.u === e.v ? 45 : 0
      const ng = gc + c + uturn
      if (ng < (g.get(e.v) ?? Infinity)) { g.set(e.v, ng); came.set(e.v, e); open.push(ng + h(e.v), e.v) }
    }
  }
  if (!came.has(toId)) return null
  const edges = []
  for (let id = toId; id !== fromId;) { const e = came.get(id); edges.push(e); id = e.u }
  edges.reverse()
  const coords = [graph.nodes[fromId]]
  let metres = 0
  for (const e of edges) { coords.push(...e.geom.slice(1)); metres += e.len }
  return { coords, edges, seconds: g.get(toId), metres }
}

// Ray-cast point in polygon (single ring, [lon,lat]).
export function pointInRing(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
