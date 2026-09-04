// The map renderer. Hooks in, not imports out (map-integration.md §5d): it receives getters
// over the sim's state and emits intents (select-unit, dispatch, show-place, select-district).
// The sim never imports this module's internals beyond createMapRenderer.
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { buildStyle } from './style.js'
import { registerIcons, ROLE_COLOR, ROLE_ORDER, KIND_COLOR } from './icons.js'
import { addLayers, applyBoundary, animateDash, emptyFC } from './layers.js'
import { attachInteraction } from './interact.js'
import { graph } from './graph.js'
import { DISTRICTS, danger, districtsGeoJSON, districtLabelsGeoJSON } from './districts.js'
import { advance, park, startPatrolLeg } from './mover.js'

export const CAMERA = { center: [-84.4977, 38.0406], zoom: 13.4, pitch: 52, bearing: -12 }

let protocolRegistered = false

// stage: the DOM element the map fills (position: relative). tipEl / ctxEl: tooltip and context
// menu elements inside it. get: { units, unitName, unitStatus, places, placeContacts,
// selectedUnitId, timeScale, districtStatus? }. on: { selectUnit, dispatch, showPlace, showPoi,
// selectDistrict, hoverUnit }.
export function createMapRenderer({ stage, mapEl, tipEl, ctxEl, cfg, get, on }) {
  if (!protocolRegistered) { maplibregl.addProtocol('pmtiles', new Protocol().tile); protocolRegistered = true }
  const B = cfg.bbox
  const map = new maplibregl.Map({
    container: mapEl,
    style: buildStyle(location.origin + '/data/lexington.pmtiles'),
    center: CAMERA.center, zoom: CAMERA.zoom, pitch: CAMERA.pitch, bearing: CAMERA.bearing,
    maxBounds: [[B.west - 0.03, B.south - 0.03], [B.east + 0.03, B.north + 0.03]],
    minZoom: 11, maxZoom: 18, antialias: true, attributionControl: false,
  })
  map.on('error', e => console.warn('[map]', e?.error?.message ?? e))

  const r = { map, stage, tipEl, ctxEl, get, on, ready: false, strongBoundaries: true }

  // ── Feature collections from sim state ──
  function unitsFC() {
    return { type: 'FeatureCollection', features: get.units().filter(u => u.pos && u.status !== 'inside').map(u => ({
      type: 'Feature', id: u.id, properties: { id: u.id, icon: 'car-' + (get.unitRole(u) ?? 'civilian'), bearing: u.bearing ?? 0, status: u.status, name: get.unitName(u) },
      geometry: { type: 'Point', coordinates: u.pos } })) }
  }
  function routesFC() {
    const sel = get.selectedUnitId()
    return { type: 'FeatureCollection', features: get.units().filter(u => u.route && u.status === 'moving').map(u => ({
      type: 'Feature', id: u.id, properties: { id: u.id, selected: u.id === sel ? 1 : 0, color: ROLE_COLOR[get.unitRole(u)] ?? ROLE_COLOR.civilian },
      geometry: { type: 'LineString', coordinates: u.route.coords.slice(u.route.seg) } })) }
  }
  function roadsOverlayFC() {
    return { type: 'FeatureCollection', features: graph.edges.filter(e => graph.edgeDistrict[e.id]).map(e => ({
      type: 'Feature', properties: { d: danger[graph.edgeDistrict[e.id]] ?? 0, hw: e.hw }, geometry: { type: 'LineString', coordinates: e.geom } })) }
  }
  function heatFC() {
    return { type: 'FeatureCollection', features: graph.edges.filter(e => graph.edgeDistrict[e.id] && danger[graph.edgeDistrict[e.id]] > 0).flatMap(e => {
      const w = danger[graph.edgeDistrict[e.id]]
      return e.geom.filter((_, i) => i % 3 === 0).map(p => ({ type: 'Feature', properties: { w }, geometry: { type: 'Point', coordinates: p } }))
    }) }
  }
  function footprintsFC() {
    return { type: 'FeatureCollection', features: get.places().filter(p => p.footprint).map(p => ({
      type: 'Feature', id: p.id, properties: { id: p.id, color: KIND_COLOR[p.kind] ?? '#e8e2c9' }, geometry: { type: 'Polygon', coordinates: [p.footprint] } })) }
  }
  function placesFC() {
    const units = get.units()
    return { type: 'FeatureCollection', features: get.places().map(p => {
      const inside = units.filter(u => u.status === 'inside' && u.place === p.id)
      const badges = {}
      let slot = 0
      for (const role of ROLE_ORDER) { const n = inside.filter(u => get.unitRole(u) === role).length; if (n) badges['badge' + slot++] = `badge-${role}-${Math.min(n, 9)}` }
      return { type: 'Feature', id: p.id, properties: {
        id: p.id, name: p.name, kind: p.kind, icon: KIND_COLOR[p.kind] ? 'place-' + p.kind : 'place-other', color: KIND_COLOR[p.kind] ?? '#e8e2c9',
        contacts: get.placeContacts(p.id).length, inside: inside.length, ...badges },
        geometry: { type: 'Point', coordinates: p.lonlat } }
    }) }
  }

  r.pushUnits = () => { if (r.ready) { map.getSource('units').setData(unitsFC()); map.getSource('routes').setData(routesFC()) } }
  r.pushPlaces = () => { if (r.ready) map.getSource('places').setData(placesFC()) }
  r.pushDistricts = () => {
    if (!r.ready) return
    map.getSource('districts').setData(districtsGeoJSON())
    map.getSource('district-labels').setData(districtLabelsGeoJSON())
    map.getSource('heat').setData(heatFC())
  }
  r.refresh = () => { r.pushUnits(); r.pushPlaces() }
  r.setBoundaries = strong => { r.strongBoundaries = strong; if (r.ready) applyBoundary(map, strong) }

  // ── Selection + follow ──
  let selectedId = null
  r.selectedUnit = () => (selectedId ? get.units().find(u => u.id === selectedId) ?? null : null)
  r.setSelected = id => {
    if (selectedId === id) return
    if (r.ready && selectedId) map.setFeatureState({ source: 'units', id: selectedId }, { selected: false })
    selectedId = id
    if (r.ready && selectedId) map.setFeatureState({ source: 'units', id: selectedId }, { selected: true })
    if (!id) r.stopFollow()
    r.pushUnits()
  }
  let follow = false, followZoom = 16.3, followTarget = 16.3
  r.isFollowing = () => follow
  r.startFollow = () => {
    const u = r.selectedUnit(); if (!u?.pos) return
    follow = true
    followTarget = Math.max(map.getZoom() + 1.5, 16.3); followZoom = followTarget
    map.scrollZoom.disable()
    map.flyTo({ center: u.pos, zoom: followTarget, pitch: 62, duration: 1100, curve: 1.3 })
  }
  r.stopFollow = () => { if (!follow) return; follow = false; map.scrollZoom.enable() }
  r.overview = () => { r.stopFollow(); map.flyTo({ ...CAMERA, duration: 1200 }) }
  r.flyTo = (lonlat, zoom = 16) => { r.stopFollow(); map.flyTo({ center: lonlat, zoom: Math.max(map.getZoom(), zoom), duration: 900 }) }
  map.getCanvas().addEventListener('wheel', e => {
    if (!follow) return
    e.preventDefault()
    followTarget = Math.max(13, Math.min(18, followTarget - e.deltaY * 0.0035))
  }, { passive: false })

  // Light a place's footprint (contact selected in CONTACTS → its pin).
  let litPlace = null
  r.litPlace = id => {
    if (!r.ready || litPlace === id) return
    if (litPlace) map.setFeatureState({ source: 'footprints', id: litPlace }, { lit: false })
    litPlace = id
    if (litPlace) map.setFeatureState({ source: 'footprints', id: litPlace }, { lit: true })
  }

  // ── Load ──
  map.on('load', () => {
    registerIcons(map)
    addLayers(map, {
      districts: districtsGeoJSON(), districtLabels: districtLabelsGeoJSON(), roadsOverlay: roadsOverlayFC(),
      heat: heatFC(), footprints: footprintsFC(), places: placesFC(),
    })
    r.ready = true
    applyBoundary(map, r.strongBoundaries)
    attachInteraction(r)
    if (selectedId) map.setFeatureState({ source: 'units', id: selectedId }, { selected: true })
    r.refresh()
    requestAnimationFrame(loop)
  })

  // The window manager resizes and maximizes windows; MapLibre's own trackResize misses
  // CSS-driven layout changes, so observe the container explicitly.
  new ResizeObserver(() => map.resize()).observe(mapEl)

  // ── Motion loop: wall clock × time scale; the sim decides arrivals, this only draws ──
  let last = performance.now(), dashT = 0
  function loop(now) {
    const wallDt = Math.min(0.1, (now - last) / 1000); last = now
    const simDt = wallDt * (get.timeScale?.() ?? 20)
    let moved = false
    if (graph.ready && simDt > 0) {
      for (const u of get.units()) {
        if (!u.pos || u.status === 'inside') continue
        if (u.status === 'moving') { if (advance(u, simDt)) moved = true }
        else if (u.status === 'patrol') {
          if (u.activity !== 'engage') { park(u); moved = true }
          else if (advance(u, simDt)) moved = true
        } else if (u.status === 'parked' && u.activity === 'engage' && u.districtId && !u.place) {
          const d = DISTRICTS.find(x => x.id === u.districtId)
          if (d) { startPatrolLeg(u, d); moved = true }
        }
      }
    }
    if (moved) r.pushUnits()
    if (follow) {
      const u = r.selectedUnit()
      if (u?.pos && u.status !== 'inside') {
        followZoom += (followTarget - followZoom) * Math.min(1, wallDt * 8)
        map.jumpTo({ center: u.pos, zoom: followZoom })
      }
    }
    dashT += wallDt
    animateDash(map, dashT)
    requestAnimationFrame(loop)
  }

  return r
}
