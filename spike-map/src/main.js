// Dead Air map spike. Judging: the dark real-city look, units on real roads,
// district = state / position = geography, hover/click, danger paint.
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'
import { graph, loadGraph, nearestNode, route, dist, bearingDeg } from './graph.js'
import { DISTRICTS, CATEGORY_COLOR, danger, districtAt, tagEdges, dangerMultiplier, entryNode, patrolRoute, districtsGeoJSON } from './districts.js'

const cfg = await (await fetch('/data/config.json')).json()
const B = cfg.bbox

// ---------- Style ----------
const flavor = {
  ...namedFlavor('dark'),
  background: '#06101f', earth: '#0b1a30', water: '#04101e',
  park_a: '#0e2238', park_b: '#0e2238', wood_a: '#0d2034', wood_b: '#0d2034', scrub_a: '#0d2034', scrub_b: '#0d2034',
  hospital: '#1a2440', school: '#0f1e36', industrial: '#101d33', pedestrian: '#0f1e36', zoo: '#0e2238', military: '#101d33',
  aerodrome: '#0d1a2e', runway: '#1c2f4d', sand: '#0f1e36', beach: '#0f1e36', glacier: '#0f1e36',
  buildings: '#13284a', pier: '#13284a',
  highway: '#6d94d6', major: '#436aa8', link: '#436aa8', minor_a: '#223a63', minor_b: '#223a63', minor_service: '#172c4d', other: '#172c4d',
  highway_casing_early: '#06101f', highway_casing_late: '#06101f', major_casing_early: '#06101f', major_casing_late: '#06101f',
  link_casing: '#06101f', minor_casing: '#06101f', minor_service_casing: '#06101f',
  tunnel_highway: '#2b4470', tunnel_major: '#243a61', tunnel_minor: '#1a2d4d', tunnel_link: '#243a61', tunnel_other: '#172c4d',
  tunnel_highway_casing: '#06101f', tunnel_major_casing: '#06101f', tunnel_minor_casing: '#06101f', tunnel_link_casing: '#06101f', tunnel_other_casing: '#06101f',
  bridges_highway: '#6d94d6', bridges_major: '#436aa8', bridges_minor: '#223a63', bridges_link: '#436aa8', bridges_other: '#172c4d',
  bridges_highway_casing: '#06101f', bridges_major_casing: '#06101f', bridges_minor_casing: '#06101f', bridges_link_casing: '#06101f', bridges_other_casing: '#06101f',
  railway: '#1e3050', boundaries: '#06101f',
  roads_label_minor: '#7d95bf', roads_label_minor_halo: '#06101f', roads_label_major: '#9fb6e0', roads_label_major_halo: '#06101f',
  city_label: '#cfe0ff', city_label_halo: '#06101f', subplace_label: '#8aa5d6', subplace_label_halo: '#06101f',
  state_label: '#06101f', state_label_halo: '#06101f', country_label: '#06101f', ocean_label: '#4d6a9a',
  address_label: '#06101f', address_label_halo: '#06101f',
}

const DROP = /^(pois|address_label|roads_shields|boundaries|places_country|places_region|earth_label|roads_oneway)/
const base = layers('protomaps', flavor, { lang: 'en' }).filter(l => !DROP.test(l.id))
for (const l of base) {
  if (l.id === 'roads_labels_minor') l.minzoom = 15.5
  if (l.id === 'roads_labels_major') l.minzoom = 14
  if (l.id === 'places_subplace') { l.minzoom = 13; l.paint = { ...(l.paint || {}), 'text-opacity': 0.55 } }
  if (l.id === 'buildings') {
    l.type = 'fill-extrusion'; l.minzoom = 13.5
    l.paint = {
      'fill-extrusion-color': '#152c50',
      'fill-extrusion-height': ['coalesce', ['get', 'height'], 7],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 0.9],
      'fill-extrusion-vertical-gradient': true,
    }
    delete l.layout
  }
}

const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: { protomaps: { type: 'vector', url: 'pmtiles://' + location.origin + '/data/lexington.pmtiles', attribution: '© OpenStreetMap contributors' } },
    layers: base,
  },
  center: cfg.center, zoom: 13.4, pitch: 52, bearing: -12,
  maxBounds: [[B.west - 0.03, B.south - 0.03], [B.east + 0.03, B.north + 0.03]],
  minZoom: 11, maxZoom: 18, antialias: true, attributionControl: false,
})
window.map = map

