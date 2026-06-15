import eNovak    from './scripts/e-novak.js'
import marcusWebb from './scripts/marcus-webb.js'
import danny      from './scripts/danny.js'
import holt       from './scripts/holt.js'

// ── CONFIG & CONSTANTS ──

const TICK_MS       = 3500
const SPREAD_RATE   = 0.12
let spreadChance = 0.35
const ROLES = ['police', 'fire', 'civilian']

// ── GAME CLOCK ──
const GAME_START_HOUR = 9   // game world begins at 09:00 Day 1
const GAME_START_DAY  = 1
const MINS_PER_TICK   = 15  // each tick advances game clock by 15 minutes

const PRESETS = {
  'default': { label: 'Default', seed: { 'millbrook': 15 } },
}

let tickInterval = null

// ── ITEMS ──

const ITEMS = {
  'gun':         { weight: 2, name: 'Gun',           description: 'Attack hit chance: 70%. Ranged — unit engages before contact, reducing counterattack exposure. Standard issue for Police.' },
  'fire-axe':    { weight: 4, name: 'Fire Axe',      description: 'Attack hit chance: 65%. Close-quarters weapon, effective in confined spaces. Standard issue for Fire units.' },
  'first-aid':   { weight: 5, name: 'First Aid Kit', description: 'Civilian automatically heals the most critically wounded unit in the district when any unit drops to 50 HP or below. Restores 20 HP. Single use — consumed on use.' },
  'radio':       { weight: 3, name: 'Radio',         description: 'While a Civilian carrying a Radio is present in a district, live human and infected counts are visible in the info panel. Intel is lost if the Civilian dies or redeploys.' },
  'rations':     { weight: 8, name: 'Food - Nonperishable', description: 'Passively restores 5 HP per tick to the carrying unit. Not consumed — provides sustained recovery for units in prolonged engagements.' },
  'binoculars':  { weight: 2, name: 'Binoculars',    description: 'While any unit carrying Binoculars is present in a district, adjacent districts\' human and infected counts are also visible in the info panel. Position strategically to extend your intel range.' },
}

// ── FACTORIES ──

const ITEM_ABBREV = { 'gun': 'GUN', 'fire-axe': 'AXE', 'first-aid': 'FAK', 'radio': 'RAD', 'rations': 'FOOD', 'binoculars': 'BNO' }

const PERSON_NAMES = {
  police:   ['Jack Sullivan', 'Maria Chen', 'Dave Kowalski', 'Frank Diaz', 'Linda Brooks', 'Ray Kim'],
  fire:     ['Tom Garza', 'Sarah Walsh', 'Joe Martinez', 'Ann Patel', 'Bill Cooper', 'Diane Osei'],
  civilian: ['Carol Hayes', 'Ben Archer', 'Pat Donnelly', 'Yuki Ito', 'Sam West', 'Rosa Bauer'],
}
const _pnIdx = { police: 0, fire: 0, civilian: 0 }
function nextPersonName(role) {
  const pool = PERSON_NAMES[role]
  return pool[_pnIdx[role]++ % pool.length]
}

let _uid = 0
const uid = () => `u${++_uid}`

function makePerson(name, role, items = [], opts = {}) {
  return {
    id: uid(), name, role, health: 100, items, unitId: null,
    sim:        opts.sim        ?? true,   // false = protected from sim combat/death
    districtId: opts.districtId ?? null,   // standalone location when not in a unit
    scriptId:   opts.scriptId   ?? null,   // links Person to their Script
  }
}

function makeUnit(label, districtId, personIds = [], leaderPersonId = null) {
  return { id: uid(), label, districtId, personIds, leaderPersonId: leaderPersonId ?? personIds[0] ?? null, activity: 'engage' }
}

const makeContact = (name, districtId = null) => ({
  id: uid(), name, messages: [], unread: false,
  location:    districtId,
  status:      districtId ? 'hiding' : null,
  alive:       true,
  type:        'ambient',
  phase:       0,
  timer:       null,
  scriptId:    null,
  personId:    null,   // set for scripted callers — links to the Person in state.people
  pendingNext: null,
  replyDelay:  0,
})

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

// Tiered by zombie count — vague by design, no numbers surface to the player
function getCallTier(zombies) {
  if (zombies >= 51) return 4
  if (zombies >= 26) return 3
  if (zombies >= 11) return 2
  if (zombies >= 4)  return 1
  return 0
}

const CALL_TEMPLATES = [
  // Tier 0: Minimal (1–3) — uncertain, could be nothing
  [
    d => `I don't want to overreact but I saw something near ${d.label}. One of my neighbors. I've locked my door.`,
    d => `This is probably nothing. But I'm in ${d.label} and I heard something I can't explain. Wanted someone to know.`,
    d => `Can someone check on ${d.label}? I think there's a person outside — something isn't right with them.`,
    d => `I saw one of them, I think. Just the one. I'm near ${d.label}. I'm inside now.`,
    d => `I might be wrong. I hope I'm wrong. But something happened at the corner near ${d.label}. Be careful.`,
    d => `There's something wrong. I don't know how to describe it. Calling from ${d.label}. Please send someone.`,
  ],
  // Tier 1: Low (4–10) — confirmed, limited, contained panic
  [
    d => `There's a small group of them outside. I can still count them from the window. ${d.label}, please hurry.`,
    d => `I can hear them. More than one. I've locked everything I can. Calling from ${d.label}.`,
    d => `We're not going outside. There's a handful of infected near ${d.label}. It's getting worse.`,
    d => `My kids are upstairs. I can see them from the second floor. A few of those things. ${d.label}. Please.`,
    d => `We barricaded the front door. There are a few of them in the street near ${d.label}. Not many yet.`,
    d => `I counted them before I stopped looking. ${d.label} needs units right now.`,
  ],
  // Tier 2: Moderate (11–25) — many, trapped
  [
    d => `There are too many to count now. We can't leave the building. ${d.label} is bad.`,
    d => `I watched them from the roof — there are a lot of them. The whole street. ${d.label}.`,
    d => `We tried to run and had to come back. Every road out of ${d.label} is cut off.`,
    d => `I stopped counting. There are enough of them that it doesn't matter anymore. Send help to ${d.label}.`,
    d => `It's spreading faster than anyone expected. ${d.label} is not safe. We're on the third floor and not moving.`,
    d => `I can hear screaming from the building next door. ${d.label}. I don't know how many of them there are.`,
  ],
  // Tier 3: High (26–50) — desperate, things deteriorating fast
  [
    d => `Please. There are so many. I don't know where they're all coming from. ${d.label}.`,
    d => `We've lost the lower floors. Six of us left up here. ${d.label} — send everything you have.`,
    d => `I don't know how long we have. The barricades won't hold. ${d.label}, please hurry.`,
    d => `It happened so fast. An hour ago this was fine. Now I can barely see the street through them. ${d.label}.`,
    d => `Half the people I knew in this building are gone. The rest of us are hiding. ${d.label} needs help now.`,
    d => `They're on every road out. We're completely surrounded in ${d.label}. Don't stop trying to reach us.`,
  ],
  // Tier 4: Critical (51+) — barely coherent
  [
    d => `[static] ...${d.label}... can anyone hear me... please...`,
    d => `I can barely talk. They're right outside the door. ${d.label}. If you can hear this — please come.`,
    d => `If anyone gets this — don't send people to ${d.label}. Just don't. It's over here.`,
    d => `There's no one left on my floor. I don't know how many. ${d.label}. [call drops]`,
    d => `[muffled] ...they're inside... I can hear them on the stairs... ${d.label}...`,
    d => `We were thirty people this morning. I can hear maybe four of us breathing right now. ${d.label}.`,
  ],
]

// ── NARRATIVE SCRIPTS ──
// Loaded from scripts/ — one file per character, plain JS objects.
// Each script: { id, name, callerRole, callerItems, district, trigger, once, nodes }
// Each node:   { text, choices, timer, timerNext, resolve }
// resolve: 'waiting' (alive, quiet) | 'lost' (dead — removes Person from sim)

const NARRATIVE_SCRIPTS = Object.fromEntries(
  [eNovak, marcusWebb, danny, holt].map(s => [s.id, s])
)

// ── DIRECTOR ──
// Watches game state each tick and fires authored beats when conditions are met.
// Register beats here; the simulation loop stays clean of scripted content.

const director = (() => {
  const _beats    = []
  const _handlers = {}   // event name → [handler(state, payload)]

  return {
    register(beat) {
      _beats.push({
        id:         beat.id       ?? 'unnamed',
        once:       beat.once     ?? true,
        cooldown:   beat.cooldown ?? 0,
        condition:  beat.condition,
        trigger:    beat.trigger,
        _fired:     false,
        _lastFired: -Infinity,
      })
    },

    tick() {
      for (const beat of _beats) {
        if (beat.once && beat._fired) continue
        if (beat.cooldown > 0 && state.tick - beat._lastFired < beat.cooldown) continue
        if (beat.condition(state)) {
          beat.trigger(state)
          beat._fired     = true
          beat._lastFired = state.tick
        }
      }
    },

    // Event hooks — fired by the sim, consumed by narrative beats.
    // Events: 'person-death'  { person, districtId }
    //         'unit-disbanded' { unitId, districtId }
    //         'unit-enters'   { unitId, destId, srcId }
    on(event, handler) {
      ;(_handlers[event] ??= []).push(handler)
    },

    emit(event, payload) {
      for (const h of (_handlers[event] ?? [])) h(state, payload)
    },
  }
})()

