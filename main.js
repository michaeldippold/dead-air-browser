const TICK_MS       = 3500
const SPREAD_RATE   = 0.12
const SPREAD_CHANCE = 0.35
const UNIT_TYPES    = ['police', 'fire', 'civilian']

const ITEMS = {
  'gun':       { name: 'Gun',           description: 'Attack hit chance: 70%. Ranged — unit engages before contact, reducing counterattack exposure. Standard issue for Police.' },
  'fire-axe':  { name: 'Fire Axe',      description: 'Attack hit chance: 65%. Close-quarters weapon, effective in confined spaces. Standard issue for Fire units.' },
  'first-aid': { name: 'First Aid Kit', description: 'Civilian automatically heals the most critically wounded unit in the district when any unit drops to 50 HP or below. Restores 20 HP. Single use — consumed on use.' },
  'radio':     { name: 'Radio',         description: 'While a Civilian carrying a Radio is present in a district, live human and infected counts are visible in the info panel. Intel is lost if the Civilian dies or redeploys.' },
}

let _uid = 0
const uid         = ()            => `u${++_uid}`
const makeUnit    = (type, items) => ({ id: uid(), type, health: 100, items })
const makeContact = (name)        => ({ id: uid(), name, messages: [], unread: false })

const CALLER_POOL = [
  'Unknown Caller',
  'Marcus Webb',
  'Unknown Caller',
  'Sandra Hill',
  'Officer Torres',
  'Unknown Caller',
  'David Park',
  'J. Reyes',
  'Unknown Caller',
  'Ana Voss',
]
let _callerIdx = 0

const CALL_TEMPLATES = [
  d => `${d.label} is in trouble! There's ${d.zombies} infected here.`,
  d => `This is ${d.label} — we're seeing ${d.zombies} zombies. Send help.`,
  d => `${d.label} reporting. ${d.zombies} infected and it's getting worse.`,
  d => `Hello? Anyone there? ${d.label} has ${d.zombies} zombies. We need units!`,
  d => `I'm calling from ${d.label}. ${d.zombies} infected spotted. Please respond.`,
]

// Hit chance based on what the unit is carrying
function makeHpBar(health) {
  const filled = Math.round(health / 10)
  const color  = health > 70 ? '#4a9a6a' : health > 40 ? '#c8a030' : '#c84040'
  return `<div class="hp-bar">${
    Array.from({ length: 10 }, (_, i) =>
      `<div class="hp-seg" style="${i < filled ? `background:${color}` : ''}"></div>`
    ).join('')
  }</div>`
}

function getHitChance(unit) {
  if (unit.items.includes('gun'))      return 0.70
  if (unit.items.includes('fire-axe')) return 0.65
  return 0.50
}

const THREAT_MOD = { police: 3, fire: 2, civilian: 1 }

function pickCounterTarget(units) {
  const total = units.reduce((sum, u) => sum + THREAT_MOD[u.type], 0)
  let r = Math.random() * total
  for (const u of units) {
    r -= THREAT_MOD[u.type]
    if (r <= 0) return u
  }
  return units[units.length - 1]
}

// Local growth rate reduced by units present (each unit -12%, cap 80%)
function districtHasRadio(districtId) {
  const d = state.districts[districtId]
  return d?.units.some(u => u.type === 'civilian' && u.items.includes('radio'))
}

function getEffectiveSpreadRate(d) {
  const suppression = Math.min(0.80, d.units.length * 0.12)
  return SPREAD_RATE * (1 - suppression)
}