// Right-click belongs to the game (context menus). Rotate/pitch moves to middle-mouse drag.
map.dragRotate.disable()
map.getCanvas().addEventListener('contextmenu', e => e.preventDefault())
;(() => {
  let drag = null
  const c = map.getCanvas()
  c.addEventListener('mousedown', e => {
    if (e.button !== 1) return
    e.preventDefault()
    drag = { x: e.clientX, y: e.clientY, bearing: map.getBearing(), pitch: map.getPitch() }
  })
  window.addEventListener('mousemove', e => {
    if (!drag) return
    map.jumpTo({ bearing: drag.bearing - (e.clientX - drag.x) * 0.35, pitch: Math.max(0, Math.min(75, drag.pitch - (e.clientY - drag.y) * 0.35)) })
  })
  window.addEventListener('mouseup', () => { drag = null })
  c.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault() })
})()

// ---------- Icons, drawn in code ----------
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }
function carIcon(color) {
  const s = 48, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.shadowColor = color; g.shadowBlur = 8
  g.fillStyle = color; roundRect(g, -9, -16, 18, 32, 5); g.fill()
  g.shadowBlur = 0
  g.fillStyle = 'rgba(6,16,31,0.85)'; roundRect(g, -7, -9, 14, 9, 2); g.fill(); roundRect(g, -7, 3, 14, 7, 2); g.fill()
  g.fillStyle = '#fff'; g.fillRect(-7, -16, 3, 3); g.fillRect(4, -16, 3, 3)
  return g.getImageData(0, 0, s, s)
}
// Dispatch location glyph: a diamond with a dark core. Reads as "a place you can send someone".
function placeIcon(color) {
  const s = 36, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.shadowColor = color; g.shadowBlur = 6
  g.fillStyle = color; g.beginPath(); g.moveTo(0, -11); g.lineTo(11, 0); g.lineTo(0, 11); g.lineTo(-11, 0); g.closePath(); g.fill()
  g.shadowBlur = 0
  g.fillStyle = '#06101f'; g.beginPath(); g.moveTo(0, -6); g.lineTo(6, 0); g.lineTo(0, 6); g.lineTo(-6, 0); g.closePath(); g.fill()
  g.fillStyle = color; g.beginPath(); g.arc(0, 0, 2, 0, Math.PI * 2); g.fill()
  return g.getImageData(0, 0, s, s)
}

// ---------- Places (authored tier, stood in by the baked POIs) ----------
const KIND_COLOR = { hospital: '#e07a9a', police: '#4ea3ff', fire_station: '#ff5a4e' }
const KIND_LABEL = { hospital: 'Hospital', police: 'Police', fire_station: 'Fire station' }
let places = []   // { id, name, kind, lonlat, node, contacts: [{name, status}] }

// ---------- Units ----------
const ROLE_COLOR = { police: '#4ea3ff', fire: '#ff5a4e', civilian: '#e8e2c9' }
const units = []
let selected = null, hoverUnit = null, hoverDistrict = null, timeScale = 6, follow = false
let paintMode = 'shroud'   // 'shroud' | 'streets' | 'both'

function makeUnit(id, role, name, place) {
  const node = nearestNode(place.lonlat)
  const u = { id, role, name, node, pos: graph.nodes[node], bearing: 0, route: null, progress: 0,
              status: 'parked', district: null, target: null, place, home: place }
  u.district = districtAt(u.pos)?.id ?? null
  units.push(u); return u
}

// A route object the mover can walk: coords, cumulative metres, per-segment kph,
// and which edge each segment belongs to (so a re-dispatch mid-edge can start from the
// edge's far end instead of teleporting back to its near end).
function buildRoute(coords, kph, edges, segEdge, seconds) {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]))
  return { coords, cum, kph, edges, segEdge, seconds, length: cum[cum.length - 1], seg: 0 }
}
function routeToParts(r) {
  const kph = [], segEdge = []
  r.edges.forEach((e, ei) => { for (let i = 1; i < e.geom.length; i++) { kph.push(e.kph); segEdge.push(ei) } })
  return { coords: r.coords, kph, segEdge }
}
// Where a moving unit can next change plans: the far node of the edge it is on, plus the
// coordinates it still has to cover to get there.
function nextNodeAndRemainder(u) {
  const r = u.route
  if (!r || !r.edges.length) return { node: u.node, prefix: null }
  const ei = r.segEdge[Math.min(r.seg, r.segEdge.length - 1)]
  const e = r.edges[ei]
  let end = r.seg + 1
  while (end < r.coords.length - 1 && r.segEdge[end] === ei) end++
  return { node: e.v, prefix: { coords: [u.pos, ...r.coords.slice(r.seg + 1, end + 1)], kph: e.kph, edge: e } }
}

