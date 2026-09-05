// Basemap style: a cut-down Protomaps dark flavor. Ported verbatim from the spike
// (map-integration.md §2). Buildings are extrusions so the pitched view has rooftops.
import { layers, namedFlavor } from '@protomaps/basemaps'

export const MAP_BG = '#06101f'

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

export function buildStyle(tilesUrl) {
  const base = layers('protomaps', flavor, { lang: 'en' }).filter(l => !DROP.test(l.id))
  for (const l of base) {
    if (l.id === 'roads_labels_minor') l.minzoom = 15.5
    if (l.id === 'roads_labels_major') l.minzoom = 14
    if (l.id === 'places_subplace') { l.minzoom = 13; l.paint = { ...(l.paint || {}), 'text-opacity': 0.55 } }
    if (l.id === 'buildings') {
      l.type = 'fill-extrusion'; l.minzoom = 13.5
      l.paint = {
        // lit = a disclosed caller's house; house = the residence pool (HOUSES test view)
        'fill-extrusion-color': ['case',
          ['boolean', ['feature-state', 'lit'], false], '#ffd24a',
          ['boolean', ['feature-state', 'house'], false], '#4a86d8',
          '#152c50'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 7],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 0.9],
        'fill-extrusion-vertical-gradient': true,
      }
      delete l.layout
    }
  }
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: { protomaps: { type: 'vector', url: 'pmtiles://' + tilesUrl, attribution: '© OpenStreetMap contributors' } },
    layers: base,
  }
}
