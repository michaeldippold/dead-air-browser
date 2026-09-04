// Dead Air map spike. Judging: the dark real-city look, units on real roads,
import 'maplibre-gl/dist/maplibre-gl.css'
// district = state / position = geography, hover/click, danger paint.
import * as maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'
import { graph, loadGraph, nearestNode, route, dist, bearingDeg } from './graph.js'
import { DISTRICTS, CATEGORY_COLOR, danger, districtAt, tagEdges, dangerMultiplier, entryNode, patrolStep, districtsGeoJSON } from './districts.js'

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
let base = layers('protomaps', flavor, { lang: 'en' }).filter(l => !DROP.test(l.id))
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
window.spike = { units: null, select: null, dispatchTo: null, get timeScale() { return timeScale }, set timeScale(v) { timeScale = v } }

// ---------- Unit icon: top-down car, drawn in code ----------
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
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }

// ---------- Units ----------
const ROLE_COLOR = { police: '#4ea3ff', fire: '#ff5a4e', civilian: '#e8e2c9' }
const units = []
let selected = null, hovered = null, timeScale = 6, follow = false

function makeUnit(id, role, name, lonlat) {
  const node = nearestNode(lonlat)
  const u = { id, role, name, node, pos: graph.nodes[node], bearing: 0, route: null, progress: 0, status: 'idle', district: null, target: null }
  u.district = districtAt(u.pos)?.id ?? null
  units.push(u); return u
}

function buildRoute(r) {
  const coords = r.coords, cum = [0], kph = []
  // per-segment speed: walk edges and their geometry to assign kph to each vertex-to-vertex segment
  let k = 0
  for (const e of r.edges) for (let i = 1; i < e.geom.length; i++) { kph.push(e.kph); k++ }
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]))
  while (kph.length < coords.length - 1) kph.push(40)
  return { coords, cum, kph, length: cum[cum.length - 1], seg: 0, edges: r.edges }
}

function dispatchTo(u, toNode, mode, districtObj = null) {
  if (!toNode || toNode === u.node && mode !== 'patrol') return
  const r = route(u.node, toNode, { emergency: true, multiplier: dangerMultiplier })
  if (!r) { setHint('No route.'); return }
  u.route = buildRoute(r); u.progress = 0
  u.status = 'moving'; u.target = { node: toNode, mode, district: districtObj }
  u.district = null   // in transit: belongs to no district
  u.eta = r.seconds
  setHint(`${u.name} → ${districtObj ? districtObj.label : 'point'}: ${(r.metres / 1000).toFixed(1)} km, ETA ${fmt(r.seconds)} (real) · ${fmt(r.seconds / timeScale)} at ${timeScale}×`)
  renderRoster(); pushRoutes()
}

function advance(u, simDt) {
  const r = u.route; if (!r) return
  const kph = r.kph[Math.min(r.seg, r.kph.length - 1)] || 40
  const mps = (u.status === 'patrol' ? Math.min(kph, 30) : kph * 1.15) / 3.6
  u.progress = Math.min(u.progress + mps * simDt, r.length)
  while (r.seg < r.cum.length - 2 && r.cum[r.seg + 1] < u.progress) r.seg++
  const a = r.coords[r.seg], b = r.coords[r.seg + 1] ?? a
  const span = (r.cum[r.seg + 1] ?? r.cum[r.seg]) - r.cum[r.seg]
  const t = span > 0 ? (u.progress - r.cum[r.seg]) / span : 1
  u.pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  if (a !== b) u.bearing = bearingDeg(a, b)
  if (u.progress >= r.length) arrive(u)
}

