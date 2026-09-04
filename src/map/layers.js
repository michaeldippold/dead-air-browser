// Sources and layers, in the order map-integration.md §2.1 fixes (bottom → top):
// district-fill → roads-dim → footprint-fill → [basemap buildings] → district-shroud → heat →
// district-glow → district-line → district-label → poi-hit → footprint-line → place-ring →
// places → place-badge-0/1/2 → route-glow → route-line → unit-halo → units.
// Numbers are the verified ones from §2.2 — change deliberately.
import { MAP_BG } from './style.js'

export const emptyFC = () => ({ type: 'FeatureCollection', features: [] })

export function addLayers(map, initial) {
  map.addSource('districts', { type: 'geojson', data: initial.districts, promoteId: 'id' })
  map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': ['+', 0.2, ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]],
  } }, 'buildings')

  map.addSource('roads-overlay', { type: 'geojson', data: initial.roadsOverlay })
  map.addLayer({ id: 'roads-dim', type: 'line', source: 'roads-overlay', layout: { visibility: 'none' }, paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'd'], 0, MAP_BG, 0.5, '#3a0d18', 1, '#1a0408'],
    'line-opacity': ['*', 0.7, ['get', 'd']],
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1.5, 16, 7],
  } }, 'buildings')

  map.addSource('footprints', { type: 'geojson', data: initial.footprints, promoteId: 'id' })
  map.addLayer({ id: 'footprint-fill', type: 'fill', source: 'footprints', minzoom: 13.5, paint: {
    'fill-color': ['get', 'color'],
    'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, ['boolean', ['feature-state', 'lit'], false], 0.3, 0.12],
  } }, 'buildings')

  // Cold shroud sits ABOVE the buildings: in the pitched view the extrusions poke up through it,
  // so rooftops stay lit while the streets sink into black. Only cold districts get it.
  map.addLayer({ id: 'district-shroud', type: 'fill', source: 'districts', filter: ['boolean', ['get', 'cold'], false], paint: {
    'fill-color': '#03050a', 'fill-opacity': 0.7,
  } })

  // "Streets" danger look: heat blooming along the district's own roads, weighted by the one
  // district number, pooling at big intersections.
  map.addSource('heat', { type: 'geojson', data: initial.heat })
  map.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', paint: {
    'heatmap-weight': ['get', 'w'],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 9, 14, 18, 16, 40],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.16, 14, 0.26, 16, 0.45],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(0,0,0,0)', 0.15, 'rgba(70,4,18,0.4)', 0.45, 'rgba(150,12,30,0.6)', 0.75, 'rgba(215,40,40,0.78)', 1, 'rgba(255,90,60,0.9)'],
    'heatmap-opacity': 0.85,
  } })

  map.addLayer({ id: 'district-glow', type: 'line', source: 'districts', paint: {
    'line-color': ['get', 'color'], 'line-width': 9, 'line-opacity': 0.3, 'line-blur': 4 } })
  map.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: {
    'line-color': ['interpolate', ['linear'], ['get', 'danger'], 0, ['get', 'color'], 1, '#ff3b3b'],
    'line-width': ['+', ['case', ['boolean', ['feature-state', 'hover'], false], 3.5, 3.2], ['get', 'danger']],
    'line-opacity': 0.95,
  } })

  // Own point source, one centroid per district — a polygon source repeats labels per tile.
  map.addSource('district-labels', { type: 'geojson', data: initial.districtLabels })
  map.addLayer({ id: 'district-label', type: 'symbol', source: 'district-labels', layout: {
    'text-field': ['upcase', ['get', 'label']], 'text-font': ['Noto Sans Medium'], 'text-letter-spacing': 0.15, 'text-allow-overlap': true,
    'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 13, 14, 16, 18],
  }, paint: { 'text-color': ['case', ['boolean', ['get', 'cold'], false], '#4a5570', ['get', 'color']], 'text-halo-color': MAP_BG, 'text-halo-width': 1.5, 'text-opacity': 0.85 } })

  // Free tier: any named place from the tiles gets a hover name and a card, but is not a
  // dispatch target. Invisible hit circles.
  map.addLayer({ id: 'poi-hit', type: 'circle', source: 'protomaps', 'source-layer': 'pois', minzoom: 13,
    filter: ['has', 'name'], paint: { 'circle-radius': 9, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } })

  map.addLayer({ id: 'footprint-line', type: 'line', source: 'footprints', minzoom: 13.5, paint: {
    'line-color': ['get', 'color'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, ['case', ['boolean', ['feature-state', 'lit'], false], 2.5, 0.6], 16, ['case', ['boolean', ['feature-state', 'lit'], false], 3, 2]],
    'line-opacity': 0.9 } })

  // Authored tier: always drawn, always clickable, dispatch targets. Gold ring = named callers here.
  map.addSource('places', { type: 'geojson', data: initial.places, promoteId: 'id' })
  map.addLayer({ id: 'place-ring', type: 'circle', source: 'places', filter: ['>', ['get', 'contacts'], 0], paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 18], 'circle-color': '#ffd24a', 'circle-opacity': 0.12,
    'circle-stroke-color': '#ffd24a', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.9 } })
  map.addLayer({ id: 'places', type: 'symbol', source: 'places', layout: {
    'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 1.35],
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12.5, 'text-offset': [0, 1.25], 'text-anchor': 'top', 'text-optional': true,
    'text-max-width': 11,
  }, paint: {
    'text-color': ['get', 'color'],
    'text-halo-color': MAP_BG, 'text-halo-width': 1.2,
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.6, 0, 13.2, 0.95],
    'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.9],
  } })
  // Occupancy badges: one per unit TYPE inside, in a row flowing right from the diamond.
  ;[0, 1, 2].forEach(slot => map.addLayer({ id: 'place-badge-' + slot, type: 'symbol', source: 'places', filter: ['has', 'badge' + slot], layout: {
    'icon-image': ['get', 'badge' + slot], 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 1.35],
    'icon-offset': [34 + slot * 30, 0], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
  } }))

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
  }, paint: { 'text-color': '#cfe0ff', 'text-halo-color': MAP_BG, 'text-halo-width': 1.2 } })
}

// Strong (default) vs subtle district boundaries — a map setting, §1 #16.
export function applyBoundary(map, strong) {
  map.setPaintProperty('district-fill', 'fill-opacity', ['+', strong ? 0.2 : 0.09, ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]])
  map.setPaintProperty('district-glow', 'line-opacity', strong ? 0.3 : 0.14)
  map.setPaintProperty('district-line', 'line-width', ['+', ['case', ['boolean', ['feature-state', 'hover'], false], 3.5, strong ? 3.2 : 2.2], ['get', 'danger']])
}

// Route dash animation frame (called from the render loop).
const DASHES = [[2, 2], [1.5, 2, 0.5, 0], [1, 2, 1, 0], [0.5, 2, 1.5, 0]]
export function animateDash(map, t) {
  if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-dasharray', DASHES[Math.floor(t * 6) % 4])
}