// ── WHEN — trigger condition helpers ─────────────────────────────────────────
// Each helper returns a (state) => boolean function for use in Director beats.
// Scripts declare their trigger as a plain object; triggerToCondition() converts
// it to the matching when.* call so the Director can auto-register.

const when = {
  zombiesIn:  district      => s  => (s.districts[district]?.zombies ?? 0) > 0,
  gameTime:   (hour, min=0) => s  => s.tick >= ticksFor(hour, min),
  humansGone: district      => s  => (s.districts[district]?.humans  ?? 1) === 0,
  unitIn:     district      => s  => Object.values(s.units).some(u => u.districtId === district),
  random:     chance        => () => Math.random() < chance,
  allOf:      (...fns)      => s  => fns.every(f => f(s)),
  anyOf:      (...fns)      => s  => fns.some(f  => f(s)),
}

function triggerToCondition(trigger) {
  switch (trigger?.type) {
    case 'zombie-presence': return when.zombiesIn(trigger.district)
    case 'game-time':       return when.gameTime(trigger.hour, trigger.min ?? 0)
    case 'humans-gone':     return when.humansGone(trigger.district)
    case 'unit-presence':   return when.unitIn(trigger.district)
    case 'random':          return when.random(trigger.chance)
    default:
      console.warn(`Director: unknown trigger type "${trigger?.type}"`)
      return () => false
  }
}

// ── DIRECTOR BEATS ──
// Scripts self-describe their trigger; the Director auto-registers from that field.
// To add a new character: create scripts/<id>.js, import it above, add to the array.

Object.values(NARRATIVE_SCRIPTS).forEach(script => {
  director.register({
    id:        script.id,
    once:      script.once ?? true,
    condition: triggerToCondition(script.trigger),
    trigger:   () => spawnScript(script.id),
  })
})

function spawnScript(scriptId) {
  const script = NARRATIVE_SCRIPTS[scriptId]
  if (!script) return

  // Spawn a protected Person in the sim — sim:false means they won't be attacked or randomly killed
  const person = makePerson(
    script.name,
    script.callerRole  ?? 'civilian',
    script.callerItems ?? [],
    { sim: false, districtId: script.district ?? null, scriptId }
  )
  state.people[person.id] = person

  // Create the Contact phone thread linked to this Person
  const contact    = makeContact(script.name, script.district ?? null)
  contact.type     = 'narrative'
  contact.scriptId = scriptId
  contact.personId = person.id
  state.contacts.push(contact)

  advanceNarrativeCaller(contact, 0)
}

function advanceNarrativeCaller(contact, nodeId) {
  const script = NARRATIVE_SCRIPTS[contact.scriptId]
  if (!script) return
  const node = script.nodes[nodeId]
  if (!node) return

  contact.phase = nodeId
  contact.timer = node.timer ?? null

  if (node.text) {
    contact.messages.push({ text: node.text, time: gameTime(), sender: 'npc' })
    contact.unread = true
  }

  if (node.resolve === 'lost') {
    contact.alive  = false
    contact.status = 'dead'
    // Remove the scripted Person from the sim — they're story-dead now
    if (contact.personId) {
      delete state.people[contact.personId]
      contact.personId = null
    }
    contact.messages.push({ text: '[contact lost]', time: gameTime() })
    contact.unread = true
  } else if (node.resolve === 'waiting') {
    contact.status = 'waiting'
    contact.timer  = null
  }

  if (state.selectedContact === contact.id) {
    renderContactMessages(contact)
    renderContactMeta(contact)
  }
}

function processNarrativeCallers() {
  for (const contact of state.contacts) {
    if (contact.type !== 'narrative') continue

    // Pending reply: player chose, waiting for NPC to "type back"
    if (contact.pendingNext !== null) {
      contact.replyDelay--
      if (contact.replyDelay <= 0) {
        const next = contact.pendingNext
        contact.pendingNext = null
        advanceNarrativeCaller(contact, next)
      }
      continue
    }

    if (contact.timer === null) continue
    contact.timer--
    if (contact.timer <= 0) {
      const script = NARRATIVE_SCRIPTS[contact.scriptId]
      const node   = script?.nodes[contact.phase]
      if (node?.timerNext != null) advanceNarrativeCaller(contact, node.timerNext)
    }
  }
}

// ── PERSON / UNIT HELPERS ──

function unitsInDistrict(districtId) {
  return (state.districts[districtId]?.unitIds ?? []).map(id => state.units[id]).filter(Boolean)
}

function personsInUnit(unitId) {
  return (state.units[unitId]?.personIds ?? []).map(id => state.people[id]).filter(Boolean)
}

function personsInDistrict(districtId) {
  return unitsInDistrict(districtId).flatMap(u => personsInUnit(u.id))
}

function woundState(person) {
  if (person.health >= 70) return 'healthy'
  if (person.health >= 40) return 'wounded'
  if (person.health >= 1)  return 'critical'
  return 'dead'
}

function handlePersonDeath(person, districtId) {
  const d = state.districts[districtId]
  // 40% chance each item drops to district loot
  for (const item of person.items) {
    if (Math.random() < 0.40) d.loot.push(item)
  }
  const unit = state.units[person.unitId]
  if (unit) {
    unit.personIds = unit.personIds.filter(id => id !== person.id)
    if (unit.leaderPersonId === person.id) unit.leaderPersonId = unit.personIds[0] ?? null
    if (unit.personIds.length === 0) disbandUnit(unit.id, districtId)
  }
  director.emit('person-death', { person, districtId })
  delete state.people[person.id]
  broadcastEvent(`${crackle()}[${d.label.toUpperCase()}] UNIT DOWN — ${crackle()}no further contact.`)
}

function disbandUnit(unitId, districtId) {
  const d = state.districts[districtId]
  if (d) d.unitIds = d.unitIds.filter(id => id !== unitId)
  director.emit('unit-disbanded', { unitId, districtId })
  delete state.units[unitId]
}

// ── COMBAT & UTILITIES ──

const THREAT_MOD = { police: 3, fire: 2, civilian: 1 }

function getHitChance(person) {
  const base = person.items.includes('gun')      ? 0.70
             : person.items.includes('fire-axe') ? 0.65
             : 0.50
  const ws = woundState(person)
  if (ws === 'wounded')  return base * 0.80
  if (ws === 'critical') return base * 0.40
  return base
}

// Hiding units are much harder to target — 30% of their normal threat weight
function effectiveThreatMod(person) {
  const unit = state.units[person.unitId]
  const base = THREAT_MOD[person.role]
  return unit?.activity === 'hide' ? base * 0.3 : base
}

function pickCounterTarget(persons) {
  const eligible = persons.filter(p => p.sim !== false)
  if (eligible.length === 0) return null
  const total = eligible.reduce((sum, p) => sum + effectiveThreatMod(p), 0)
  let r = Math.random() * total
  for (const p of eligible) {
    r -= effectiveThreatMod(p)
    if (r <= 0) return p
  }
  return eligible[eligible.length - 1]
}

function districtHasRadio(districtId) {
  return personsInDistrict(districtId).some(p => p.role === 'civilian' && p.items.includes('radio'))
}

function districtHasBinoView(districtId) {
  return (adjacency[districtId] || []).some(adjId =>
    personsInDistrict(adjId).some(p => p.items.includes('binoculars'))
  )
}

// Local growth rate reduced by units present (each unit -12%, cap 80%)
function getEffectiveSpreadRate(d) {
  const suppression = Math.min(0.80, (d.unitIds?.length ?? 0) * 0.12)
  return SPREAD_RATE * (1 - suppression)
}

