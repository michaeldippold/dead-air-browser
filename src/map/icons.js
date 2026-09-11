// Map glyphs, drawn in code and registered with map.addImage. Ported from the spike.
import { MAP_BG } from './style.js'

export const ROLE_COLOR = { police: '#4ea3ff', fire: '#ff5a4e', civilian: '#e8e2c9' }
export const ROLE_ORDER = ['police', 'fire', 'civilian']
export const KIND_COLOR = { residence: '#e8e2c9', hospital: '#e07a9a', police: '#4ea3ff', fire: '#ff5a4e', venue: '#ffd24a', retail: '#e0b25a', park: '#6fcf8a',
                            school: '#b39ddb', campus: '#b39ddb', civic: '#9fb6e0', industrial: '#a0a8b8', landmark: '#e8e2c9' }
export const KIND_LABEL = { residence: 'Residence', hospital: 'Hospital', police: 'Police', fire: 'Fire station', venue: 'Venue', retail: 'Retail', park: 'Park',
                            school: 'School', campus: 'Campus', civic: 'Civic', industrial: 'Industrial', landmark: 'Landmark' }
export const ACCENT = '#ffd24a'

// Marks (todo.md v0.9.0 step 2, design.md "The World" → Situations and marks): a belief, not a
// fact, so the glyph is deliberately plainer than a place diamond. 'horde' is reserved for step 3.
export const MARK_COLOR = { fire: '#ff6a3c', block: '#ffcc33', crowd: '#c9c2a8', horde: '#ff3b3b' }
export const MARK_KIND_LABEL = { fire: 'Fire', block: 'Blocked road', crowd: 'People on foot', horde: 'Sighting' }

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }

export function carIcon(color) {
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
export function placeIcon(color) {
  const s = 36, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.shadowColor = color; g.shadowBlur = 6
  g.fillStyle = color; g.beginPath(); g.moveTo(0, -11); g.lineTo(11, 0); g.lineTo(0, 11); g.lineTo(-11, 0); g.closePath(); g.fill()
  g.shadowBlur = 0
  g.fillStyle = MAP_BG; g.beginPath(); g.moveTo(0, -6); g.lineTo(6, 0); g.lineTo(0, 6); g.lineTo(-6, 0); g.closePath(); g.fill()
  g.fillStyle = color; g.beginPath(); g.arc(0, 0, 2, 0, Math.PI * 2); g.fill()
  return g.getImageData(0, 0, s, s)
}

// Occupancy badge: a role-colored dot with a chunky white digit outlined in black, so it reads
// on any background. One per unit TYPE inside a place, in a row to the right of the diamond.
export function badgeIcon(color, n) {
  const s = 34, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.fillStyle = MAP_BG; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill()
  g.fillStyle = color; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill()
  g.font = 'bold 19px "IBM Plex Mono", "Cascadia Mono", Consolas, monospace'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(String(n), 0, 1)
  g.fillStyle = '#fff'; g.fillText(String(n), 0, 1)
  return g.getImageData(0, 0, s, s)
}

// Caller pin: a small accent ring; `dashed` is the last-known variant.
export function pinIcon(dashed = false) {
  const s = 32, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.strokeStyle = ACCENT; g.lineWidth = 2.5
  if (dashed) g.setLineDash([3, 3])
  g.shadowColor = ACCENT; g.shadowBlur = dashed ? 0 : 8
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke()
  if (!dashed) { g.shadowBlur = 0; g.fillStyle = 'rgba(255,210,74,0.25)'; g.fill() }
  return g.getImageData(0, 0, s, s)
}

// A mark's glyph: one shared silhouette for every kind — a triangle, echoing the same
// outer-shape / dark-cutout / center-dot language placeIcon uses for a diamond, so the map's
// symbol grammar reads as "shape = category, color = kind" throughout (a diamond is a place, a
// circle is an occupancy count, a triangle is a report). Kind is color only (MARK_COLOR) — see the
// legend panel (index.html #map-legend-panel), which is built from these same color constants so
// it can never drift from what's actually drawn.
export function markIcon(kind) {
  const color = MARK_COLOR[kind] ?? '#e8e2c9'
  const s = 32, c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d'); g.translate(s / 2, s / 2)
  g.shadowColor = color; g.shadowBlur = 6
  g.fillStyle = color
  g.beginPath(); g.moveTo(0, -12); g.lineTo(11, 8); g.lineTo(-11, 8); g.closePath(); g.fill()
  g.shadowBlur = 0
  g.fillStyle = MAP_BG
  g.beginPath(); g.moveTo(0, -6); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill()
  g.fillStyle = color; g.beginPath(); g.arc(0, 2.5, 1.8, 0, Math.PI * 2); g.fill()
  return g.getImageData(0, 0, s, s)
}

export function registerIcons(map) {
  for (const [k, c] of Object.entries(ROLE_COLOR)) map.addImage('car-' + k, carIcon(c))
  for (const [k, c] of Object.entries(KIND_COLOR)) map.addImage('place-' + k, placeIcon(c))
  map.addImage('place-other', placeIcon('#e8e2c9'))
  for (const r of ROLE_ORDER) for (let n = 1; n <= 9; n++) map.addImage(`badge-${r}-${n}`, badgeIcon(ROLE_COLOR[r], n))
  map.addImage('pin', pinIcon(false))
  map.addImage('pin-last', pinIcon(true))
  for (const k of Object.keys(MARK_COLOR)) map.addImage('mark-' + k, markIcon(k))
}