const hopSpeed = (u, kph) => (u.status === 'patrol' ? Math.min(kph, 30) : kph * 1.15) / 3.6

function setRoute(u, r, prefix) {
  const parts = routeToParts(r)
  let coords = parts.coords, kph = parts.kph, segEdge = parts.segEdge, edges = r.edges
  if (prefix) {
    const n = prefix.coords.length - 1
    coords = [...prefix.coords, ...coords.slice(1)]
    kph = [...Array(n).fill(prefix.kph), ...kph]
    edges = [prefix.edge, ...edges]
    segEdge = [...Array(n).fill(0), ...segEdge.map(i => i + 1)]
  }
  u.route = buildRoute(coords, kph, edges, segEdge, r.seconds)
  u.progress = 0
}

// The two legal targets: a district (patrol on ENGAGE, park at the near edge on HIDE) or a place.
function dispatch(u, target) {
  const { node: from, prefix } = nextNodeAndRemainder(u)
  let toNode, label
  if (target.district) { toNode = entryNode(target.district, prefix ? graph.nodes[from] : u.pos); label = target.district.label }
  else if (target.place) { toNode = target.place.node; label = target.place.name }
  if (!toNode) { setHint('No road in there.'); return }
  const r = route(from, toNode, { emergency: true, multiplier: dangerMultiplier })
  if (!r) { setHint('No route.'); return }
  setRoute(u, r, prefix)
  u.node = from
  u.status = 'moving'
  u.target = { node: toNode, district: target.district ?? null, place: target.place ?? null, activity: target.activity ?? 'engage' }
  u.district = null; u.place = null   // in transit: belongs to no district, sits at no place
  u.eta = r.seconds
  setHint(`${u.name} → ${label}: ${(u.route.length / 1000).toFixed(1)} km, ${fmt(r.seconds)} at road speed`)
  renderRoster(); pushRoutes()
}

function advance(u, simDt) {
  const r = u.route; if (!r) return
  const kph = r.kph[Math.min(r.seg, r.kph.length - 1)] || 40
  u.progress = Math.min(u.progress + hopSpeed(u, kph) * simDt, r.length)
  while (r.seg < r.cum.length - 2 && r.cum[r.seg + 1] < u.progress) r.seg++
  const a = r.coords[r.seg], b = r.coords[r.seg + 1] ?? a
  const span = (r.cum[r.seg + 1] ?? r.cum[r.seg]) - r.cum[r.seg]
  const t = span > 0 ? (u.progress - r.cum[r.seg]) / span : 1
  u.pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  if (a !== b) u.bearing = bearingDeg(a, b)
  if (u.progress >= r.length) arrive(u)
}

function arrive(u) {
  const t = u.target
  u.node = t?.node ?? u.node
  u.pos = graph.nodes[u.node]
  u.district = districtAt(u.pos)?.id ?? null
  u.route = null
  if (t?.place) { u.status = 'parked'; u.place = t.place; u.target = null }
  else if (t?.district && t.activity === 'engage') { u.status = 'patrol'; startPatrolLeg(u, t.district) }
  else { u.status = 'parked'; u.target = null }
  renderRoster(); pushRoutes()
}

function startPatrolLeg(u, district) {
  const r = patrolRoute(u.node, district)
  if (!r) { u.status = 'parked'; u.target = null; return }
  setRoute(u, r, null)
  u.target = { node: r.edges[r.edges.length - 1].v, district, place: null, activity: 'engage' }
}
// Patrol legs chain: when one ends, arrive() sees activity 'engage' and starts the next.

function remainingSeconds(u) {
  const r = u.route; if (!r) return 0
  let s = 0
  for (let i = r.seg; i < r.coords.length - 1; i++) {
    const segLen = r.cum[i + 1] - r.cum[i]
    const covered = i === r.seg ? u.progress - r.cum[i] : 0
    s += (segLen - covered) / hopSpeed(u, r.kph[i] || 40)
  }
  return s
}