function gameTime() {
  const totalMins = GAME_START_HOUR * 60 + state.tick * MINS_PER_TICK
  const h = Math.floor((totalMins % 1440) / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function gameDay() {
  const totalMins = GAME_START_HOUR * 60 + state.tick * MINS_PER_TICK
  return Math.floor(totalMins / 1440) + GAME_START_DAY
}

// Convert a game-world hour (and optional minute) to the tick count at which that time occurs.
// Used by Director beats: condition: () => state.tick >= ticksFor(11) means "at or after 11:00".
function ticksFor(hour, minute = 0) {
  return Math.max(0, Math.ceil(((hour - GAME_START_HOUR) * 60 + minute) / MINS_PER_TICK))
}

// ── LOOT ──

const LOOT_POOLS = {
  'police-hq':    [{ item: 'gun',        w: 7 }, { item: 'first-aid', w: 2 }, { item: 'rations',    w: 2 }],
  'fire-station': [{ item: 'fire-axe',   w: 7 }, { item: 'first-aid', w: 2 }, { item: 'rations',    w: 2 }],
  residential:    [{ item: 'rations',    w: 8 }, { item: 'first-aid', w: 4 }, { item: 'radio',      w: 3 }, { item: 'binoculars', w: 1 }],
  medical:        [{ item: 'first-aid',  w: 9 }, { item: 'rations',   w: 5 }, { item: 'radio',      w: 2 }],
  retail:         [{ item: 'rations',    w: 7 }, { item: 'radio',     w: 5 }, { item: 'first-aid',  w: 3 }, { item: 'binoculars', w: 2 }],
  industrial:     [{ item: 'fire-axe',   w: 6 }, { item: 'rations',   w: 5 }, { item: 'first-aid',  w: 2 }],
  government:     [{ item: 'gun',        w: 3 }, { item: 'fire-axe',  w: 3 }, { item: 'first-aid',  w: 4 }, { item: 'rations',    w: 4 }],
}

function weightedPick(pool) {
  const total = pool.reduce((s, e) => s + e.w, 0)
  let r = Math.random() * total
  for (const e of pool) { r -= e.w; if (r <= 0) return e.item }
  return pool[pool.length - 1].item
}

function rollLoot(districtId, category, count) {
  const pool = LOOT_POOLS[districtId] ?? LOOT_POOLS[category]
  return Array.from({ length: count }, () => weightedPick(pool))
}

// ── STATE ──

const state = {
  tick: 0,
  started:         false,
  won:             false,
  lost:            false,
  godMode:         false,
  selected:        null,
  selectedUnit:    null,
  selectedContact: null,
  contacts:        [ makeContact('City Hall') ],
  people:          {},
  units:           {},
  districts: {
    'northgate':    { label: 'Northgate',      category: 'residential', humans: 1000, zombies: 0, unitIds: [], loot: rollLoot('northgate',    'residential', 2) },
    'millbrook':    { label: 'Millbrook',       category: 'residential', humans: 1000, zombies: 0, unitIds: [], loot: rollLoot('millbrook',    'residential', 2) },
    'eastridge':    { label: 'Eastridge',       category: 'residential', humans: 1200, zombies: 0, unitIds: [], loot: rollLoot('eastridge',    'residential', 2) },
    'westgate':     { label: 'Westgate',        category: 'residential', humans: 900,  zombies: 0, unitIds: [], loot: rollLoot('westgate',     'residential', 1) },
    'police-hq':    { label: 'Police HQ',       category: 'government',  humans: 80,   zombies: 0, unitIds: [], loot: rollLoot('police-hq',    'government',  3) },
    'fire-station': { label: 'Fire Station',    category: 'government',  humans: 60,   zombies: 0, unitIds: [], loot: rollLoot('fire-station', 'government',  3) },
    'city-hall':    { label: 'City Hall',       category: 'government',  humans: 200,  zombies: 0, unitIds: [], loot: rollLoot('city-hall',    'government',  2) },
    'memorial':     { label: 'Memorial',        category: 'medical',     humans: 600,  zombies: 0, unitIds: [], loot: rollLoot('memorial',     'medical',     4) },
    'ironworks':    { label: 'Ironworks',       category: 'industrial',  humans: 380,  zombies: 0, unitIds: [], loot: rollLoot('ironworks',    'industrial',  2) },
    'riverside':    { label: 'Riverside',       category: 'residential', humans: 1100, zombies: 0, unitIds: [], loot: rollLoot('riverside',    'residential', 2) },
    'market':       { label: 'Market District', category: 'retail',      humans: 700,  zombies: 0, unitIds: [], loot: rollLoot('market',       'retail',      3) },
    'commerce':     { label: 'Commerce Park',   category: 'retail',      humans: 650,  zombies: 0, unitIds: [], loot: rollLoot('commerce',     'retail',      2) },
    'southend':     { label: 'Southend',        category: 'residential', humans: 950,  zombies: 0, unitIds: [], loot: rollLoot('southend',     'residential', 2) },
    'industrial':   { label: 'Industrial Row',  category: 'industrial',  humans: 400,  zombies: 0, unitIds: [], loot: rollLoot('industrial',   'industrial',  2) },
  }
}

// Spawn starting units and people
let _unitCounter = 0

;(function initStartingUnits() {
  function spawn(role, items, districtId) {
    const label  = `Unit ${++_unitCounter}`
    const person = makePerson(nextPersonName(role), role, items)
    const unit   = makeUnit(label, districtId, [person.id])
    person.unitId = unit.id
    state.people[person.id] = person
    state.units[unit.id]    = unit
    state.districts[districtId].unitIds.push(unit.id)
  }
  spawn('police',   ['gun'],               'police-hq')
  spawn('police',   ['gun'],               'police-hq')
  spawn('police',   ['gun'],               'police-hq')
  spawn('fire',     ['fire-axe'],          'fire-station')
  spawn('fire',     ['fire-axe'],          'fire-station')
  spawn('fire',     ['fire-axe'],          'fire-station')
  spawn('civilian', ['first-aid', 'radio'], 'city-hall')
  spawn('civilian', ['first-aid', 'radio'], 'city-hall')
  spawn('civilian', ['first-aid'],          'city-hall')
})()

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

// ── INIT ──

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

// ── DOM REFS ──

const godBtn      = document.getElementById('btn-god-mode')
const tickDisplay = document.getElementById('tick-display')
const timeDisplay = document.getElementById('time-display')
const infoName    = document.getElementById('info-name')
const infoCat     = document.getElementById('info-cat')
const infoPop     = document.getElementById('info-pop')
const unitsPanel    = document.getElementById('units-panel')
const contactsPanel = document.getElementById('contacts-panel')
const unitsList   = document.getElementById('units-list')
const udvType     = document.getElementById('udv-type')
const udvLocation = document.getElementById('udv-location')
const udvActivity = document.getElementById('udv-activity')
const udvItems    = document.getElementById('udv-items')
const udvMembers  = document.getElementById('udv-members')
const udvTarget   = document.getElementById('udv-target')
const btnUdvSend  = document.getElementById('btn-udv-send')
const btnUdvBack  = document.getElementById('btn-udv-back')
const cdvName     = document.getElementById('cdv-name')
const cdvMeta     = document.getElementById('cdv-meta')
const cdvMessages = document.getElementById('cdv-messages')
const btnCdvBack  = document.getElementById('btn-cdv-back')
const idvName     = document.getElementById('idv-name')
const idvDesc     = document.getElementById('idv-description')
const btnIdvBack  = document.getElementById('btn-idv-back')

// ── WINDOW MANAGER ──

const WIN_IDS = ['dispatch', 'map', 'contacts', 'radio', 'sitrep', 'items']
const LAYOUT_WIN_IDS = ['dispatch', 'map', 'contacts', 'radio']
const winState = {}
let _topZ = 10

function getDefaultLayout() {
  const desktop = document.getElementById('desktop')
  const dw = desktop.clientWidth, dh = desktop.clientHeight
  const rw = 292, lw = 270, dw_d = 376
  return {
    dispatch: { x: lw + 2,           y: 0, w: dw_d,                        h: dh },
    map:      { x: lw + dw_d + 4,    y: 0, w: dw - lw - dw_d - rw - 6,    h: dh },
    contacts: { x: 0,                 y: 0, w: lw,                           h: dh },
    radio:    { x: dw - rw,           y: 0, w: rw,                           h: dh },
    sitrep:   { x: Math.floor((dw - 520) / 2), y: Math.floor((dh - 420) / 2), w: 520, h: 420 },
    items:    { x: Math.floor((dw - 420) / 2), y: Math.floor((dh - 480) / 2), w: 420, h: 480 },
  }
}

function resetLayout() {
  const defaults = getDefaultLayout()
  for (const id of LAYOUT_WIN_IDS) {
    Object.assign(winState[id], defaults[id], { minimized: false, maximized: false, _restore: null })
    document.getElementById(`win-${id}`).classList.remove('win-minimized')
    applyWinGeometry(id)
  }
  syncTaskbar()
  bringToFront('dispatch')
}

function initWindowManager() {
  const defaults = getDefaultLayout()

  for (const id of WIN_IDS) {
    winState[id] = { ...defaults[id], minimized: false, maximized: false, _restore: null, z: ++_topZ }
    applyWinGeometry(id)

    const winEl    = document.getElementById(`win-${id}`)
    const titlebar = winEl.querySelector('.win-titlebar')

    winEl.addEventListener('mousedown', () => bringToFront(id), true)

    titlebar.addEventListener('mousedown', e => {
      if (e.target.closest('.win-btn')) return
      if (winState[id].pinned) return
      e.preventDefault()
      const ws = winState[id]
      if (ws.maximized) return
      const ox = e.clientX - ws.x, oy = e.clientY - ws.y
      const onMove = ev => { ws.x = ev.clientX - ox; ws.y = ev.clientY - oy; clampWin(id); applyWinGeometry(id) }
      const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })

    titlebar.addEventListener('dblclick', e => { if (!e.target.closest('.win-btn')) toggleMaximize(id) })

    // Remove old single-corner resize, add full 8-edge resize handles
    const oldResize = winEl.querySelector('.win-resize')
    if (oldResize) oldResize.remove()
    for (const dir of ['n','ne','e','se','s','sw','w','nw']) {
      const edge = document.createElement('div')
      edge.className = `win-edge win-edge--${dir}`
      edge.addEventListener('mousedown', e => startResize(id, dir, e))
      winEl.appendChild(edge)
    }

    // Generate window controls — order: PIN | MIN | MAX | CLOSE
    const controls = winEl.querySelector('.win-controls')
    controls.innerHTML = `
      <button class="win-btn win-pin-btn">PIN</button>
      <button class="win-btn win-min-btn">−</button>
      <button class="win-btn win-max-btn">□</button>
      <button class="win-btn win-close-btn">×</button>
    `
    controls.querySelector('.win-pin-btn').addEventListener('click',   () => togglePin(id))
    controls.querySelector('.win-min-btn').addEventListener('click',   () => toggleMinimize(id))
    controls.querySelector('.win-max-btn').addEventListener('click',   () => toggleMaximize(id))
    controls.querySelector('.win-close-btn').addEventListener('click', () => toggleMinimize(id))
  }

  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.win
      if (winState[id].minimized) { toggleMinimize(id) }
      else if (_activeWin === id)  { toggleMinimize(id) }
      else                         { bringToFront(id) }
    })
  })

  // These panels start minimized — not part of the default tiled layout
  for (const id of ['sitrep', 'items']) {
    winState[id].minimized = true
    document.getElementById(`win-${id}`).classList.add('win-minimized')
  }

  bringToFront('dispatch')
  syncTaskbar()
}

