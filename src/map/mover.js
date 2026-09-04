// Unit motion along baked routes. Ported from the spike (map-integration.md §2).
//
// The sim owns *state*: `unit.districtId`, `unit.place`, `unit.activity`, and when a transit
// arrives (tick-driven, deterministic). This module owns *place*: `unit.pos`, `unit.node`,
// `unit.bearing`, `unit.route`, `unit.progress`, `unit.status` ('moving' | 'patrol' | 'parked' |
// 'inside'). Nothing in the tick loop reads any of those. A transit is paced so the car reaches the
// end of its route exactly when the sim's tick count runs out (never visually early); patrol legs
// are pure renderer motion that never leaves the district polygon.
import { graph, route, dist, bearingDeg } from './graph.js'
import { entryNode, patrolRoute, dangerMultiplier } from './districts.js'

export const MOVING_FACTOR = 1.15   // lights and sirens: edge kph × 1.15
export const PATROL_MAX_KPH = 30    // residential cruise while patrolling

// A route the mover can walk: coords, cumulative metres, per-segment kph and danger multiplier,
// and which edge each segment belongs to (so a re-dispatch mid-edge continues from the edge's far
// end instead of teleporting back to its near end).
function buildRoute(coords, kph, mult, edges, segEdge) {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]))
  return { coords, cum, kph, mult, edges, segEdge, length: cum[cum.length - 1], seg: 0, pace: 1 }
}
function routeToParts(r) {
  const kph = [], mult = [], segEdge = []
  r.edges.forEach((e, ei) => {
    const m = dangerMultiplier(e)
    for (let i = 1; i < e.geom.length; i++) { kph.push(e.kph); mult.push(m); segEdge.push(ei) }
  })
  return { coords: r.coords, kph, mult, segEdge }
}

// Where a moving unit can next change plans: the far node of the edge it is on, plus the
// coordinates it still has to cover to get there.
export function nextNodeAndRemainder(u) {
  const r = u.route
  if (!r || !r.edges.length) return { node: u.node, prefix: null }
  const ei = r.segEdge[Math.min(r.seg, r.segEdge.length - 1)]
  const e = r.edges[ei]
  let end = r.seg + 1
  while (end < r.coords.length - 1 && r.segEdge[end] === ei) end++
  return { node: e.v, prefix: { coords: [u.pos, ...r.coords.slice(r.seg + 1, end + 1)], kph: e.kph, mult: r.mult[r.seg] ?? 1, edge: e } }
}

// Metres per second on a segment, for the unit's current status.
const segSpeed = (u, kph, mult) => (u.status === 'patrol' ? Math.min(kph, PATROL_MAX_KPH) : kph * MOVING_FACTOR) / 3.6 / (mult || 1)

function setRoute(u, r, prefix) {
  const parts = routeToParts(r)
  let coords = parts.coords, kph = parts.kph, mult = parts.mult, segEdge = parts.segEdge, edges = r.edges
  if (prefix) {
    const n = prefix.coords.length - 1
    coords = [...prefix.coords, ...coords.slice(1)]
    kph = [...Array(n).fill(prefix.kph), ...kph]
    mult = [...Array(n).fill(prefix.mult), ...mult]
    edges = [prefix.edge, ...edges]
    segEdge = [...Array(n).fill(0), ...segEdge.map(i => i + 1)]
  }
  u.route = buildRoute(coords, kph, mult, edges, segEdge)
  u.progress = 0
}

// Seconds the mover will take to drive a built route at `status` speeds — the ETA the sim
// derives its tick count from (map-integration.md §1 #10). Danger slows the segments it touches.
export function driveSeconds(u, r = u.route) {
  if (!r) return 0
  let s = 0
  for (let i = 0; i < r.coords.length - 1; i++) s += (r.cum[i + 1] - r.cum[i]) / segSpeed(u, r.kph[i] || 40, r.mult[i])
  return s
}

// Plan a transit to a district (near-edge entry node) or a place (its road node). Sets the route on
// the unit and flips it to 'moving'; returns { seconds, metres, toNode } or null when unroutable.
// The sim decides the tick count from `seconds` and calls `pace()` so the car lands on the tick.
export function planTransit(u, target) {
  const { node: from, prefix } = nextNodeAndRemainder(u)
  const fromPos = prefix ? graph.nodes[from] : u.pos
  let toNode = null
  if (target.place) toNode = target.place.node
  else if (target.district) toNode = entryNode(target.district, fromPos)
  if (!toNode) return null
  const r = route(from, toNode, { emergency: true, multiplier: dangerMultiplier })
  if (!r) return null
  u.status = 'moving'
  setRoute(u, r, prefix)
  u.node = from
  u.targetNode = toNode
  return { seconds: driveSeconds(u), metres: u.route.length, toNode }
}