const state = {
  tick: 0,
  startTime:       null,
  won:             false,
  godMode:         JSON.parse(localStorage.getItem('godMode') ?? 'false'),
  selected:        null,
  selectedUnit:    null,
  selectedContact: null,
  contacts:        [ makeContact('City Hall') ],
  districts: {
    'northgate':    { label: 'Northgate',      category: 'residential', humans: 1000, zombies: 0, units: [] },
    'millbrook':    { label: 'Millbrook',       category: 'residential', humans: 1000, zombies: 0, units: [] },
    'eastridge':    { label: 'Eastridge',       category: 'residential', humans: 1200, zombies: 0, units: [] },
    'westgate':     { label: 'Westgate',        category: 'residential', humans: 900,  zombies: 0, units: [] },
    'police-hq':    { label: 'Police HQ',       category: 'government',  humans: 80,   zombies: 0, units: [
      makeUnit('police', ['gun']),
      makeUnit('police', ['gun']),
      makeUnit('police', ['gun']),
    ]},
    'fire-station': { label: 'Fire Station',    category: 'government',  humans: 60,   zombies: 0, units: [
      makeUnit('fire', ['fire-axe']),
      makeUnit('fire', ['fire-axe']),
      makeUnit('fire', ['fire-axe']),
    ]},
    'city-hall':    { label: 'City Hall',       category: 'government',  humans: 200,  zombies: 0, units: [
      makeUnit('civilian', ['first-aid', 'radio']),
      makeUnit('civilian', ['first-aid', 'radio']),
      makeUnit('civilian', ['first-aid']),
    ]},
    'memorial':     { label: 'Memorial',        category: 'medical',     humans: 600,  zombies: 0, units: [] },
    'ironworks':    { label: 'Ironworks',       category: 'industrial',  humans: 380,  zombies: 0, units: [] },
    'riverside':    { label: 'Riverside',       category: 'residential', humans: 1100, zombies: 0, units: [] },
    'market':       { label: 'Market District', category: 'retail',      humans: 700,  zombies: 0, units: [] },
    'commerce':     { label: 'Commerce Park',   category: 'retail',      humans: 650,  zombies: 0, units: [] },
    'southend':     { label: 'Southend',        category: 'residential', humans: 950,  zombies: 0, units: [] },
    'industrial':   { label: 'Industrial Row',  category: 'industrial',  humans: 400,  zombies: 0, units: [] },
  }
}

const adjacency = {
  'northgate':    ['millbrook', 'westgate', 'police-hq'],
  'millbrook':    ['northgate', 'eastridge', 'police-hq', 'fire-station', 'memorial'],
  'eastridge':    ['millbrook', 'memorial', 'ironworks'],
  'westgate':     ['northgate', 'police-hq', 'city-hall', 'riverside'],
  'police-hq':    ['northgate', 'millbrook', 'westgate', 'fire-station', 'city-hall'],
  'fire-station': ['millbrook', 'police-hq', 'city-hall', 'memorial'],
  'city-hall':    ['westgate', 'police-hq', 'fire-station', 'memorial', 'market'],
  'memorial':     ['millbrook', 'eastridge', 'fire-station', 'city-hall', 'ironworks', 'commerce'],
  'ironworks':    ['eastridge', 'memorial', 'commerce'],
  'riverside':    ['westgate', 'market', 'southend'],
  'market':       ['city-hall', 'riverside', 'commerce', 'southend'],
  'commerce':     ['memorial', 'ironworks', 'market', 'southend', 'industrial'],
  'southend':     ['riverside', 'market', 'commerce', 'industrial'],
  'industrial':   ['commerce', 'southend'],
}

state.districts['millbrook'].zombies = 15

// Pre-build clip-paths so selected stroke renders inside polygon only
function initClipPaths() {
  const svg  = document.getElementById('city-map')
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  document.querySelectorAll('#districts polygon').forEach(poly => {
    const cp    = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
    cp.id       = `clip-${poly.id}`
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    shape.setAttribute('points', poly.getAttribute('points'))
    cp.appendChild(shape)
    defs.appendChild(cp)
  })
  svg.prepend(defs)
}
initClipPaths()

// DOM refs
const godBtn      = document.getElementById('btn-god-mode')
const tickDisplay = document.getElementById('tick-display')
const timeDisplay = document.getElementById('time-display')
const infoName    = document.getElementById('info-name')
const infoCat     = document.getElementById('info-cat')
const infoPop     = document.getElementById('info-pop')
const leftPanel   = document.getElementById('left-panel')
const unitsList   = document.getElementById('units-list')
const udvType     = document.getElementById('udv-type')
const udvLocation = document.getElementById('udv-location')
const udvHealth   = document.getElementById('udv-health')
const udvItems    = document.getElementById('udv-items')
const udvTarget   = document.getElementById('udv-target')
const btnUdvSend  = document.getElementById('btn-udv-send')
const btnUdvBack  = document.getElementById('btn-udv-back')
const cdvName     = document.getElementById('cdv-name')
const cdvMessages = document.getElementById('cdv-messages')
const btnCdvBack  = document.getElementById('btn-cdv-back')
const idvName     = document.getElementById('idv-name')
const idvDesc     = document.getElementById('idv-description')
const btnIdvBack  = document.getElementById('btn-idv-back')

// God mode
if (state.godMode) document.body.classList.add('god-mode')
syncGodBtn()

godBtn.addEventListener('click', () => {
  state.godMode = !state.godMode
  localStorage.setItem('godMode', JSON.stringify(state.godMode))
  document.body.classList.toggle('god-mode', state.godMode)
  syncGodBtn()
})