// ---------- Map data plumbing ----------
const emptyFC = () => ({ type: 'FeatureCollection', features: [] })
function unitsFC() {
  return { type: 'FeatureCollection', features: units.map(u => ({
    type: 'Feature', id: u.id, properties: { id: u.id, icon: 'car-' + u.role, bearing: u.bearing, status: u.status, name: u.name },
    geometry: { type: 'Point', coordinates: u.pos } })) }
}
function routesFC() {
  return { type: 'FeatureCollection', features: units.filter(u => u.route && u.status === 'moving').map(u => ({
    type: 'Feature', id: u.id, properties: { id: u.id, selected: u === selected ? 1 : 0, color: ROLE_COLOR[u.role] },
    geometry: { type: 'LineString', coordinates: u.route.coords.slice(u.route.seg) } })) }
}
function roadsOverlayFC() {
  return { type: 'FeatureCollection', features: graph.edges.filter(e => graph.edgeDistrict[e.id]).map(e => ({
    type: 'Feature', properties: { d: danger[graph.edgeDistrict[e.id]], hw: e.hw }, geometry: { type: 'LineString', coordinates: e.geom } })) }
}
// "Streets" danger look: heat blooming along the district's own roads. Still district-level
// data (one number per district), rendered where the sim's hordes would actually be.
function heatFC() {
  return { type: 'FeatureCollection', features: graph.edges.filter(e => graph.edgeDistrict[e.id] && danger[graph.edgeDistrict[e.id]] > 0).flatMap(e => {
    const w = danger[graph.edgeDistrict[e.id]]
    return e.geom.filter((_, i) => i % 3 === 0).map(p => ({ type: 'Feature', properties: { w }, geometry: { type: 'Point', coordinates: p } }))
  }) }
}
function placesFC() {
  return { type: 'FeatureCollection', features: places.map(p => ({
    type: 'Feature', id: p.id, properties: { id: p.id, name: p.name, kind: p.kind, icon: 'place-' + p.kind, contacts: p.contacts.length },
    geometry: { type: 'Point', coordinates: p.lonlat } })) }
}
function pushRoutes() { map.getSource('routes')?.setData(routesFC()) }
function pushDistricts() {
  map.getSource('districts')?.setData(districtsGeoJSON())
  map.getSource('roads-overlay')?.setData(roadsOverlayFC())
  map.getSource('heat')?.setData(heatFC())
}
function applyPaintMode() {
  const shroud = paintMode !== 'streets', streets = paintMode !== 'shroud'
  map.setLayoutProperty('district-shroud', 'visibility', shroud ? 'visible' : 'none')
  map.setLayoutProperty('roads-dim', 'visibility', shroud ? 'visible' : 'none')
  map.setLayoutProperty('heat', 'visibility', streets ? 'visible' : 'none')
  document.getElementById('paint-mode').textContent = paintMode
}