// Stretch the motion so the route takes exactly `seconds` of sim time (≥ the natural drive time).
export function pace(u, seconds) {
  if (!u.route) return
  const natural = driveSeconds(u)
  u.route.pace = seconds > 0 && natural > 0 ? Math.min(1, natural / seconds) : 1
}

// Advance a unit along its route by `simDt` sim-seconds. Transits stop at the end and wait for the
// sim to arrive them; patrol legs chain into the next leg (or park when the activity changed).
export function advance(u, simDt) {
  const r = u.route; if (!r) return false
  const i = Math.min(r.seg, r.kph.length - 1)
  const v = segSpeed(u, r.kph[i] || 40, r.mult[i]) * (r.pace ?? 1)
  u.progress = Math.min(u.progress + v * simDt, r.length)
  while (r.seg < r.cum.length - 2 && r.cum[r.seg + 1] < u.progress) r.seg++
  const a = r.coords[r.seg], b = r.coords[r.seg + 1] ?? a
  const span = (r.cum[r.seg + 1] ?? r.cum[r.seg]) - r.cum[r.seg]
  const t = span > 0 ? (u.progress - r.cum[r.seg]) / span : 1
  u.pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  if (a !== b) u.bearing = bearingDeg(a, b)
  if (u.progress >= r.length && u.status === 'patrol') {
    u.node = u.targetNode ?? u.node
    u.pos = graph.nodes[u.node]
    u.route = null
    if (u.activity === 'engage' && u.patrolDistrict) startPatrolLeg(u, u.patrolDistrict)
    else park(u)
  }
  return true
}

// Sim-side arrival: snap to the target node and clear the transit route. The caller then sets the
// sim facts (districtId / place) and picks patrol / park / inside.
export function arrive(u) {
  u.node = u.targetNode ?? u.node
  u.pos = graph.nodes[u.node]
  u.route = null
  u.progress = 0
  u.targetNode = null
}

export function park(u) {
  u.status = 'parked'
  u.route = null
  u.patrolDistrict = null
}

export function goInside(u) {
  u.status = 'inside'
  u.route = null
  u.patrolDistrict = null
}

// ENGAGE at a district: routed laps to random interior nodes, never leaving the polygon.
export function startPatrolLeg(u, district) {
  const r = patrolRoute(u.node, district)
  if (!r || !r.edges.length) { park(u); u.patrolDistrict = district; return }
  u.status = 'patrol'
  u.patrolDistrict = district
  setRoute(u, r, null)
  u.targetNode = r.edges[r.edges.length - 1].v
}

// Remaining sim-seconds on the current route (for hover ETAs).
export function remainingSeconds(u) {
  const r = u.route; if (!r) return 0
  let s = 0
  for (let i = r.seg; i < r.coords.length - 1; i++) {
    const segLen = r.cum[i + 1] - r.cum[i]
    const covered = i === r.seg ? u.progress - r.cum[i] : 0
    s += (segLen - covered) / (segSpeed(u, r.kph[i] || 40, r.mult[i]) * (r.pace ?? 1))
  }
  return s
}

// ETA preview without touching the unit: what a transit from here to `target` would take.
export function previewSeconds(u, target) {
  const { node: from, prefix } = nextNodeAndRemainder(u)
  const fromPos = prefix ? graph.nodes[from] : u.pos
  const toNode = target.place ? target.place.node : target.district ? entryNode(target.district, fromPos) : null
  if (!toNode) return null
  const r = route(from, toNode, { emergency: true, multiplier: dangerMultiplier })
  if (!r) return null
  const parts = routeToParts(r)
  const tmp = { status: 'moving' }
  const built = buildRoute(parts.coords, parts.kph, parts.mult, r.edges, parts.segEdge)
  let s = driveSeconds(tmp, built)
  if (prefix) s += (dist(prefix.coords[0], prefix.coords[prefix.coords.length - 1]) || 0) / segSpeed(tmp, prefix.kph, prefix.mult)
  return { seconds: s, metres: built.length + (prefix ? 0 : 0) }
}
