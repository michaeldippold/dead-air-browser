// Map interaction (map-integration.md §1 #6): left-click = select / dispatch-with-default,
// right-click = context menu with the explicit verb, middle-drag = rotate + pitch, left-drag = pan,
// Esc = close menu then deselect, bare map deselects. hit() priority: units → badges → places →
// footprint → free POI → district. The tooltip and context menu are DOM inside the map stage.
import { DISTRICTS, districtAt } from './districts.js'
import { previewSeconds, remainingSeconds } from './mover.js'
import { KIND_LABEL } from './icons.js'

export const fmt = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const districtOf = id => DISTRICTS.find(d => d.id === id)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// r: the renderer (see index.js) — map, stage, tip, ctx, get/on hooks, selection + follow API.
export function attachInteraction(r) {
  const { map, stage, tipEl, ctxEl, get, on } = r
  let hoverUnit = null, hoverDistrict = null, hoverPlace = null, ctxOpen = false

  // Right-click belongs to the game. Rotate/pitch moves to middle-mouse drag.
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

  function showTip(html, pt) {
    tipEl.innerHTML = html; tipEl.hidden = false
    const w = stage.clientWidth, h = stage.clientHeight
    tipEl.style.left = Math.min(pt.x + 12, Math.max(0, w - tipEl.offsetWidth - 4)) + 'px'
    tipEl.style.top = Math.min(pt.y + 12, Math.max(0, h - tipEl.offsetHeight - 4)) + 'px'
  }
  function hideTip() { tipEl.hidden = true }

  function hit(point) {
    if (!map.getLayer('units')) return {}
    const feats = map.queryRenderedFeatures(point, { layers: ['units', 'place-badge-0', 'place-badge-1', 'place-badge-2', 'places', 'footprint-fill', 'poi-hit', 'district-fill'] })
    const f = id => feats.find(x => x.layer.id === id)
    const unitF = f('units'), placeF = f('place-badge-0') ?? f('place-badge-1') ?? f('place-badge-2') ?? f('places') ?? f('footprint-fill'), poiF = f('poi-hit'), distF = f('district-fill')
    return {
      unit: unitF && get.units().find(u => u.id === unitF.properties.id),
      place: placeF && get.places().find(p => p.id === placeF.properties.id),
      poi: poiF, district: distF && districtOf(distF.properties.id),
    }
  }

  function setFS(source, cur, next, key) {
    if (cur === next) return next
    if (cur) map.setFeatureState({ source, id: cur.id }, { [key]: false })
    if (next) map.setFeatureState({ source, id: next.id }, { [key]: true })
    return next
  }
  function setHoverDistrict(d) { hoverDistrict = setFS('districts', hoverDistrict, d, 'hover') }
  function setHoverPlace(p) {
    if (hoverPlace !== p) {
      if (hoverPlace?.footprint) map.setFeatureState({ source: 'footprints', id: hoverPlace.id }, { hover: false })
      if (p?.footprint) map.setFeatureState({ source: 'footprints', id: p.id }, { hover: true })
    }
    hoverPlace = setFS('places', hoverPlace, p, 'hover')
  }
  function setHoverUnit(u, fromMap = true) {
    const prev = hoverUnit
    hoverUnit = setFS('units', hoverUnit, u, 'hover')
    if (fromMap && prev !== u) on.hoverUnit?.(u?.id ?? null)
  }
  r.hoverUnitById = id => setHoverUnit(id ? get.units().find(u => u.id === id) ?? null : null, false)

  map.on('mousemove', e => {
    if (ctxOpen) return
    const h = hit(e.point)
    setHoverUnit(h.unit ?? null); setHoverDistrict(h.district ?? null); setHoverPlace(h.place ?? null)
    const sel = r.selectedUnit()
    map.getCanvas().style.cursor = h.unit || h.place || h.poi ? 'pointer' : h.district && sel ? 'crosshair' : ''
    if (h.unit) { showTip(`<b>${esc(get.unitName(h.unit))}</b> <span class="dim">${esc(get.unitStatus(h.unit))}</span>`, e.point); return }
    if (h.place) {
      const p = h.place
      const n = get.units().filter(u => u.status === 'inside' && u.place === p.id).length
      const c = get.placeContacts(p.id).length
      showTip(`<b>${esc(p.name)}</b> <span class="dim">${KIND_LABEL[p.kind] ?? p.kind} · dispatch location${n ? ` · ${n} unit${n > 1 ? 's' : ''} inside` : ''}${c ? ` · ${c} caller${c > 1 ? 's' : ''}` : ''}</span>`, e.point)
      return
    }
    if (h.poi) { const p = h.poi.properties; showTip(`<b>${esc(p.name)}</b> <span class="dim">${esc(p.kind ?? '')}</span>`, e.point); return }
    if (h.district) {
      const d = h.district
      if (sel) {
        const pv = previewSeconds(sel, { district: d })
        showTip(`<b>${esc(d.label)}</b> · ${esc(get.unitName(sel))} ETA ${pv ? fmt(pv.seconds) : '—'}${pv ? ' · ' + (pv.metres / 1000).toFixed(1) + ' km' : ''}`, e.point)
      } else showTip(`<b>${esc(d.label)}</b> <span class="dim">${esc(get.districtStatus?.(d.id) ?? d.category)}</span>`, e.point)
      return
    }
    hideTip()
  })
  map.on('mouseout', () => { hideTip(); setHoverUnit(null); setHoverDistrict(null); setHoverPlace(null) })

  // Left click: select a unit; with a unit selected, a district or a place dispatches it.
  // Bare map deselects. Nothing else is a target (§1 #5).
  map.on('click', e => {
    closeCtx()
    const h = hit(e.point)
    const sel = r.selectedUnit()
    if (h.unit) { on.selectUnit(h.unit === sel ? null : h.unit.id); return }
    if (h.place) { on.showPlace(h.place.id); if (sel) on.dispatch(sel.id, { placeId: h.place.id }); return }
    if (h.poi) { on.showPoi({ name: h.poi.properties.name, kind: h.poi.properties.kind, lonlat: h.poi.geometry.coordinates }); return }
    if (h.district && sel) { on.dispatch(sel.id, { districtId: h.district.id, activity: 'engage' }); return }
    if (h.district) { on.selectDistrict?.(h.district.id); return }
    if (sel) on.selectUnit(null)
  })

  // Right click: a context menu for whatever is under the cursor, with the explicit verb.
  function closeCtx() { ctxEl.hidden = true; ctxOpen = false }
  function openCtx(items, point, title) {
    ctxEl.innerHTML = (title ? `<div class="ctx-title">${esc(title)}</div>` : '') + items.map((it, i) =>
      `<div class="ctx-item${it.disabled ? ' disabled' : ''}" data-i="${i}">${esc(it.label)}</div>`).join('')
    ctxEl.querySelectorAll('.ctx-item').forEach(el => el.onclick = () => { const it = items[+el.dataset.i]; if (!it.disabled) { it.run(); closeCtx() } })
    ctxEl.hidden = false; ctxOpen = true; hideTip()
    const w = stage.clientWidth, h = stage.clientHeight
    ctxEl.style.left = Math.max(0, Math.min(point.x, w - ctxEl.offsetWidth - 4)) + 'px'
    ctxEl.style.top = Math.max(0, Math.min(point.y, h - ctxEl.offsetHeight - 4)) + 'px'
  }
  r.closeCtx = closeCtx
  map.on('contextmenu', e => {
    e.preventDefault?.(); e.originalEvent?.preventDefault?.()
    const h = hit(e.point)
    const sel = r.selectedUnit()
    const who = sel ? get.unitName(sel) : 'unit'
    const need = sel ? '' : ' (select a unit first)'
    if (h.unit) {
      const u = h.unit
      const home = get.places().find(p => p.id === u.home)
      return openCtx([
        { label: u === sel ? 'Deselect' : 'Select', run: () => on.selectUnit(u === sel ? null : u.id) },
        { label: r.isFollowing() && u === sel ? 'Stop following' : 'Follow', run: () => { if (r.isFollowing() && u === sel) r.stopFollow(); else { on.selectUnit(u.id); r.startFollow() } } },
        { label: home ? `Return to ${home.name}` : 'Return to station', disabled: !home || u.place === u.home, run: () => on.dispatch(u.id, { placeId: u.home }) },
      ], e.point, `${get.unitName(u)} · ${get.unitStatus(u)}`)
    }
    if (h.place) {
      const p = h.place
      return openCtx([
        { label: `Dispatch ${who} here${need}`, disabled: !sel, run: () => on.dispatch(sel.id, { placeId: p.id }) },
        { label: 'Show place', run: () => on.showPlace(p.id) },
      ], e.point, p.name)
    }
    if (h.district) {
      const d = h.district
      return openCtx([
        { label: `ENGAGE — ${who} patrols ${d.label}${need}`, disabled: !sel, run: () => on.dispatch(sel.id, { districtId: d.id, activity: 'engage' }) },
        { label: `HIDE — ${who} holds at the edge${need}`, disabled: !sel, run: () => on.dispatch(sel.id, { districtId: d.id, activity: 'hide' }) },
        { label: `SCAVENGE — ${who} searches ${d.label}${need}`, disabled: !sel, run: () => on.dispatch(sel.id, { districtId: d.id, activity: 'scavenge' }) },
        { label: 'District info', run: () => on.selectDistrict?.(d.id) },
      ], e.point, d.label)
    }
    openCtx([
      { label: 'Deselect', disabled: !sel, run: () => on.selectUnit(null) },
      { label: 'Overview', run: () => r.overview() },
    ], e.point, 'Outside coverage')
  })
  window.addEventListener('mousedown', e => { if (ctxOpen && !ctxEl.contains(e.target)) closeCtx() })

  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)) return
    if (ctxOpen) { closeCtx(); return }
    if (r.selectedUnit()) on.selectUnit(null)
  })
  map.on('dragstart', () => r.stopFollow())

  return { hit, hideTip, closeCtx, remainingSeconds, districtAt }
}