map.on('error', e => console.warn('[map error]', e?.error?.message ?? e))
map.on('load', async () => {
  console.log('[spike] style loaded; loading graph')
  await loadGraph('/data/roads.json')
  tagEdges()
  console.log('[spike] graph', graph.ids.length, 'nodes', graph.edges.length, 'edges')
  for (const [k, c] of Object.entries(ROLE_COLOR)) map.addImage('car-' + k, carIcon(c))
  for (const [k, c] of Object.entries(KIND_COLOR)) map.addImage('place-' + k, placeIcon(c))

  // Districts: tint under buildings, boundary line, label. Danger draws a shroud ABOVE the
  // buildings: in the pitched view the extrusions poke up through it, so rooftops stay lit
  // while the streets sink into black.
  map.addSource('districts', { type: 'geojson', data: districtsGeoJSON(), promoteId: 'id' })
  map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': ['+', 0.06, ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]],
  } }, 'buildings')
  map.addSource('roads-overlay', { type: 'geojson', data: roadsOverlayFC() })
  map.addLayer({ id: 'roads-dim', type: 'line', source: 'roads-overlay', paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'd'], 0, '#06101f', 0.5, '#3a0d18', 1, '#1a0408'],
    'line-opacity': ['*', 0.7, ['get', 'd']],
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1.5, 16, 7],
  } }, 'buildings')
  map.addLayer({ id: 'district-shroud', type: 'fill', source: 'districts', paint: {
    'fill-color': '#03050a', 'fill-opacity': ['*', 0.62, ['get', 'danger']],
  } })
  map.addSource('heat', { type: 'geojson', data: heatFC() })
  map.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', layout: { visibility: 'none' }, paint: {
    'heatmap-weight': ['get', 'w'],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 14, 16, 16, 36],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.12, 14, 0.2, 16, 0.35],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0,0,0,0)', 0.2, 'rgba(60,4,18,0.35)', 0.5, 'rgba(130,12,30,0.55)', 0.8, 'rgba(190,35,40,0.7)', 1, 'rgba(225,70,50,0.8)'],
    'heatmap-opacity': 0.75,
  } })
  map.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'danger'], 0, ['get', 'color'], 1, '#ff3b3b'],
    'line-width': ['+', ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.2], ['get', 'danger']], 'line-opacity': 0.9,
  } })
  map.addLayer({ id: 'district-label', type: 'symbol', source: 'districts', layout: {
    'text-field': ['upcase', ['get', 'label']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-letter-spacing': 0.15, 'text-allow-overlap': true,
  }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#06101f', 'text-halo-width': 1.5, 'text-opacity': 0.85 } })

  // Free tier: any named place from the tiles gets a hover name and a card, but is not a
  // dispatch target. Invisible hit circles.
  map.addLayer({ id: 'poi-hit', type: 'circle', source: 'protomaps', 'source-layer': 'pois', minzoom: 13,
    filter: ['has', 'name'], paint: { 'circle-radius': 9, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } })

  // Authored tier: always drawn, always clickable, dispatch targets. The baked emergency POIs
  // stand in for the real authored list until the landmarks pass.
  const pois = await (await fetch('/data/pois.json')).json()
  places = pois.filter(p => !/Training Prop|ARFF/.test(p.name))
    .map((p, i) => ({ id: 'p' + i, name: p.name, kind: p.kind, lonlat: p.lonlat, node: nearestNode(p.lonlat), contacts: [] }))
  const gs = places.find(p => /Good Samaritan/.test(p.name))
  if (gs) gs.contacts.push({ name: 'Marcus Webb', status: 'hiding' })
  map.addSource('places', { type: 'geojson', data: placesFC(), promoteId: 'id' })
  map.addLayer({ id: 'place-ring', type: 'circle', source: 'places', filter: ['>', ['get', 'contacts'], 0], paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 18], 'circle-color': '#ffd24a', 'circle-opacity': 0.12,
    'circle-stroke-color': '#ffd24a', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.9 } })
  map.addLayer({ id: 'places', type: 'symbol', source: 'places', layout: {
    'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 16, 1],
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 10, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true,
    'text-max-width': 12,
  }, paint: {
    'text-color': ['match', ['get', 'kind'], 'hospital', KIND_COLOR.hospital, 'police', KIND_COLOR.police, KIND_COLOR.fire_station],
    'text-halo-color': '#06101f', 'text-halo-width': 1.2,
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.6, 0.9],
    'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.85],
  } })

  // Routes and units.
  map.addSource('routes', { type: 'geojson', data: emptyFC(), promoteId: 'id' })
  map.addLayer({ id: 'route-glow', type: 'line', source: 'routes', paint: {
    'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'selected'], 1], 9, 5], 'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.22, 0.08], 'line-blur': 3 } })
  map.addLayer({ id: 'route-line', type: 'line', source: 'routes', paint: {
    'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1.2], 'line-opacity': ['case', ['==', ['get', 'selected'], 1], 1, 0.45],
    'line-dasharray': [2, 2] } })
  map.addSource('units', { type: 'geojson', data: emptyFC(), promoteId: 'id' })
  map.addLayer({ id: 'unit-halo', type: 'circle', source: 'units', paint: {
    'circle-radius': 16, 'circle-color': '#ffd24a',
    'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.25, ['boolean', ['feature-state', 'hover'], false], 0.15, 0],
    'circle-stroke-color': '#ffd24a', 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1.5, 0] } })
  map.addLayer({ id: 'units', type: 'symbol', source: 'units', layout: {
    'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1.1],
    'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 10, 'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-optional': true,
  }, paint: { 'text-color': '#cfe0ff', 'text-halo-color': '#06101f', 'text-halo-width': 1.2 } })

  // Spawn at real stations.
  const findPlace = (kind, re) => places.find(p => p.kind === kind && re.test(p.name))
  const lpd = findPlace('police', /Lexington Police/) ?? places[0]
  const fs4 = findPlace('fire_station', /#4\b/) ?? lpd
  const fs5 = findPlace('fire_station', /#5\b/) ?? lpd
  makeUnit('u1', 'police', 'Sullivan', lpd)
  makeUnit('u2', 'police', 'Kowalski', lpd)
  makeUnit('u3', 'fire', 'Garza', fs4)
  makeUnit('u4', 'fire', 'Martinez', fs5)

  Object.assign(window.spike, { units, places, select, dispatch, DISTRICTS, entryNode })
  renderRoster(); renderDanger(); applyPaintMode()
  map.getSource('units').setData(unitsFC())
  requestAnimationFrame(loop)
})
window.spike = { get timeScale() { return timeScale }, set timeScale(v) { timeScale = v } }