function applyWinGeometry(id) {
  const ws = winState[id]
  const el = document.getElementById(`win-${id}`)
  el.style.left = ws.x + 'px'; el.style.top    = ws.y + 'px'
  el.style.width = ws.w + 'px'; el.style.height = ws.h + 'px'
  el.style.zIndex = ws.z
}

function clampWin(id) {
  const ws = winState[id]
  const desktop = document.getElementById('desktop')
  ws.y = Math.max(0, Math.min(desktop.clientHeight - 30, ws.y))
  ws.x = Math.max(80 - ws.w, Math.min(desktop.clientWidth - 80, ws.x))
}

function startResize(id, dir, e) {
  e.preventDefault(); e.stopPropagation()
  const ws = winState[id]
  if (ws.pinned || ws.maximized) return
  bringToFront(id)
  const sx = e.clientX, sy = e.clientY
  const ox = ws.x, oy = ws.y, ow = ws.w, oh = ws.h
  const onMove = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy
    if (dir.includes('e'))  ws.w = Math.max(220, ow + dx)
    if (dir.includes('s'))  ws.h = Math.max(120, oh + dy)
    if (dir.includes('w')) { ws.w = Math.max(220, ow - dx); ws.x = ox + (ow - ws.w) }
    if (dir.includes('n')) { ws.h = Math.max(120, oh - dy); ws.y = oy + (oh - ws.h) }
    applyWinGeometry(id)
  }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

let _activeWin = null

function bringToFront(id) {
  _activeWin = id
  document.querySelectorAll('.win').forEach(w => w.classList.remove('win-active'))
  const el = document.getElementById(`win-${id}`)
  el.classList.add('win-active')
  winState[id].z = ++_topZ
  el.style.zIndex = _topZ
}

function togglePin(id) {
  const ws = winState[id]
  ws.pinned = !ws.pinned
  const btn = document.getElementById(`win-${id}`).querySelector('.win-pin-btn')
  btn.textContent = ws.pinned ? 'UNPIN' : 'PIN'
  btn.classList.toggle('win-btn-active', ws.pinned)
}

function toggleMinimize(id) {
  const ws = winState[id]
  ws.minimized = !ws.minimized
  document.getElementById(`win-${id}`).classList.toggle('win-minimized', ws.minimized)
  if (!ws.minimized) {
    clampWin(id); applyWinGeometry(id); bringToFront(id)
  }
  // Closing the sitrep debug window turns off god mode
  if (id === 'sitrep' && ws.minimized && state.godMode) {
    state.godMode = false
    document.body.classList.remove('god-mode')
    syncGodBtn()
    renderGodPanel()
    updateRightPanel()
  }
  syncTaskbar()
}

// ── RADIO / COMMS ──

const RADIO_MAX = 5
const RADIO_TTL = 10
const STATIC_TAGS = ['[wzzt]', '[szzt]', '[krrk]', '[fssh]']
let radioFeed = []

function crackle() {
  return Math.random() < 0.45 ? STATIC_TAGS[Math.floor(Math.random() * STATIC_TAGS.length)] + ' ' : ''
}

function broadcastEvent(text) {
  if (!state.started) return
  radioFeed.unshift({ text, tick: state.tick, time: gameTime() })
  radioFeed = radioFeed.filter(m => state.tick - m.tick < RADIO_TTL)
  if (radioFeed.length > RADIO_MAX) radioFeed.length = RADIO_MAX
  renderRadio()
}

function renderRadio() {
  const feed = document.getElementById('radio-feed')
  if (!feed) return
  const now = state.tick
  feed.innerHTML = radioFeed.map(m => {
    const age = now - m.tick
    const cls = age < 2 ? 't0' : age < 5 ? 't1' : 't2'
    const html = m.text.replace(/(\[wzzt\]|\[szzt\]|\[krrk\]|\[fssh\])/g, '<span class="radio-noise">$1</span>')
    return `<div class="radio-msg radio-msg--${cls}"><span class="radio-time">[${m.time}]</span> ${html}</div>`
  }).join('')
}

function toggleMaximize(id) {
  const ws = winState[id]
  const desktop = document.getElementById('desktop')
  if (ws.maximized) {
    Object.assign(ws, ws._restore)
    ws.maximized = false; ws._restore = null
  } else {
    ws._restore  = { x: ws.x, y: ws.y, w: ws.w, h: ws.h }
    ws.x = 0; ws.y = 0; ws.w = desktop.clientWidth; ws.h = desktop.clientHeight
    ws.maximized = true
  }
  applyWinGeometry(id)
  bringToFront(id)
}

function syncTaskbar() {
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.classList.toggle('win-minimized', winState[btn.dataset.win].minimized)
  })
}

// ── GOD MODE ──

if (state.godMode) document.body.classList.add('god-mode')
syncGodBtn()

godBtn.addEventListener('click', () => {
  state.godMode = !state.godMode
  document.body.classList.toggle('god-mode', state.godMode)
  // Sitrep is the god mode debug screen — open/close it together
  if (winState['sitrep']) {
    if (state.godMode && winState['sitrep'].minimized)  toggleMinimize('sitrep')
    if (!state.godMode && !winState['sitrep'].minimized) toggleMinimize('sitrep')
  }
  syncGodBtn()
  renderGodPanel()
  updateRightPanel()
})

function syncGodBtn() {
  godBtn.textContent = `GOD MODE: ${state.godMode ? 'ON' : 'OFF'}`
}

// ── MAP ──

document.querySelectorAll('#districts polygon').forEach(poly => {
  poly.addEventListener('click', () => selectDistrict(poly.id))
})

document.getElementById('unit-dots').addEventListener('click', e => {
  const dot = e.target.closest('.unit-map-dot')
  if (!dot) return
  e.stopPropagation()
  const unitId = dot.dataset.unitId
  if (!unitId || !state.units[unitId]) return
  if (winState['dispatch']?.minimized) toggleMinimize('dispatch')
  bringToFront('dispatch')
  showUnitDetail(unitId)
})

function selectDistrict(id) {
  const pinGroup = document.getElementById('district-pin')

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
    if (pinGroup) pinGroup.innerHTML = ''
    return
  }

  state.selected = id
  const poly = document.getElementById(id)
  if (poly) {
    poly.setAttribute('clip-path', `url(#clip-${id})`)
    poly.classList.add('selected')
    if (pinGroup) {
      const b = poly.getBBox()
      const pinSize = 84
      // Needle tip in the 500×500 viewBox lands at ≈(94, 406) after transforms.
      // Center horizontally on the district; 8px (≈37 SVG units) from the top.
      const svgX = b.x + b.width / 2 - (94 / 500) * pinSize
      const svgY = b.y + 37 - (406 / 500) * pinSize

      pinGroup.innerHTML = `<svg x="${svgX.toFixed(1)}" y="${svgY.toFixed(1)}" width="${pinSize}" height="${pinSize}" viewBox="0 0 500 500" overflow="visible">
        <g transform="translate(500,0) scale(-1,1)">
          <g transform="translate(250,250) rotate(-45) translate(-250,-250)">
            <path d="M 235 270 L 250 470 L 265 270 Z" fill="#b0bec5" stroke="black" stroke-width="25" stroke-linejoin="round" paint-order="stroke fill"/>
            <rect x="215" y="120" width="70" height="90" fill="#ff4d40"/>
            <ellipse cx="250" cy="270" rx="95" ry="75" fill="#ff4d40" stroke="black" stroke-width="25" paint-order="stroke fill"/>
            <ellipse cx="250" cy="120" rx="80" ry="50" fill="#ff4d40" stroke="black" stroke-width="25" paint-order="stroke fill"/>
          </g>
        </g>
      </svg>`
    }
  }
  updateRightPanel()
}