function arrive(u) {
  u.node = u.target?.node ?? u.node
  u.pos = graph.nodes[u.node]
  u.district = districtAt(u.pos)?.id ?? null
  const mode = u.target?.mode
  if (mode === 'patrol' && u.target.district) {
    // ENGAGE: random walk on in-district roads. One edge at a time.
    const e = patrolStep(u.node, u.target.district)
    if (e) { u.route = buildRoute({ coords: e.geom, edges: [e], seconds: 0, metres: e.len }); u.progress = 0; u.status = 'patrol'; u.target = { node: e.v, mode: 'patrol', district: u.target.district }; return }
  }
  u.route = null; u.status = mode === 'patrol' ? 'patrol' : 'idle'; u.target = null
  renderRoster(); pushRoutes()
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
function pushRoutes() { map.getSource('routes')?.setData(routesFC()) }
function pushDistricts() { map.getSource('districts')?.setData(districtsGeoJSON()); map.getSource('roads-overlay')?.setData(roadsOverlayFC()) }

map.on('error', e => console.warn('[map error]', e?.error?.message ?? e))
map.on('load', async () => {
  console.log('[spike] style loaded; loading graph')
  await loadGraph('/data/roads.json')
  console.log('[spike] graph', graph.ids.length, 'nodes', graph.edges.length, 'edges')
  tagEdges()
  map.addImage('car-police', carIcon(ROLE_COLOR.police))
  map.addImage('car-fire', carIcon(ROLE_COLOR.fire))
  map.addImage('car-civilian', carIcon(ROLE_COLOR.civilian))

  // Districts: tint under buildings, boundary line, label. Danger reddens the fill.
  map.addSource('districts', { type: 'geojson', data: districtsGeoJSON(), promoteId: 'id' })
  map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': ['+', 0.06, ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]],
  } }, 'buildings')
  // "Going dark": a shroud ABOVE the buildings layer. In the pitched view the extrusions poke
  // up through it, so rooftops stay faintly lit while the streets sink into black. Not a red blob.
  map.addLayer({ id: 'district-shroud', type: 'fill', source: 'districts', paint: {
    'fill-color': '#03050a', 'fill-opacity': ['*', 0.62, ['get', 'danger']],
  } })
  map.addSource('roads-overlay', { type: 'geojson', data: roadsOverlayFC() })
  map.addLayer({ id: 'roads-dim', type: 'line', source: 'roads-overlay', paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'd'], 0, '#06101f', 0.5, '#3a0d18', 1, '#1a0408'],
    'line-opacity': ['*', 0.7, ['get', 'd']],
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1.5, 16, 7],
  } }, 'buildings')
  map.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'danger'], 0, ['get', 'color'], 1, '#ff3b3b'],
    'line-width': ['+', ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.2], ['get', 'danger']], 'line-opacity': 0.9,
  } })
  map.addLayer({ id: 'district-label', type: 'symbol', source: 'districts', layout: {
    'text-field': ['upcase', ['get', 'label']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-letter-spacing': 0.15, 'text-allow-overlap': true,
  }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#06101f', 'text-halo-width': 1.5, 'text-opacity': 0.85 } })

  // POI hit layer: invisible circles over named places, so hover/click can name any building.
  map.addLayer({ id: 'poi-hit', type: 'circle', source: 'protomaps', 'source-layer': 'pois', minzoom: 13,
    filter: ['has', 'name'], paint: { 'circle-radius': 9, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } })

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

  // Spawn at real stations (from the bake).
  const pois = await (await fetch('/data/pois.json')).json()
  const find = (kind, re) => pois.find(p => p.kind === kind && re.test(p.name))?.lonlat
  const lpd = find('police', /Lexington Police/) ?? [-84.496574, 38.045184]
  const fs4 = find('fire_station', /#4\b/) ?? [-84.499068, 38.054455]
  const fs5 = find('fire_station', /#5\b/) ?? [-84.493304, 38.03611]
  makeUnit('u1', 'police', 'Sullivan', lpd)
  makeUnit('u2', 'police', 'Kowalski', lpd)
  makeUnit('u3', 'fire', 'Garza', fs4)
  makeUnit('u4', 'fire', 'Martinez', fs5)

  // One caller pin as a DOM marker, to see the style: Good Samaritan Hospital.
  const gs = find('hospital', /Good Samaritan/)
  if (gs) { const el = document.createElement('div'); el.className = 'caller-pin'; el.title = 'Marcus Webb — Good Samaritan Hospital'
    new maplibregl.Marker({ element: el }).setLngLat(gs).addTo(map) }

  Object.assign(window.spike, { units, select, dispatchTo, DISTRICTS, entryNode })
  renderRoster(); renderDanger()
  map.getSource('units').setData(unitsFC())
  select(units[0])
  requestAnimationFrame(loop)
})

// ---------- Sim loop ----------
let last = performance.now(), dashT = 0
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
  dashT += wallDt
  if (map.getLayer('route-line')) { const k = Math.floor(dashT * 6) % 4; map.setPaintProperty('route-line', 'line-dasharray', [[2, 2], [1.5, 2, 0.5, 0], [1, 2, 1, 0], [0.5, 2, 1.5, 0]][k]) }
  requestAnimationFrame(loop)
}

// ---------- Interaction ----------
const tip = document.getElementById('tip')
function showTip(html, pt) { tip.innerHTML = html; tip.hidden = false; tip.style.left = pt.x + 'px'; tip.style.top = pt.y + 'px' }
function hideTip() { tip.hidden = true }
function fmt(s) { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function setHint(t) { document.getElementById('hint').textContent = t }

let hoverDistrict = null, hoverUnit = null
map.on('mousemove', e => {
  if (!map.getLayer('units')) return
  const feats = map.queryRenderedFeatures(e.point, { layers: ['units', 'poi-hit', 'district-fill'] })
  const unitF = feats.find(f => f.layer.id === 'units')
  const poiF = feats.find(f => f.layer.id === 'poi-hit')
  const distF = feats.find(f => f.layer.id === 'district-fill')
  setHoverUnit(unitF ? units.find(u => u.id === unitF.properties.id) : null)
  setHoverDistrict(distF ? DISTRICTS.find(d => d.id === distF.properties.id) : null)
  map.getCanvas().style.cursor = unitF || poiF ? 'pointer' : distF ? 'crosshair' : ''
  if (unitF) { const u = units.find(x => x.id === unitF.properties.id); showTip(`<b>${u.name}</b> · ${u.role} · ${u.status}${u.district ? ' · ' + DISTRICTS.find(d => d.id === u.district).label : ''}`, e.point); return }
  if (poiF) { const p = poiF.properties; showTip(`<b>${p.name}</b> <span style="color:#7d95bf">${p.kind ?? ''}</span>`, e.point); return }
  if (distF && selected && selected.status !== 'moving') {
    const d = DISTRICTS.find(x => x.id === distF.properties.id)
    const n = entryNode(d, selected.pos)
    const r = n && route(selected.node, n, { emergency: true, multiplier: dangerMultiplier })
    showTip(`<b>${d.label}</b> · ${selected.name} ETA ${r ? fmt(r.seconds) : '—'} · ${r ? (r.metres / 1000).toFixed(1) + ' km' : ''}`, e.point); return
  }
  if (distF) { showTip(`<b>${distF.properties.label}</b> · ${distF.properties.category}`, e.point); return }
  hideTip()
})
map.on('mouseout', () => { hideTip(); setHoverUnit(null); setHoverDistrict(null) })

function setHoverDistrict(d) {
  if (hoverDistrict === d) return
  if (hoverDistrict) map.setFeatureState({ source: 'districts', id: hoverDistrict.id }, { hover: false })
  hoverDistrict = d
  if (d) map.setFeatureState({ source: 'districts', id: d.id }, { hover: true })
}
function setHoverUnit(u) {
  if (hoverUnit === u) return
  if (hoverUnit) map.setFeatureState({ source: 'units', id: hoverUnit.id }, { hover: false })
  hoverUnit = u
  if (u) map.setFeatureState({ source: 'units', id: u.id }, { hover: true })
  document.querySelectorAll('#roster-rows .row').forEach(r => r.classList.toggle('hover', !!u && r.dataset.id === u.id))
}
function select(u) {
  if (selected) map.setFeatureState({ source: 'units', id: selected.id }, { selected: false })
  selected = u
  if (u) map.setFeatureState({ source: 'units', id: u.id }, { selected: true })
  renderRoster(); pushRoutes()
}

map.on('click', e => {
  if (!map.getLayer('units')) return
  const feats = map.queryRenderedFeatures(e.point, { layers: ['units', 'poi-hit', 'district-fill'] })
  const unitF = feats.find(f => f.layer.id === 'units')
  if (unitF) { select(units.find(u => u.id === unitF.properties.id)); return }
  const poiF = feats.find(f => f.layer.id === 'poi-hit')
  if (poiF) { showPlace(poiF); return }
  if (!selected) return
  const distF = feats.find(f => f.layer.id === 'district-fill')
  if (distF) {
    const d = DISTRICTS.find(x => x.id === distF.properties.id)
    dispatchTo(selected, entryNode(d, selected.pos), 'patrol', d)
  } else {
    dispatchTo(selected, nearestNode([e.lngLat.lng, e.lngLat.lat]), 'point')
  }
})

function showPlace(f) {
  const p = f.properties, ll = f.geometry.coordinates
  const d = districtAt(ll)
  const here = units.filter(u => dist(u.pos, ll) < 80).map(u => u.name)
  document.getElementById('place').hidden = false
  document.getElementById('place-name').textContent = p.name
  document.getElementById('place-meta').innerHTML = [
    ['KIND', p.kind ?? '—'], ['DISTRICT', d ? d.label : 'outside coverage'], ['UNITS HERE', here.length ? here.join(', ') : 'none'],
    ['CONTACTS', /Good Samaritan/.test(p.name) ? 'Marcus Webb — hiding' : 'none'],
    ['', `<span style="color:#7d95bf;cursor:pointer" id="place-go">▶ dispatch selected unit here</span>`],
  ].map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')
  document.getElementById('place-go').onclick = () => selected && dispatchTo(selected, nearestNode(ll), 'point')
}

// ---------- Roster + danger panels ----------
function renderRoster() {
  const rows = document.getElementById('roster-rows')
  rows.innerHTML = units.map(u => {
    const d = u.district ? DISTRICTS.find(x => x.id === u.district)?.label : (u.status === 'moving' ? 'en route' : 'outside coverage')
    return `<div class="row ${u === selected ? 'selected' : ''}" data-id="${u.id}"><span class="dot ${u.role}"></span><span>${u.name}</span><span class="status ${u.status === 'moving' ? 'moving' : ''}">${u.status.toUpperCase()} · ${d}</span></div>`
  }).join('')
  rows.querySelectorAll('.row').forEach(r => {
    r.onclick = () => select(units.find(u => u.id === r.dataset.id))
    r.onmouseenter = () => setHoverUnit(units.find(u => u.id === r.dataset.id))
    r.onmouseleave = () => setHoverUnit(null)
  })
}
function renderDanger() {
  const rows = document.getElementById('danger-rows')
  rows.innerHTML = DISTRICTS.map(d => `<div class="drow"><span style="color:${CATEGORY_COLOR[d.category]}">${d.label}</span><input type="range" min="0" max="100" value="${Math.round(danger[d.id] * 100)}" data-id="${d.id}"><span class="v">${Math.round(danger[d.id] * 100)}%</span></div>`).join('')
  rows.querySelectorAll('input').forEach(i => i.oninput = () => { danger[i.dataset.id] = i.value / 100; i.nextElementSibling.textContent = i.value + '%'; pushDistricts() })
}

window.addEventListener('keydown', e => {
  if (e.key === 'o') { follow = false; map.flyTo({ center: cfg.center, zoom: 13.4, pitch: 52, bearing: -12, duration: 1200 }) }
  if (e.key === 'f') { follow = !follow; if (follow && selected) map.flyTo({ center: selected.pos, zoom: 16, pitch: 60, duration: 800 }) }
  if (e.key === '1') timeScale = 1
  if (e.key === '2') timeScale = 6
  if (e.key === '3') timeScale = 20
  if (['1', '2', '3'].includes(e.key)) setHint(`time scale ${timeScale}×`)
})
map.on('dragstart', () => { follow = false })