function syncGodBtn() {
  godBtn.textContent = `GOD MODE: ${state.godMode ? 'ON' : 'OFF'}`
}

// Map — click to select, hover handled by CSS
document.querySelectorAll('#districts polygon').forEach(poly => {
  poly.addEventListener('click', () => selectDistrict(poly.id))
})

function selectDistrict(id) {
  if (state.selected) {
    const prev = document.getElementById(state.selected)
    if (prev) {
      prev.classList.remove('selected')
      prev.removeAttribute('clip-path')
    }
  }

  if (state.selected === id) {
    state.selected       = null
    infoName.textContent = '—'
    infoCat.textContent  = 'Click a district'
    infoPop.innerHTML    = ''
    return
  }

  state.selected = id
  const poly = document.getElementById(id)
  if (poly) {
    poly.setAttribute('clip-path', `url(#clip-${id})`)
    poly.classList.add('selected')
  }
  updateRightPanel()
}

function updateRightPanel() {
  if (!state.selected) return
  const d = state.districts[state.selected]
  if (!d) return
  infoName.textContent = d.label
  infoCat.textContent  = d.category

  if (state.godMode || districtHasRadio(state.selected)) {
    const badge = !state.godMode ? '<div class="radio-intel-badge">RADIO INTEL</div>' : ''
    infoPop.innerHTML = `${badge}Humans:&nbsp; ${d.humans.toLocaleString()}<br>Infected: ${d.zombies.toLocaleString()}`
  } else {
    infoPop.innerHTML = '<span class="no-intel">No intel</span>'
  }
}

// Unit cards — event delegation
unitsList.addEventListener('click', e => {
  const card = e.target.closest('.unit-card')
  if (!card) return
  showUnitDetail(card.dataset.unitId)
})

function showUnitDetail(unitId) {
  let unit = null
  let districtId = null

  for (const [id, d] of Object.entries(state.districts)) {
    const found = d.units.find(u => u.id === unitId)
    if (found) { unit = found; districtId = id; break }
  }

  if (!unit) return

  state.selectedUnit = { unitId, districtId }
  renderUnitDetail(unit, districtId)
  leftPanel.classList.add('unit-detail-mode')
}

function renderUnitDetail(unit, districtId) {
  const d = state.districts[districtId]
  udvType.textContent     = unit.type.toUpperCase() + ' SQUAD'
  udvLocation.textContent = d.label
  udvHealth.innerHTML = makeHpBar(unit.health)

  udvItems.innerHTML = unit.items.length === 0
    ? '<div class="udv-no-items">No items</div>'
    : unit.items.map(key => {
        const item = ITEMS[key]
        if (!item) return ''
        return `<div class="item-chip item-chip--${key}" data-item-key="${key}">${item.name}</div>`
      }).join('')

  udvTarget.innerHTML = '<option value="">— select destination —</option>' +
    Object.entries(state.districts)
      .filter(([nid]) => nid !== districtId)
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([nid, nd]) => `<option value="${nid}">${nd.label}</option>`)
      .join('')
}

function hideUnitDetail() {
  state.selectedUnit = null
  leftPanel.classList.remove('unit-detail-mode')
}

function showContactDetail(contactId) {
  const contact = state.contacts.find(c => c.id === contactId)
  if (!contact) return
  state.selectedContact = contactId
  contact.unread = false
  cdvName.textContent = contact.name
  renderContactMessages(contact)
  leftPanel.classList.remove('unit-detail-mode')
  leftPanel.classList.add('contact-detail-mode')
}

function hideContactDetail() {
  state.selectedContact = null
  leftPanel.classList.remove('contact-detail-mode')
}

function showItemDescription(key) {
  const item = ITEMS[key]
  if (!item) return
  idvName.textContent = item.name
  idvDesc.textContent = item.description
  leftPanel.classList.remove('unit-detail-mode')
  leftPanel.classList.add('item-description-mode')
}

function hideItemDescription() {
  leftPanel.classList.remove('item-description-mode')
  leftPanel.classList.add('unit-detail-mode')
}

function renderContactMessages(contact) {
  cdvMessages.innerHTML = contact.messages.length === 0
    ? '<div class="no-messages">No messages yet.</div>'
    : contact.messages.map(m =>
        `<div class="chat-bubble">
          <div class="chat-text">${m.text}</div>
          <div class="chat-time">sent at ${m.time}</div>
        </div>`
      ).join('')
}