function updateRightPanel() {
  if (!state.selected) return
  const d = state.districts[state.selected]
  if (!d) return
  infoName.textContent = d.label
  infoCat.textContent  = d.category

  const hasRadio = districtHasRadio(state.selected)
  const hasBino  = districtHasBinoView(state.selected)
  if (state.godMode || hasRadio || hasBino) {
    let badge = ''
    if (!state.godMode) badge = hasRadio
      ? '<div class="radio-intel-badge">RADIO INTEL</div>'
      : '<div class="radio-intel-badge">BINOC INTEL</div>'
    infoPop.innerHTML = `${badge}<span class="pop-stat">Humans: ${d.humans.toLocaleString()}</span><span class="pop-sep">·</span><span class="pop-stat">Infected: ${d.zombies.toLocaleString()}</span>`
  } else {
    infoPop.innerHTML = '<span class="no-intel">No intel</span>'
  }
}

// ── LEFT PANEL ──

initWindowManager()

function setUnitsView(view)    { unitsPanel.dataset.view    = view || '' }
function setContactsView(view) { contactsPanel.dataset.view = view || '' }

unitsList.addEventListener('click', e => {
  const card = e.target.closest('.roster-card')
  if (!card) return
  showUnitDetail(card.dataset.unitId)
})

unitsList.addEventListener('mouseover', e => {
  const card = e.target.closest('.roster-card')
  if (!card) return
  document.querySelectorAll('#districts polygon').forEach(p => p.classList.remove('roster-hover'))
  const poly = document.getElementById(card.dataset.districtId)
  if (poly) poly.classList.add('roster-hover')
})

unitsList.addEventListener('mouseleave', () => {
  document.querySelectorAll('#districts polygon').forEach(p => p.classList.remove('roster-hover'))
})

function showUnitDetail(unitId) {
  const unit = state.units[unitId]
  if (!unit) return
  state.selectedUnit = { unitId, districtId: unit.districtId }
  renderUnitDetail(unit)
  setUnitsView('unit-detail')
}

function renderUnitDetail(unit) {
  const d       = state.districts[unit.districtId]
  const persons = personsInUnit(unit.id)
  const leader  = state.people[unit.leaderPersonId]

  udvType.textContent     = unit.label
  udvLocation.textContent = d?.label ?? '—'

  udvActivity.innerHTML = `
    <div class="activity-label">ACTIVITY</div>
    <div class="activity-btns">
      ${['engage', 'hide', 'scavenge'].map(a =>
        `<button class="activity-btn${unit.activity === a ? ' activity-btn--active' : ''}" data-activity="${a}">${a.toUpperCase()}</button>`
      ).join('')}
    </div>`

  const allItems = [...new Set(persons.flatMap(p => p.items))]
  udvItems.innerHTML = allItems.length === 0
    ? ''
    : allItems.map(key => {
        const item = ITEMS[key]
        if (!item) return ''
        return `<div class="item-chip item-chip--${key}" data-item-key="${key}">${item.name}</div>`
      }).join('')

  udvMembers.innerHTML = persons.map(p => {
    const ws       = woundState(p)
    const isLeader = p.id === unit.leaderPersonId
    return `<div class="udv-member">
      <span class="member-dot member-dot--${p.role}"></span>
      ${isLeader ? `<span class="leader-ws-star ws-${ws}">★</span>` : '<span class="udv-member-spacer"></span>'}
      <span class="udv-member-name">${p.name}</span>
      <span class="udv-member-role">${p.role.toUpperCase()}</span>
      <span class="udv-ws-badge ws-${ws}">${ws.toUpperCase()}</span>
    </div>`
  }).join('')

  udvTarget.innerHTML = '<option value="">— select destination —</option>' +
    Object.entries(state.districts)
      .filter(([nid]) => nid !== unit.districtId)
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([nid, nd]) => `<option value="${nid}">${nd.label}</option>`)
      .join('')
}

function hideUnitDetail() {
  state.selectedUnit = null
  setUnitsView(null)
}

function renderContactMeta(contact) {
  if (!contact.location) { cdvMeta.style.display = 'none'; return }
  const d = state.districts[contact.location]
  const locLabel   = d ? d.label : '—'
  const statusText = contact.alive ? contact.status : 'lost'
  const statusCls  = contact.alive ? contact.status : 'dead'
  cdvMeta.innerHTML = `
    <div class="cdv-meta-row">
      <span class="cdv-meta-label">Status</span>
      <span class="cdv-meta-value cdv-meta-value--${statusCls}">${statusText}</span>
    </div>
    <div class="cdv-meta-row">
      <span class="cdv-meta-label">Location</span>
      <span class="cdv-meta-value">${locLabel}</span>
    </div>`
  cdvMeta.style.display = ''
}

function showContactDetail(contactId) {
  const contact = state.contacts.find(c => c.id === contactId)
  if (!contact) return
  state.selectedContact = contactId
  contact.unread = false
  renderContactsPanel()
  cdvName.textContent = contact.name
  renderContactMeta(contact)
  renderContactMessages(contact)
  setContactsView('contact-detail')
}

function hideContactDetail() {
  state.selectedContact = null
  setContactsView(null)
}

function showItemDescription(key) {
  const item = ITEMS[key]
  if (!item) return
  idvName.textContent = item.name
  idvDesc.textContent = item.description
  setUnitsView('item-description')
}

function hideItemDescription() {
  setUnitsView('unit-detail')
}

function renderContactMessages(contact) {
  if (contact.messages.length === 0) {
    cdvMessages.innerHTML = '<div class="no-messages">No messages yet.</div>'
  } else {
    let lastTime = null
    const parts = contact.messages.map(m => {
      const isLost   = m.text === '[contact lost]'
      const isPlayer = m.sender === 'player'
      if (isLost) {
        return `<div class="chat-bubble chat-bubble--lost"><div class="chat-text">${m.text}</div></div>`
      }
      const stamp = m.time !== lastTime
        ? `<div class="chat-timestamp">${m.time}</div>` : ''
      lastTime = m.time
      return `${stamp}<div class="chat-bubble ${isPlayer ? 'chat-bubble--player' : 'chat-bubble--npc'}"><div class="chat-text">${m.text}</div></div>`
    })
    cdvMessages.innerHTML = parts.join('')
  }

  // Show a "typing..." indicator while waiting for NPC reply
  if (contact.pendingNext !== null) {
    cdvMessages.innerHTML += '<div class="chat-waiting">...</div>'
  }

  cdvMessages.scrollTop = cdvMessages.scrollHeight

  const choicesEl = document.getElementById('cdv-choices')
  if (!choicesEl) return
  if (contact.type === 'narrative' && contact.alive && !contact.pendingNext) {
    const node = NARRATIVE_SCRIPTS[contact.scriptId]?.nodes[contact.phase]
    if (node?.choices?.length) {
      choicesEl.innerHTML = `<div class="cdv-choices-label">RESPOND:</div>` +
        node.choices.map((c, i) =>
          `<button class="choice-btn" data-contact-id="${contact.id}" data-choice-idx="${i}">${c.label}</button>`
        ).join('')
      choicesEl.style.display = ''
      return
    }
  }
  choicesEl.innerHTML = ''
  choicesEl.style.display = 'none'
}

// ── CONTACTS ──

function checkCallEvent() {
  if (Math.random() > 0.10) return
  const infected = Object.entries(state.districts).filter(([, d]) => d.zombies > 0)
  if (!infected.length) return

  const [triggerId, triggerDist] = infected[Math.floor(Math.random() * infected.length)]

  let contact
  const useExisting = state.contacts.length > 0 && (Math.random() < 0.5 || _callerIdx >= CALLER_POOL.length)
  if (useExisting) {
    // Only reuse alive ambient contacts — narrative callers run on their own schedule
    const candidates = state.contacts.filter(c => c.alive && c.type === 'ambient')
    if (!candidates.length) return
    contact = candidates[Math.floor(Math.random() * candidates.length)]
  } else {
    const name = CALLER_POOL[_callerIdx++]
    const isNamed = name !== 'Unknown Caller'
    contact = makeContact(name, isNamed ? triggerId : null)
    state.contacts.push(contact)
  }

  // Named callers report from their fixed location; unknowns from the triggered district
  const reportDist = (contact.location && state.districts[contact.location])
    ? state.districts[contact.location]
    : triggerDist

  // Named callers in safe zones go quiet
  if (contact.location && reportDist.zombies === 0) return

  const timeStr = gameTime()
  const pool = CALL_TEMPLATES[getCallTier(reportDist.zombies)]
  const text = pool[Math.floor(Math.random() * pool.length)](reportDist)

  contact.messages.push({ text, time: timeStr, sender: 'npc' })
  contact.unread = true
}