// ---------- Sim loop ----------
let last = performance.now(), dashT = 0, rosterT = 0
function loop(now) {
  const wallDt = Math.min(0.1, (now - last) / 1000); last = now
  const simDt = wallDt * timeScale
  let moved = false
  for (const u of units) if (u.route) { advance(u, simDt); moved = true }
  if (moved) {
    map.getSource('units')?.setData(unitsFC())
    pushRoutes()
    if (follow && selected) map.jumpTo({ center: selected.pos })
  }
  dashT += wallDt; rosterT += wallDt
  if (rosterT > 0.25) { rosterT = 0; tickRoster() }
  if (map.getLayer('route-line')) { const k = Math.floor(dashT * 6) % 4; map.setPaintProperty('route-line', 'line-dasharray', [[2, 2], [1.5, 2, 0.5, 0], [1, 2, 1, 0], [0.5, 2, 1.5, 0]][k]) }
  requestAnimationFrame(loop)
}

// ---------- Interaction ----------
const tip = document.getElementById('tip')
function showTip(html, pt) { tip.innerHTML = html; tip.hidden = false; tip.style.left = pt.x + 'px'; tip.style.top = pt.y + 'px' }
function hideTip() { tip.hidden = true }
function fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function setHint(t) { document.getElementById('hint').textContent = t }
const districtOf = id => DISTRICTS.find(d => d.id === id)

// What is under the cursor, in priority order.
function hit(point) {
  const feats = map.queryRenderedFeatures(point, { layers: ['units', 'places', 'poi-hit', 'district-fill'] })
  const f = id => feats.find(x => x.layer.id === id)
  const unitF = f('units'), placeF = f('places'), poiF = f('poi-hit'), distF = f('district-fill')
  return {
    unit: unitF && units.find(u => u.id === unitF.properties.id),
    place: placeF && places.find(p => p.id === placeF.properties.id),
    poi: poiF, district: distF && districtOf(distF.properties.id),
  }
}

map.on('mousemove', e => {
  if (!map.getLayer('units') || ctxOpen) return
  const h = hit(e.point)
  setHoverUnit(h.unit ?? null); setHoverDistrict(h.district ?? null); setHoverPlace(h.place ?? null)
  map.getCanvas().style.cursor = h.unit || h.place || h.poi ? 'pointer' : h.district && selected ? 'crosshair' : ''
  if (h.unit) { const u = h.unit; showTip(`<b>${u.name}</b> · ${u.role} · ${statusText(u)}`, e.point); return }
  if (h.place) { const p = h.place; showTip(`<b>${p.name}</b> <span class="dim">${KIND_LABEL[p.kind]} · dispatch location${p.contacts.length ? ` · ${p.contacts.length} contact` : ''}</span>`, e.point); return }
  if (h.poi) { const p = h.poi.properties; showTip(`<b>${p.name}</b> <span class="dim">${p.kind ?? ''}</span>`, e.point); return }
  if (h.district) {
    const d = h.district
    if (selected) {
      const { node: from } = nextNodeAndRemainder(selected)
      const n = entryNode(d, graph.nodes[from])
      const r = n && route(from, n, { emergency: true, multiplier: dangerMultiplier })
      showTip(`<b>${d.label}</b> · ${selected.name} ETA ${r ? fmt(r.seconds) : '—'}${r ? ' · ' + (r.metres / 1000).toFixed(1) + ' km' : ''}`, e.point)
    } else showTip(`<b>${d.label}</b> <span class="dim">${d.category}</span>`, e.point)
    return
  }
  hideTip()
})
map.on('mouseout', () => { hideTip(); setHoverUnit(null); setHoverDistrict(null); setHoverPlace(null) })