function checkCallEvent() {
  if (Math.random() > 0.10) return
  const infected = Object.entries(state.districts).filter(([, d]) => d.zombies > 0)
  if (!infected.length) return

  const [, dist] = infected[Math.floor(Math.random() * infected.length)]

  let contact
  const useExisting = state.contacts.length > 0 && (Math.random() < 0.5 || _callerIdx >= CALLER_POOL.length)
  if (useExisting) {
    contact = state.contacts[Math.floor(Math.random() * state.contacts.length)]
  } else {
    contact = makeContact(CALLER_POOL[_callerIdx++])
    state.contacts.push(contact)
  }

  const elapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0
  const timeStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const text = CALL_TEMPLATES[Math.floor(Math.random() * CALL_TEMPLATES.length)](dist)

  contact.messages.push({ text, time: timeStr })
  contact.unread = true
}

function renderContactsPanel() {
  const list = document.getElementById('contacts-list')
  if (!list) return
  list.innerHTML = state.contacts.length === 0
    ? '<div class="no-contacts">No contacts yet.</div>'
    : state.contacts.map(c =>
        `<div class="contact-card${c.unread ? ' has-unread' : ''}" data-contact-id="${c.id}">
          <span>${c.name}</span>
          ${c.unread ? '<span class="unread-dot"></span>' : ''}
        </div>`
      ).join('')
}

btnUdvBack.addEventListener('click', hideUnitDetail)
btnCdvBack.addEventListener('click', hideContactDetail)
btnIdvBack.addEventListener('click', hideItemDescription)

udvItems.addEventListener('click', e => {
  const chip = e.target.closest('.item-chip')
  if (!chip) return
  showItemDescription(chip.dataset.itemKey)
})

document.getElementById('contacts-list').addEventListener('click', e => {
  const card = e.target.closest('.contact-card')
  if (!card) return
  showContactDetail(card.dataset.contactId)
})

btnUdvSend.addEventListener('click', () => {
  if (!state.selectedUnit) return
  const { unitId, districtId } = state.selectedUnit
  const destId = udvTarget.value
  if (!destId) return

  const src  = state.districts[districtId]
  const dest = state.districts[destId]
  const idx  = src.units.findIndex(u => u.id === unitId)
  if (idx === -1) return

  const [unit] = src.units.splice(idx, 1)
  dest.units.push(unit)

  hideUnitDetail()
  renderUnitsPanel()
})

function renderUnitsPanel() {
  const active = Object.entries(state.districts)
    .filter(([, d]) => d.units.length > 0)

  if (active.length === 0) {
    unitsList.innerHTML = '<div class="no-units">No units deployed</div>'
    return
  }

  unitsList.innerHTML = active.map(([id, d]) => {
    const cards = d.units.map(u => {
      const hpClass = u.health <= 49 ? ' unit-critical'
                    : u.health <= 79 ? ' unit-hurt'
                    : ''
      return `<div class="unit-card${hpClass}" data-unit-id="${u.id}" data-type="${u.type}" title="${u.type} · HP ${u.health}"></div>`
    }).join('')

    return `<div class="unit-district-group">
      <div class="unit-district-name">${d.label}</div>
      <div class="unit-cards">${cards}</div>
    </div>`
  }).join('')
}

function checkWin() {
  if (state.won) return
  const totalZombies = Object.values(state.districts).reduce((sum, d) => sum + d.zombies, 0)
  if (totalZombies > 0) return

  state.won = true
  clearInterval(tickInterval)

  const elapsed  = Math.floor((Date.now() - state.startTime) / 1000)
  const mins     = Math.floor(elapsed / 60)
  const secs     = elapsed % 60
  const timeStr  = `${mins}:${String(secs).padStart(2, '0')}`

  document.getElementById('win-ticks').textContent = `${state.tick} TICKS`
  document.getElementById('win-time').textContent  = timeStr
  document.getElementById('win-overlay').classList.add('visible')
}