function checkCallerSurvival() {
  for (const contact of state.contacts) {
    if (contact.personId) continue  // scripted callers only die when the Director says so
    if (!contact.location || !contact.alive) continue
    const d = state.districts[contact.location]
    if (!d || d.zombies === 0) continue

    const dangerRatio = d.zombies / Math.max(1, d.humans + d.zombies)
    let deathChance = dangerRatio * 0.04
    if (contact.status === 'hiding') deathChance *= 0.25

    if (Math.random() < deathChance) {
      contact.alive = false
      contact.status = 'dead'
      contact.messages.push({ text: '[contact lost]', time: gameTime() })
      contact.unread = true
    }
  }
}

function renderContactsPanel() {
  const list = document.getElementById('contacts-list')
  if (!list) return

  const sorted = state.contacts.slice().sort((a, b) => {
    if (b.unread !== a.unread) return (b.unread ? 1 : 0) - (a.unread ? 1 : 0)
    if (b.alive !== a.alive)   return (b.alive  ? 1 : 0) - (a.alive  ? 1 : 0)
    return 0
  })

  list.innerHTML = sorted.length === 0
    ? '<div class="no-contacts">No contacts yet.</div>'
    : sorted.map(c => {
        const deadClass   = !c.alive ? ' contact-dead' : ''
        const unreadClass = c.unread ? ' has-unread' : ''
        const hasPendingChoice = c.type === 'narrative' && c.alive &&
          NARRATIVE_SCRIPTS[c.scriptId]?.nodes[c.phase]?.choices?.length > 0
        const pendingClass = hasPendingChoice ? ' has-pending' : ''
        const dot = !c.alive && c.unread
          ? '<span class="unread-dot unread-dot--lost"></span>'
          : hasPendingChoice
          ? '<span class="unread-dot unread-dot--pending"></span>'
          : c.unread
          ? '<span class="unread-dot"></span>'
          : ''
        return `<div class="contact-card${unreadClass}${deadClass}${pendingClass}" data-contact-id="${c.id}">
          <span>${c.name}</span>
          ${dot}
        </div>`
      }).join('')
}

// ── EVENT LISTENERS ──

btnUdvBack.addEventListener('click', hideUnitDetail)
btnCdvBack.addEventListener('click', hideContactDetail)
btnIdvBack.addEventListener('click', hideItemDescription)

document.getElementById('unit-detail-view').addEventListener('click', e => {
  const btn = e.target.closest('.activity-btn')
  if (!btn) return
  const unit = state.units[state.selectedUnit?.unitId]
  if (!unit) return
  unit.activity = btn.dataset.activity
  renderUnitDetail(unit)
})

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

document.getElementById('contact-detail-view').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn')
  if (!btn) return
  const contact = state.contacts.find(c => c.id === btn.dataset.contactId)
  if (!contact) return
  const node = NARRATIVE_SCRIPTS[contact.scriptId]?.nodes[contact.phase]
  const choice = node?.choices?.[parseInt(btn.dataset.choiceIdx, 10)]
  if (!choice) return

  // Log player's reply as an outgoing message
  contact.messages.push({ text: choice.label, time: gameTime(), sender: 'player' })

  // Stop the choice timer, queue NPC reply with a short random delay
  contact.timer       = null
  contact.pendingNext = choice.next
  contact.replyDelay  = 2 + Math.floor(Math.random() * 3)

  renderContactMessages(contact)
  renderContactsPanel()
})

function dispatchUnit(unitId, destId) {
  const unit = state.units[unitId]
  const src  = state.districts[unit?.districtId]
  const dest = state.districts[destId]
  if (!unit || !src || !dest || unit.districtId === destId) return

  const srcId = unit.districtId
  src.unitIds  = src.unitIds.filter(id => id !== unitId)
  dest.unitIds.push(unitId)
  unit.districtId = destId
  if (state.selectedUnit?.unitId === unitId) state.selectedUnit.districtId = destId

  director.emit('unit-enters', { unitId, destId, srcId })
  broadcastEvent(`[${dest.label.toUpperCase()}] Unit en route from ${src.label}.`)
  renderUnitsPanel()
}

btnUdvSend.addEventListener('click', () => {
  if (!state.selectedUnit) return
  const destId = udvTarget.value
  if (!destId) return
  dispatchUnit(state.selectedUnit.unitId, destId)
  hideUnitDetail()
})

// ── DRAG-AND-DROP DISPATCH ──

unitsList.addEventListener('dragstart', e => {
  const card = e.target.closest('.roster-card')
  if (!card) return
  e.dataTransfer.setData('text/plain', card.dataset.unitId)
  e.dataTransfer.effectAllowed = 'move'
})

document.querySelectorAll('#districts polygon').forEach(poly => {
  poly.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  })
  poly.addEventListener('dragenter', e => {
    e.preventDefault()
    poly.classList.add('drop-target')
  })
  poly.addEventListener('dragleave', () => {
    poly.classList.remove('drop-target')
  })
  poly.addEventListener('drop', e => {
    e.preventDefault()
    poly.classList.remove('drop-target')
    const unitId = e.dataTransfer.getData('text/plain')
    if (unitId) {
      dispatchUnit(unitId, poly.id)
      if (state.selectedUnit?.unitId === unitId) hideUnitDetail()
    }
  })
})

// ── SIMULATION ──

const LOSE_FLAVOR = 'The final unit transmission came in without a distress call — a routine contact report, then nothing. With no assets left in the field, the remaining districts were left uncontested. The city didn\'t fall all at once. It went quiet street by street, district by district, until the only thing moving on the radio was static. The last entry in the dispatch log belongs to you.'
const WIN_FLAVOR  = 'At some point in the early hours, the last confirmed contact went down and the radio stopped reporting new movement. Nobody believed it right away — the instinct was to wait for the next transmission, the next district going dark. But it didn\'t come. The city held. Not cleanly, not without cost, but it held. The logs were reviewed for days afterward, trying to identify the decision that made the difference. Nobody could agree on which one it was. Society could begin to rebuild. For now.'

function checkLose() {
  if (state.won || state.lost) return
  const totalUnits = Object.keys(state.units).length
  if (totalUnits > 0) return

  state.lost = true
  if (tickInterval) clearInterval(tickInterval)

  document.getElementById('win-title').textContent        = 'ALL UNITS LOST'
  document.getElementById('win-ticks').textContent        = `${state.tick} TICKS`
  document.getElementById('win-time').textContent         = `DAY ${gameDay()} · ${gameTime()}`
  document.getElementById('btn-win-restart').textContent  = 'TRY AGAIN'
  document.getElementById('win-flavor').textContent       = LOSE_FLAVOR
  document.getElementById('win-overlay').classList.add('visible')
}

function checkWin() {
  if (state.won) return
  const totalZombies = Object.values(state.districts).reduce((sum, d) => sum + d.zombies, 0)
  if (totalZombies > 0) return

  state.won = true
  if (tickInterval) clearInterval(tickInterval)

  document.getElementById('win-ticks').textContent       = `${state.tick} TICKS`
  document.getElementById('win-time').textContent        = `DAY ${gameDay()} · ${gameTime()}`
  document.getElementById('btn-win-restart').textContent = 'PLAY AGAIN'
  document.getElementById('win-flavor').textContent      = WIN_FLAVOR
  document.getElementById('win-overlay').classList.add('visible')
}