function setFS(source, cur, next, key) {
  if (cur === next) return next
  if (cur) map.setFeatureState({ source, id: cur.id }, { [key]: false })
  if (next) map.setFeatureState({ source, id: next.id }, { [key]: true })
  return next
}
function setHoverDistrict(d) { hoverDistrict = setFS('districts', hoverDistrict, d, 'hover') }
let hoverPlace = null
function setHoverPlace(p) { hoverPlace = setFS('places', hoverPlace, p, 'hover') }
function setHoverUnit(u) {
  hoverUnit = setFS('units', hoverUnit, u, 'hover')
  document.querySelectorAll('#roster-rows .row').forEach(r => r.classList.toggle('hover', !!u && r.dataset.id === u.id))
}
function select(u) {
  selected = setFS('units', selected, u, 'selected')
  if (!u) follow = false
  renderRoster(); pushRoutes()
}

// Left click: select a unit; with a unit selected, a district or a place dispatches it.
// Bare map deselects. Nothing else is a target.
map.on('click', e => {
  if (!map.getLayer('units')) return
  closeCtx()
  const h = hit(e.point)
  if (h.unit) { select(h.unit === selected ? null : h.unit); return }
  if (h.place) { showPlace(h.place); if (selected) dispatch(selected, { place: h.place }); return }
  if (h.poi) { showPoi(h.poi); return }
  if (h.district && selected) { dispatch(selected, { district: h.district, activity: 'engage' }); return }
  if (selected) select(null)
})

// Right click: a context menu for whatever is under the cursor. The spike only fills in the
// verbs that exist today; the point is that the surface exists.
const ctx = document.getElementById('ctx')
let ctxOpen = false
function closeCtx() { ctx.hidden = true; ctxOpen = false }
function openCtx(items, point, title) {
  ctx.innerHTML = (title ? `<div class="ctx-title">${title}</div>` : '') + items.map((it, i) =>
    `<div class="ctx-item ${it.disabled ? 'disabled' : ''}" data-i="${i}">${it.label}</div>`).join('')
  ctx.querySelectorAll('.ctx-item').forEach(el => el.onclick = () => { const it = items[+el.dataset.i]; if (!it.disabled) { it.run(); closeCtx() } })
  ctx.style.left = Math.min(point.x, innerWidth - 240) + 'px'; ctx.style.top = Math.min(point.y, innerHeight - 200) + 'px'
  ctx.hidden = false; ctxOpen = true; hideTip()
}
map.on('contextmenu', e => {
  if (!map.getLayer('units')) return
  e.preventDefault?.(); e.originalEvent?.preventDefault?.()
  const h = hit(e.point)
  const sel = selected
  const need = sel ? '' : ' (select a unit first)'
  if (h.unit) {
    const u = h.unit
    return openCtx([
      { label: u === selected ? 'Deselect' : 'Select', run: () => select(u === selected ? null : u) },
      { label: follow && u === selected ? 'Stop following' : 'Follow', run: () => { select(u); follow = !follow; if (follow) map.flyTo({ center: u.pos, zoom: 16, pitch: 60, duration: 800 }) } },
      { label: `Return to ${u.home.name}`, run: () => dispatch(u, { place: u.home }) },
    ], e.point, `${u.name} · ${u.role}`)
  }
  if (h.place) {
    const p = h.place
    return openCtx([
      { label: `Dispatch ${sel?.name ?? 'unit'} here${need}`, disabled: !sel, run: () => dispatch(sel, { place: p }) },
      { label: 'Show place', run: () => showPlace(p) },
    ], e.point, p.name)
  }
  if (h.district) {
    const d = h.district
    return openCtx([
      { label: `ENGAGE — ${sel?.name ?? 'unit'} patrols ${d.label}${need}`, disabled: !sel, run: () => dispatch(sel, { district: d, activity: 'engage' }) },
      { label: `HIDE — ${sel?.name ?? 'unit'} holds at the edge${need}`, disabled: !sel, run: () => dispatch(sel, { district: d, activity: 'hide' }) },
      { label: 'District info (todo)', disabled: true, run: () => {} },
    ], e.point, d.label)
  }
  openCtx([
    { label: 'Deselect', disabled: !sel, run: () => select(null) },
    { label: 'Overview', run: overview },
  ], e.point, 'Outside coverage')
})
window.addEventListener('mousedown', e => { if (ctxOpen && !ctx.contains(e.target)) closeCtx() })