function tick() {
  if (!state.startTime) state.startTime = Date.now()
  state.tick++
  tickDisplay.textContent = `TICK ${String(state.tick).padStart(3, '0')}`
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  timeDisplay.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  // ── Spread: local growth using suppressed rate ──
  for (const d of Object.values(state.districts)) {
    if (d.zombies === 0 || d.humans === 0) continue
    const rate = getEffectiveSpreadRate(d)
    const n = Math.floor(d.zombies * rate)
    if (n > 0) {
      d.zombies += n
      d.humans   = Math.max(0, d.humans - n)
    }
  }

  // ── Inter-district spread: units in source district can block ──
  if (Math.random() < SPREAD_CHANCE) {
    const sources = Object.keys(state.districts).filter(id => state.districts[id].zombies > 0)
    if (sources.length) {
      const src  = sources[Math.floor(Math.random() * sources.length)]
      const srcD = state.districts[src]
      const blockChance = Math.min(0.70, srcD.units.length * 0.15)
      if (Math.random() >= blockChance) {
        const neighbors = adjacency[src].filter(id => state.districts[id].humans > 0)
        if (neighbors.length) {
          state.districts[neighbors[Math.floor(Math.random() * neighbors.length)]].zombies += 1
        }
      }
    }
  }

  // ── Combat: units fight zombies in occupied infected districts ──
  for (const d of Object.values(state.districts)) {
    if (d.zombies === 0 || d.units.length === 0) continue

    // Units attack — each gets one roll
    for (const unit of d.units) {
      if (d.zombies <= 0) break
      if (Math.random() < getHitChance(unit)) {
        d.zombies = Math.max(0, d.zombies - 1)
      }
    }

    // Zombies counterattack — weighted targeting by threat modifier
    const dangerRatio   = d.zombies / (d.humans + d.zombies)
    const counterChance = dangerRatio * 0.40
    const numStrikes    = d.units.length

    for (let i = 0; i < numStrikes; i++) {
      if (d.units.length === 0) break
      if (Math.random() < counterChance) {
        const target = pickCounterTarget(d.units)
        target.health -= 10
        if (target.health <= 0) {
          const idx = d.units.indexOf(target)
          if (idx !== -1) d.units.splice(idx, 1)
        }
      }
    }

    // Medic phase — civies with first-aid heal the most critical units
    const medics  = d.units.filter(u => u.type === 'civilian' && u.items.includes('first-aid'))
    const wounded = d.units.filter(u => u.health <= 50).sort((a, b) => a.health - b.health)
    for (const medic of medics) {
      if (wounded.length === 0) break
      const patient = wounded.shift()
      patient.health = Math.min(100, patient.health + 20)
      medic.items.splice(medic.items.indexOf('first-aid'), 1)
    }
  }

  checkCallEvent()
  render()
  checkWin()
}

function render() {
  updateRightPanel()
  if (leftPanel.classList.contains('unit-detail-mode')) {
    if (state.selectedUnit) {
      const { unitId, districtId } = state.selectedUnit
      const d = state.districts[districtId]
      const unit = d?.units.find(u => u.id === unitId)
      if (!unit) {
        hideUnitDetail()
      } else {
        renderUnitDetail(unit, districtId)
      }
    }
  } else if (leftPanel.classList.contains('contact-detail-mode')) {
    if (state.selectedContact) {
      const contact = state.contacts.find(c => c.id === state.selectedContact)
      if (contact) renderContactMessages(contact)
    }
  } else {
    renderUnitsPanel()
  }
  renderContactsPanel()
  renderGodPanel()
}

function renderGodPanel() {
  const table = document.getElementById('god-table')
  if (!table) return

  const header = `<div class="gsr gsr-header">
    <span class="gsr-name"></span>
    <span class="gsr-pop">HUM</span>
    <span class="gsr-inf">ZOM</span>
    <span class="gsr-rate">SPD</span>
  </div>`

  const rows = Object.values(state.districts).sort((a, b) => a.label.localeCompare(b.label)).map(d => {
    const total = d.humans + d.zombies
    const ratio = total > 0 ? d.zombies / total : 0
    let cls = 'clear'
    if (d.humans === 0)     cls = 'overrun'
    else if (ratio > 0.5)   cls = 'critical'
    else if (ratio > 0.15)  cls = 'danger'
    else if (d.zombies > 0) cls = 'infected'

    const spdValue    = (getEffectiveSpreadRate(d) * 100).toFixed(1) + '%'
    const spdLabel    = d.zombies > 0 ? spdValue : '—'
    const suppressed  = d.zombies > 0 && d.units.length > 0

    return `<div class="gsr">
      <span class="gsr-name">${d.label}</span>
      <span class="gsr-pop">${d.humans.toLocaleString()}</span>
      <span class="gsr-inf ${cls}">${d.zombies.toLocaleString()}</span>
      <span class="gsr-rate${suppressed ? ' suppressed' : ''}">${spdLabel}</span>
    </div>`
  }).join('')

  table.innerHTML = header + rows
}

document.getElementById('btn-win-restart').addEventListener('click', () => location.reload())

render()
const tickInterval = setInterval(tick, TICK_MS)