function tick() {
  state.tick++

  // Snapshot humans before spread — needed to detect newly-overrun districts
  const prevHumans = {}
  for (const [id, d] of Object.entries(state.districts)) prevHumans[id] = d.humans

  // Local spread using suppressed rate
  for (const d of Object.values(state.districts)) {
    if (d.zombies === 0 || d.humans === 0) continue
    const rate = getEffectiveSpreadRate(d)
    const n = Math.floor(d.zombies * rate)
    if (n > 0) {
      d.zombies += n
      d.humans   = Math.max(0, d.humans - n)
    }
  }

  // Detect newly-overrun districts
  for (const [id, d] of Object.entries(state.districts)) {
    if (d.humans === 0 && prevHumans[id] > 0) {
      broadcastEvent(`${crackle()}[${d.label.toUpperCase()}] ${crackle()}SIGNAL LOST — district fallen.`)
    }
  }

  // Inter-district spread: units in source district can block
  if (Math.random() < spreadChance) {
    const sources = Object.keys(state.districts).filter(id => state.districts[id].zombies > 0)
    if (sources.length) {
      const src  = sources[Math.floor(Math.random() * sources.length)]
      const srcD = state.districts[src]
      const blockChance = Math.min(0.70, srcD.unitIds.length * 0.15)
      if (Math.random() >= blockChance) {
        const neighbors = adjacency[src].filter(id => state.districts[id].humans > 0)
        if (neighbors.length) {
          const spreadDest = neighbors[Math.floor(Math.random() * neighbors.length)]
          state.districts[spreadDest].zombies += 1
          broadcastEvent(`${crackle()}[${state.districts[spreadDest].label.toUpperCase()}] Movement detected — infected advancing.`)
        }
      }
    }
  }

  // Combat / activity resolution
  for (const [districtId, d] of Object.entries(state.districts)) {
    const districtUnits = unitsInDistrict(districtId)
    if (districtUnits.length === 0) continue

    // Scavenge phase — runs even in clear districts
    for (const unit of districtUnits) {
      if (unit.activity !== 'scavenge' || d.loot.length === 0) continue
      for (const person of personsInUnit(unit.id)) {
        if (d.loot.length === 0) break
        if (Math.random() < 0.40) {
          const found = d.loot.pop()
          person.items.push(found)
          broadcastEvent(`${crackle()}[${d.label.toUpperCase()}] ${person.name} — recovered ${ITEMS[found]?.name ?? found}.`)
        }
      }
    }

    if (d.zombies === 0) continue

    const persons = personsInDistrict(districtId)
    if (persons.length === 0) continue

    // Attack phase — engage units only; hide/scavenge and sim:false persons do not fight
    for (const unit of districtUnits) {
      if (unit.activity !== 'engage') continue
      for (const person of personsInUnit(unit.id)) {
        if (person.sim === false) continue
        if (d.zombies <= 0) break
        if (Math.random() < getHitChance(person)) {
          d.zombies = Math.max(0, d.zombies - 1)
        }
      }
    }

    // Counterattack — all units exposed; hiding units have reduced threat weight
    const dangerRatio   = d.zombies / (d.humans + d.zombies)
    const counterChance = dangerRatio * 0.40
    const numStrikes    = persons.length

    for (let i = 0; i < numStrikes; i++) {
      const alive = personsInDistrict(districtId)
      if (alive.length === 0) break
      if (Math.random() < counterChance) {
        const target = pickCounterTarget(alive)
        if (!target) break  // only scripted (sim:false) persons remain — no valid target
        target.health -= 10
        if (target.health <= 0) handlePersonDeath(target, districtId)
      }
    }

    // Medic phase — civilians with first-aid heal the most critical person
    const postCombat = personsInDistrict(districtId)
    const medics     = postCombat.filter(p => p.role === 'civilian' && p.items.includes('first-aid'))
    const needHeal   = postCombat.filter(p => p.health < 70 && p.health > 0).sort((a, b) => a.health - b.health)
    for (const medic of medics) {
      if (needHeal.length === 0) break
      const patient = needHeal.shift()
      patient.health = Math.min(100, patient.health + 30)
      medic.items.splice(medic.items.indexOf('first-aid'), 1)
    }

    if (d.zombies === 0) {
      broadcastEvent(`[${d.label.toUpperCase()}] — area clear. All contacts neutralized.`)
    }
  }

  // Rations — passive HP recovery for all carrying people, not consumed
  for (const person of Object.values(state.people)) {
    if (person.items.includes('rations') && person.health < 100) {
      person.health = Math.min(100, person.health + 5)
    }
  }

  director.tick()
  processNarrativeCallers()
  checkCallEvent()
  checkCallerSurvival()
  render()
  checkLose()
  checkWin()
}

// ── RENDERING ──

function render() {
  tickDisplay.textContent = state.started ? `TICK ${String(state.tick).padStart(3, '0')}` : '—'
  timeDisplay.textContent = `DAY ${gameDay()} · ${gameTime()}`
  updateRightPanel()
  renderUnitsPanel()
  renderUnitDots()
  renderContactsPanel()
  renderGodPanel()
  renderRadio()

  if (unitsPanel.dataset.view === 'unit-detail' && state.selectedUnit) {
    const { unitId } = state.selectedUnit
    const unit = state.units[unitId]
    if (!unit) { hideUnitDetail() }
    else        { renderUnitDetail(unit) }
  }

  if (contactsPanel.dataset.view === 'contact-detail' && state.selectedContact) {
    const contact = state.contacts.find(c => c.id === state.selectedContact)
    if (contact) {
      renderContactMessages(contact)
      renderContactMeta(contact)
    }
  }
}

const PORTRAIT_SVG = `<svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="30" cy="19" r="12" fill="rgba(8,8,10,0.45)"/>
  <path d="M8,72 Q8,44 30,40 Q52,44 52,72Z" fill="rgba(8,8,10,0.40)"/>
</svg>`

function renderUnitsPanel() {
  const units = Object.values(state.units)

  if (units.length === 0) {
    unitsList.innerHTML = '<div class="no-units">No active units</div>'
    return
  }

  const layout = document.getElementById('units-panel').dataset.cardLayout || 'expanded'
  if (layout === 'district') { renderUnitsByDistrict(units); return }

  unitsList.innerHTML = units.map(unit => {
    const leader  = state.people[unit.leaderPersonId]
    if (!leader) return ''
    const persons = personsInUnit(unit.id)
    const allItems = [...new Set(persons.flatMap(p => p.items))]
    const itemsHtml = allItems.map(k =>
      `<span class="roster-item-abbrev item-chip--${k}">${ITEM_ABBREV[k] ?? k}</span>`
    ).join('')

    const leaderWs  = woundState(leader)
    const nonLeaders = persons.filter(p => p.id !== unit.leaderPersonId)
    const membersRow = nonLeaders.length === 0
      ? `<div class="roster-alone">LONE OPERATOR</div>`
      : `<div class="roster-members-dots">${
          nonLeaders.map(p =>
            `<span class="member-dot member-dot--${p.role}" title="${p.name}"></span>`
          ).join('')
        }</div>`

    const activityBadge = `<span class="roster-activity roster-activity--${unit.activity}">${unit.activity.toUpperCase()}</span>`

    return `<div class="roster-card" draggable="true" data-unit-id="${unit.id}" data-district-id="${unit.districtId}">
      <div class="roster-portrait" data-role="${leader.role}">${PORTRAIT_SVG}</div>
      <div class="roster-card-body">
        <div class="roster-leader-name"><span class="leader-ws-star ws-${leaderWs}">★</span><span class="member-dot member-dot--${leader.role}"></span><span class="leader-name-text">${leader.name.replace(/^(\w)(\w+)\s/, '$1. ')}</span></div>
        <div class="roster-unit-label">${unit.label}${activityBadge}</div>
        ${membersRow}
        ${itemsHtml ? `<div class="roster-card-items">${itemsHtml}</div>` : ''}
      </div>
    </div>`
  }).join('')
}

function renderUnitsByDistrict(units) {
  const byDistrict = {}
  for (const unit of units) {
    if (!byDistrict[unit.districtId]) byDistrict[unit.districtId] = []
    byDistrict[unit.districtId].push(unit)
  }

  const sortedDistricts = Object.keys(byDistrict).sort((a, b) =>
    (state.districts[a]?.label ?? a).localeCompare(state.districts[b]?.label ?? b)
  )

  unitsList.innerHTML = sortedDistricts.map(districtId => {
    const d = state.districts[districtId]
    const rows = byDistrict[districtId].map(unit => {
      const leader  = state.people[unit.leaderPersonId]
      if (!leader) return ''
      const persons    = personsInUnit(unit.id)
      const allItems   = [...new Set(persons.flatMap(p => p.items))]
      const itemsHtml  = allItems.map(k =>
        `<span class="roster-item-abbrev item-chip--${k}">${ITEM_ABBREV[k] ?? k}</span>`
      ).join('')
      const leaderWs   = woundState(leader)
      const nonLeaders = persons.filter(p => p.id !== unit.leaderPersonId)
      const membersHtml = nonLeaders.length === 0
        ? `<span class="roster-alone">LONE OPERATOR</span>`
        : nonLeaders.map(p =>
            `<span class="member-dot member-dot--${p.role}" title="${p.name}"></span>`
          ).join('')

      return `<div class="roster-card roster-card--row" draggable="true" data-unit-id="${unit.id}" data-district-id="${districtId}">
        <div class="roster-row-top">
          <span class="leader-ws-star ws-${leaderWs}">★</span>
          <span class="member-dot member-dot--${leader.role}"></span>
          <span class="roster-row-name">${leader.name.replace(/^(\w)(\w+)\s/, '$1. ')}</span>
          <span class="roster-row-unit">${unit.label}</span>
          <span class="roster-activity roster-activity--${unit.activity}">${unit.activity.toUpperCase()}</span>
        </div>
        <div class="roster-row-bottom">
          <div class="roster-row-members">${membersHtml}</div>
          ${itemsHtml ? `<div class="roster-row-items">${itemsHtml}</div>` : ''}
        </div>
      </div>`
    }).join('')

    return `<div class="district-group">
      <div class="district-group-header">${d?.label ?? districtId}</div>
      ${rows}
    </div>`
  }).join('')
}

function renderUnitDots() {
  const dotsGroup = document.getElementById('unit-dots')
  if (!dotsGroup) return
  dotsGroup.innerHTML = ''

  for (const [districtId, d] of Object.entries(state.districts)) {
    const units = unitsInDistrict(districtId)
    if (units.length === 0) continue

    const poly = document.getElementById(districtId)
    if (!poly) continue

    const bbox   = poly.getBBox()
    const dotR   = 8
    const dotGap = 20
    const margin = 14

    units.forEach((unit, i) => {
      const leader = state.people[unit.leaderPersonId]
      if (!leader) return

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', bbox.x + margin + dotR + i * dotGap)
      circle.setAttribute('cy', bbox.y + bbox.height - margin)
      circle.setAttribute('r', dotR)
      circle.dataset.unitId = unit.id
      circle.classList.add('unit-map-dot', `unit-map-dot--${leader.role}`)
      dotsGroup.appendChild(circle)
    })
  }
}