function showPlace(p) {
  const d = districtAt(p.lonlat)
  const here = units.filter(u => u.place === p || (!u.route && dist(u.pos, p.lonlat) < 80)).map(u => u.name)
  const enroute = units.filter(u => u.target?.place === p).map(u => u.name)
  document.getElementById('place').hidden = false
  document.getElementById('place-name').textContent = p.name
  document.getElementById('place-meta').innerHTML = [
    ['KIND', KIND_LABEL[p.kind]], ['DISTRICT', d ? d.label : 'outside coverage'],
    ['UNITS HERE', here.length ? here.join(', ') : 'none'], ['EN ROUTE', enroute.length ? enroute.join(', ') : '—'],
    ['CONTACTS', p.contacts.length ? p.contacts.map(c => `${c.name} — ${c.status}`).join('<br>') : 'none'],
    ['', `<span class="link" id="place-go">▶ dispatch ${selected ? selected.name : 'selected unit'} here</span>`],
  ].map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')
  document.getElementById('place-go').onclick = () => selected ? dispatch(selected, { place: p }) : setHint('Select a unit first.')
}
function showPoi(f) {
  const p = f.properties, ll = f.geometry.coordinates, d = districtAt(ll)
  document.getElementById('place').hidden = false
  document.getElementById('place-name').textContent = p.name
  document.getElementById('place-meta').innerHTML = [
    ['KIND', p.kind ?? '—'], ['DISTRICT', d ? d.label : 'outside coverage'], ['CONTACTS', 'none'],
    ['', `<span class="dim">Not a dispatch location. Send a unit to ${d ? d.label : 'a district'} instead.</span>`],
  ].map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')
}

// ---------- Roster + danger panels ----------
function statusText(u) {
  const where = u.place ? u.place.name : u.district ? districtOf(u.district).label : 'outside coverage'
  if (u.status === 'moving') { const t = u.target; return `MOVING · ${t.place ? t.place.name : t.district.label} · ETA ${fmt(remainingSeconds(u))}` }
  if (u.status === 'patrol') return `PATROL · ${where}`
  return `PARKED · ${where}`
}
function renderRoster() {
  const rows = document.getElementById('roster-rows')
  rows.innerHTML = units.map(u =>
    `<div class="row ${u === selected ? 'selected' : ''}" data-id="${u.id}"><span class="dot ${u.role}"></span><span>${u.name}</span><span class="status ${u.status}">${statusText(u)}</span></div>`
  ).join('')
  rows.querySelectorAll('.row').forEach(r => {
    r.onclick = () => { const u = units.find(x => x.id === r.dataset.id); select(u === selected ? null : u) }
    r.onmouseenter = () => setHoverUnit(units.find(u => u.id === r.dataset.id))
    r.onmouseleave = () => setHoverUnit(null)
  })
}
function tickRoster() {
  document.querySelectorAll('#roster-rows .row').forEach(r => {
    const u = units.find(x => x.id === r.dataset.id); if (!u) return
    const s = r.querySelector('.status'); const t = statusText(u)
    if (s.textContent !== t) { s.textContent = t; s.className = 'status ' + u.status }
  })
}
function renderDanger() {
  const rows = document.getElementById('danger-rows')
  rows.innerHTML = DISTRICTS.map(d => `<div class="drow"><span style="color:${CATEGORY_COLOR[d.category]}">${d.label}</span><input type="range" min="0" max="100" value="${Math.round(danger[d.id] * 100)}" data-id="${d.id}"><span class="v">${Math.round(danger[d.id] * 100)}%</span></div>`).join('')
  rows.querySelectorAll('input').forEach(i => i.oninput = () => { danger[i.dataset.id] = i.value / 100; i.nextElementSibling.textContent = i.value + '%'; pushDistricts() })
  document.getElementById('paint-toggle').onclick = cyclePaint
}
function cyclePaint() { paintMode = { shroud: 'streets', streets: 'both', both: 'shroud' }[paintMode]; applyPaintMode() }
function overview() { follow = false; map.flyTo({ center: cfg.center, zoom: 13.4, pitch: 52, bearing: -12, duration: 1200 }) }

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (ctxOpen) closeCtx(); else if (selected) select(null); else document.getElementById('place').hidden = true }
  if (e.key === 'o') overview()
  if (e.key === 'f') { follow = !follow && !!selected; if (follow) map.flyTo({ center: selected.pos, zoom: 16, pitch: 60, duration: 800 }) }
  if (e.key === 'p') cyclePaint()
  if (e.key === '1') timeScale = 1
  if (e.key === '2') timeScale = 6
  if (e.key === '3') timeScale = 20
  if (['1', '2', '3'].includes(e.key)) setHint(`time scale ${timeScale}×`)
})
map.on('dragstart', () => { follow = false })