function renderGodPanel() {
  const table = document.getElementById('god-table')
  if (!table) return

  if (!state.godMode) {
    table.innerHTML = '<div class="sitrep-no-access">— GOD MODE REQUIRED —</div>'
    return
  }

  const rows = Object.entries(state.districts)
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([id, d]) => {
      const total = d.humans + d.zombies
      const ratio = total > 0 ? d.zombies / total : 0
      let cls = 'clear'
      if (d.humans === 0)     cls = 'overrun'
      else if (ratio > 0.5)   cls = 'critical'
      else if (ratio > 0.15)  cls = 'danger'
      else if (d.zombies > 0) cls = 'infected'

      const spdValue   = (getEffectiveSpreadRate(d) * 100).toFixed(1) + '%'
      const spdLabel   = d.zombies > 0 ? spdValue : '—'
      const suppressed = d.zombies > 0 && d.unitIds.length > 0

      const lootHtml = d.loot
        .map(k => `<div class="gsr-chip item-chip--${k}">
            <span class="gsr-chip-abbrev">${ITEM_ABBREV[k]}</span>
            <span class="gsr-chip-name">${ITEMS[k]?.name ?? k}</span>
          </div>`)
        .join('')

      const persons = state.contacts
        .filter(c => c.location === id && c.alive)
        .map(c => c.name)
        .join(', ')

      return `<div class="gsr-block gsr-block--${cls}">
        <div class="gsr-card-name">${d.label}</div>
        <div class="gsr-card-stats">
          <div class="gsr-stat">
            <span class="gsr-stat-lbl">HUM</span>
            <span class="gsr-stat-val">${d.humans.toLocaleString()}</span>
          </div>
          <div class="gsr-stat">
            <span class="gsr-stat-lbl">ZOM</span>
            <span class="gsr-stat-val gsr-inf ${cls}">${d.zombies.toLocaleString()}</span>
          </div>
          <div class="gsr-stat">
            <span class="gsr-stat-lbl">SPD</span>
            <span class="gsr-stat-val${suppressed ? ' suppressed' : ''}">${spdLabel}</span>
          </div>
        </div>
        ${lootHtml ? `<div class="gsr-loot">${lootHtml}</div>` : ''}
        ${persons   ? `<div class="gsr-persons">${persons}</div>` : ''}
      </div>`
    }).join('')

  table.innerHTML = rows
}

// Dispatch toolbar — EXPANDED / CONDENSED switcher
document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel  = document.getElementById('units-panel')
    const layout = btn.dataset.layout
    panel.dataset.cardLayout = layout
    document.querySelectorAll('.layout-btn').forEach(b =>
      b.classList.toggle('layout-btn--active', b.dataset.layout === layout)
    )
  })
})

document.getElementById('btn-win-restart').addEventListener('click', () => location.reload())
document.getElementById('btn-reset-ui').addEventListener('click', resetLayout)

document.getElementById('btn-test-win').addEventListener('click', () => {
  if (state.won || state.lost) return
  state.won = true
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  document.getElementById('win-ticks').textContent       = `${state.tick} TICKS`
  document.getElementById('win-time').textContent        = `DAY ${gameDay()} · ${gameTime()}`
  document.getElementById('btn-win-restart').textContent = 'PLAY AGAIN'
  document.getElementById('win-title').textContent       = 'OUTBREAK CONTAINED'
  document.getElementById('win-flavor').innerHTML        = `<span class="win-override-notice">[Dispatcher override — outcome forced for testing.]</span>${WIN_FLAVOR}`
  document.getElementById('win-overlay').classList.add('visible')
})

document.getElementById('btn-test-lose').addEventListener('click', () => {
  if (state.won || state.lost) return
  state.lost = true
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  document.getElementById('win-title').textContent       = 'ALL UNITS LOST'
  document.getElementById('win-ticks').textContent       = `${state.tick} TICKS`
  document.getElementById('win-time').textContent        = `DAY ${gameDay()} · ${gameTime()}`
  document.getElementById('btn-win-restart').textContent = 'TRY AGAIN'
  document.getElementById('win-flavor').innerHTML        = `<span class="win-override-notice">[Dispatcher override — outcome forced for testing.]</span>${LOSE_FLAVOR}`
  document.getElementById('win-overlay').classList.add('visible')
})

// ── START SCREEN ──

const customCounts = {}
Object.keys(state.districts).forEach(id => customCounts[id] = 0)

const presetSelect   = document.getElementById('preset-select')
const customZoneGrid = document.getElementById('custom-zone-grid')

function renderCustomGrid() {
  customZoneGrid.innerHTML = Object.entries(state.districts)
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([id, d]) => `
      <div class="zone-row">
        <span class="zone-row-name">${d.label}</span>
        <div class="zone-controls">
          <button class="zone-btn" data-id="${id}" data-action="dec">−</button>
          <span class="zone-count" id="zc-${id}">${customCounts[id]}</span>
          <button class="zone-btn" data-id="${id}" data-action="inc">+</button>
        </div>
      </div>`)
    .join('')
}
renderCustomGrid()

customZoneGrid.addEventListener('click', e => {
  const btn = e.target.closest('.zone-btn')
  if (!btn) return
  const id  = btn.dataset.id
  if (btn.dataset.action === 'inc') customCounts[id] = Math.min(99, customCounts[id] + 1)
  if (btn.dataset.action === 'dec') customCounts[id] = Math.max(0,  customCounts[id] - 1)
  document.getElementById(`zc-${id}`).textContent = customCounts[id]
})

presetSelect.addEventListener('change', () => {
  if (presetSelect.value === 'custom') {
    const defaultSeed = PRESETS['default']?.seed ?? {}
    Object.keys(customCounts).forEach(id => { customCounts[id] = defaultSeed[id] ?? 0 })
    renderCustomGrid()
  }
  customZoneGrid.classList.toggle('visible', presetSelect.value === 'custom')
})

document.getElementById('spread-dec').addEventListener('click', () => {
  spreadChance = Math.max(0.05, Math.round((spreadChance - 0.05) * 100) / 100)
  document.getElementById('spread-val').textContent = Math.round(spreadChance * 100)
})

document.getElementById('spread-inc').addEventListener('click', () => {
  spreadChance = Math.min(0.80, Math.round((spreadChance + 0.05) * 100) / 100)
  document.getElementById('spread-val').textContent = Math.round(spreadChance * 100)
})

function startGame() {
  state.started = true
  const value = presetSelect.value
  if (value === 'custom') {
    Object.entries(customCounts).forEach(([id, n]) => {
      if (n > 0) state.districts[id].zombies = n
    })
  } else {
    const seed = PRESETS[value]?.seed ?? {}
    Object.entries(seed).forEach(([id, n]) => { state.districts[id].zombies = n })
  }
  document.getElementById('start-screen').classList.remove('visible')
  tickInterval = setInterval(tick, TICK_MS)
}

document.getElementById('btn-start').addEventListener('click', startGame)

// ── Map palette switcher ──

const MAP_PALETTES = {
  dusty: {
    '--map-panel-bg':  'transparent',
    '--map-label':     'rgba(40,30,25,0.85)',
    '--map-label-sub': 'rgba(40,30,25,0.55)',
    '--col-res': '#CEB3A8', '--col-res-h': '#BFA299',
    '--col-gov': '#d3e0f5', '--col-gov-h': '#b8c8e0',
    '--col-med': '#d3f5bf', '--col-med-h': '#b8dda0',
    '--col-ret': '#fcf4b6', '--col-ret-h': '#e4dc90',
    '--col-ind': '#f3dcfc', '--col-ind-h': '#dbc4e4',
  },
  paper: {
    '--map-panel-bg':  'transparent',
    '--map-label':     'rgba(35,25,20,0.85)',
    '--map-label-sub': 'rgba(35,25,20,0.55)',
    '--col-res': '#E0BAA5', '--col-res-h': '#D1A792',
    '--col-gov': '#AADAEB', '--col-gov-h': '#99CADB',
    '--col-med': '#B4E1C4', '--col-med-h': '#A2D1B2',
    '--col-ret': '#DACCE3', '--col-ret-h': '#C8BBD1',
    '--col-ind': '#F0C8CE', '--col-ind-h': '#E6B4BB',
  }
}

function setMapPalette(key) {
  const palette = MAP_PALETTES[key]
  if (!palette) return
  const root = document.documentElement
  Object.entries(palette).forEach(([prop, val]) => root.style.setProperty(prop, val))
}

document.getElementById('map-palette-select').addEventListener('change', e => {
  setMapPalette(e.target.value)
})

const mapPaletteSelect = document.getElementById('map-palette-select')
mapPaletteSelect.value = 'paper'
setMapPalette('paper')

render()

// Dev: expose internals to window for console/preview debugging
Object.assign(window, { state, tick, director, gameTime, gameDay, NARRATIVE_SCRIPTS, when, triggerToCondition, dispatchUnit, handlePersonDeath, disbandUnit })
