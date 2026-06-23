import eNovak    from './scripts/e-novak.js'
import marcusWebb from './scripts/marcus-webb.js'
import danny      from './scripts/danny.js'
import holt       from './scripts/holt.js'
import tutorial   from './scripts/tutorial.js'

// ── CONFIG & CONSTANTS ──

const TICK_MS       = 3000
const SPREAD_RATE   = 0.15  // SIR β — transmission coefficient, not per-zombie rate
let spreadChance = 0.35
const ROLES = ['police', 'fire', 'civilian']
const UNIT_TICKS_PER_HOP   = 2  // vehicle-fast
const PERSON_TICKS_PER_HOP = 6  // on-foot, reserved for future caller Outside-travel — unused for now

// ── GAME CLOCK ──
const GAME_START_HOUR = 20  // game world begins at 20:00 (night shift) Day 1
const GAME_START_DAY  = 1
const MINS_PER_TICK   = 1   // each tick advances game clock by 1 minute

const DIFFICULTIES = {
  standard: {
    numDistricts: 3,
    totalZombies: 12,
    distribution: 'even',   // 'even' | 'linear' | 'all-in-one'
    spreadChance: 0.35,
    delay:        0,        // reserved: ticks before first zombie placement
  },
  apocalypse: {
    // TODO: tune harder once the rest of the game is built out — mirrors standard for now
    numDistricts: 3,
    totalZombies: 12,
    distribution: 'even',
    spreadChance: 0.35,
    delay:        0,
  },
}

let tickInterval = null
let gamePaused   = false

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

const ITEM_ABBREV = { 'gun': 'GUN', 'fire-axe': 'AXE', 'first-aid': 'AID', 'radio': 'RAD', 'rations': 'FOOD', 'binoculars': 'BNO' }

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
    location:   opts.location   ?? 'business',  // outside | business | residence — exposure modifier
    activity:   opts.activity   ?? 'default',   // hide | default | scavenge — exposure modifier
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
  lastActivityTick: 0,
})

// Every message push goes through here so "most recent activity" (used to sort the contacts
// list) has one source of truth instead of relying on parsing the display-formatted `time`
// string, which can't be compared across a day rollover.
function pushMessage(contact, msg) {
  contact.messages.push(msg)
  contact.lastActivityTick = state.tick
}

const CALLER_POOL = [
  'Unknown Caller',
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
  [eNovak, marcusWebb, danny, holt, tutorial].map(s => [s.id, s])
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
    //         'player-callback' { contactId, tick } — fired by the CALL BACK button; no
    //                             handler is wired by default, so nothing happens beyond the
    //                             "No response." message main.js always appends itself.
    on(event, handler) {
      ;(_handlers[event] ??= []).push(handler)
    },

    emit(event, payload) {
      for (const h of (_handlers[event] ?? [])) h(state, payload)
    },
  }
})()

// Generalized contact-closing: any caller (ambient or scripted) whose backing Person dies for
// real goes dark the same way an authored `resolve: 'lost'` node does. No-ops for unit-member
// deaths (no matching contact).
director.on('person-death', (s, { person }) => {
  const contact = s.contacts.find(c => c.personId === person.id)
  if (!contact || !contact.alive) return
  contact.alive  = false
  contact.status = 'dead'
  pushMessage(contact, { text: '[contact lost]', time: gameTime() })
  contact.unread = true
  if (s.selectedContact === contact.id) {
    renderContactMessages(contact)
    renderContactMeta(contact)
    updatePhoneIcon(contact)
  }
})

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
// Scripts with no `trigger` (e.g. the tutorial) are spawned directly by code instead —
// Director.tick() never runs before state.started anyway, so condition-polling them
// would be a no-op at best.

Object.values(NARRATIVE_SCRIPTS).forEach(script => {
  if (!script.trigger) return
  director.register({
    id:        script.id,
    once:      script.once ?? true,
    condition: triggerToCondition(script.trigger),
    trigger:   () => spawnScript(script.id),
  })
})

// Every call but Barbara's opens with the dispatcher's own line first, then a beat of
// "..." before the caller answers — same reply-delay mechanic as a chosen response. This
// only fires the first time the player actually opens a contact's thread (see
// maybeFireFirstOpen, called from showContactDetail) — not at creation, so a caller sitting
// unopened in the list hasn't "spoken" yet and the player can't drop in mid-exchange. Existing
// contacts calling back skip straight to their line (see checkCallEvent's isNewContact branch).
const DISPATCH_OPENER = '911, what is your emergency?'

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

  if (scriptId === 'tutorial') {
    advanceNarrativeCaller(contact, 0)
  }
  // Everyone else waits for the player to open the thread — see maybeFireFirstOpen.
  renderContactsPanel()
}

// Fires the dispatcher's opener + reply-delay the first time (and only the first time) a
// contact's thread is opened — before this, the contact has no messages and hasn't "spoken."
// Guarded on pendingNext too, not just messages.length, so backing out before the delay
// resolves and reopening doesn't re-fire a second opener on top of the one already queued.
function maybeFireFirstOpen(contact) {
  if (contact.type === 'narrative' && contact.scriptId === 'tutorial') return
  if (contact.messages.length > 0 || contact.pendingNext !== null) return

  pushMessage(contact, { text: DISPATCH_OPENER, time: gameTime(), sender: 'player' })
  contact.replyDelay = 2 + Math.floor(Math.random() * 3)

  if (contact.type === 'narrative') {
    contact.pendingNext = 0
    return
  }

  // Ambient: resolve the report fresh, against current district state rather than whatever
  // was true back when checkCallEvent first spawned this contact — could be many ticks ago.
  const reportDist = (contact.location && state.districts[contact.location])
    ? state.districts[contact.location]
    : state.districts[contact.reportDistrictId] ?? Object.values(state.districts).find(d => d.zombies > 0)
  const pool = CALL_TEMPLATES[getCallTier(reportDist?.zombies ?? 0)]
  contact.pendingNext = pool[Math.floor(Math.random() * pool.length)](reportDist ?? { label: 'the area' })
}

function advanceNarrativeCaller(contact, nodeId) {
  const script = NARRATIVE_SCRIPTS[contact.scriptId]
  if (!script) return
  const node = script.nodes[nodeId]
  if (!node) return

  contact.phase = nodeId
  contact.timer = node.timer ?? null

  if (node.text) {
    pushMessage(contact, { text: resolveText(node.text), time: gameTime(), sender: 'npc' })
    contact.unread = true
  }

  if (node.onEnter) node.onEnter(state, SCRIPT_ACTIONS)

  if (node.resolve === 'lost') {
    contact.alive  = false
    contact.status = 'dead'
    // Remove the scripted Person from the sim — they're story-dead now
    if (contact.personId) {
      delete state.people[contact.personId]
      contact.personId = null
    }
    pushMessage(contact, { text: '[contact lost]', time: gameTime() })
    contact.unread = true
  } else if (node.resolve === 'waiting') {
    contact.status = 'waiting'
    contact.timer  = null
  }

  if (state.selectedContact === contact.id) {
    renderContactMessages(contact)
    renderContactMeta(contact)
    updatePhoneIcon(contact)
  }
}

function processNarrativeCallers() {
  let advanced = false
  for (const contact of state.contacts) {
    // Pending reply: either the player chose (narrative) or this is a fresh call's opening
    // beat (any contact type) — waiting for the other end to "type back".
    if (contact.pendingNext !== null) {
      contact.replyDelay--
      if (contact.replyDelay <= 0) {
        const next = contact.pendingNext
        contact.pendingNext = null
        if (contact.type === 'narrative') {
          advanceNarrativeCaller(contact, next)
        } else {
          pushMessage(contact, { text: next, time: gameTime(), sender: 'npc' })
          contact.unread = true
          if (state.selectedContact === contact.id) renderContactMessages(contact)
        }
        advanced = true
      }
      continue
    }

    if (contact.type !== 'narrative') continue
    if (contact.timer === null) continue
    contact.timer--
    if (contact.timer <= 0) {
      const script = NARRATIVE_SCRIPTS[contact.scriptId]
      const node   = script?.nodes[contact.phase]
      if (node?.timerNext != null) {
        advanceNarrativeCaller(contact, node.timerNext)
        advanced = true
      }
    }
  }
  // Normally caught by tick()'s render() loop, but that's gated on state.started — this interval
  // runs unconditionally (e.g. the pre-game tutorial), so it has to refresh the list itself.
  if (advanced) renderContactsPanel()
}

// ── PERSON / UNIT HELPERS ──

function unitsInDistrict(districtId) {
  return (state.districts[districtId]?.unitIds ?? []).map(id => state.units[id]).filter(Boolean)
}

function personsInUnit(unitId) {
  return (state.units[unitId]?.personIds ?? []).map(id => state.people[id]).filter(Boolean)
}

function personsInDistrict(districtId) {
  const unitMembers = unitsInDistrict(districtId).flatMap(u => personsInUnit(u.id))
  const standalone = Object.values(state.people).filter(p =>
    !p.unitId && p.districtId === districtId && p.sim !== false)
  return [...unitMembers, ...standalone]
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
    const wasLeader = unit.leaderPersonId === person.id
    if (wasLeader) unit.leaderPersonId = unit.personIds[0] ?? null
    if (unit.personIds.length === 0) {
      disbandUnit(unit.id, districtId)
    } else if (wasLeader) {
      const newLeader = state.people[unit.leaderPersonId]
      showAlert('LEADER DOWN', `${person.name} (${unit.label}) is KIA. ${newLeader?.name ?? 'Unit personnel'} has assumed command at ${d?.label ?? 'unknown location'}.`)
    }
  }
  director.emit('person-death', { person, districtId })
  delete state.people[person.id]
  broadcastEvent(unit
    ? `[${d.label.toUpperCase()}] UNIT DOWN — no further contact.`
    : `[${d.label.toUpperCase()}] CONTACT LOST — no further transmission.`)
}

function disbandUnit(unitId, districtId) {
  const d = state.districts[districtId]
  if (d) d.unitIds = d.unitIds.filter(id => id !== unitId)
  state.unitsLost++
  director.emit('unit-disbanded', { unitId, districtId })
  delete state.units[unitId]
}

// ── COMBAT & UTILITIES ──

const THREAT_MOD    = { police: 3, fire: 2, civilian: 1 }
const LOCATION_MOD  = { outside: 1.5, business: 1.0, residence: 0.5 }
const ACTIVITY_MOD  = { engage: 1.0, default: 1.0, hide: 0.3, scavenge: 1.3 }

function getHitChance(person) {
  const base = person.items.includes('gun')      ? 0.50
             : person.items.includes('fire-axe') ? 0.25
             : 0.10
  const ws = woundState(person)
  if (ws === 'wounded')  return base * 0.80
  if (ws === 'critical') return base * 0.40
  return base
}

// Exposure = role weight × Location × Activity. Units are implicitly Outside (they operate
// across the whole district, no fixed location) — their existing activity multiplies on top.
// Standalone Persons (callers) use their own location/activity fields.
function effectiveThreatMod(person) {
  const base = THREAT_MOD[person.role] ?? THREAT_MOD.civilian
  const unit = state.units[person.unitId]
  if (unit) return base * LOCATION_MOD.outside * (ACTIVITY_MOD[unit.activity] ?? 1.0)
  const locMod = LOCATION_MOD[person.location] ?? LOCATION_MOD.business
  const actMod = ACTIVITY_MOD[person.activity] ?? ACTIVITY_MOD.default
  return base * locMod * actMod
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
// Used by Director beats: condition: () => state.tick >= ticksFor(21) means "at or after 21:00".
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
  unitsLost:       0,
  godMode:         false,
  selected:        null,
  selectedUnit:    null,
  selectedContact: null,
  contacts:        [],
  people:          {},
  units:           {},
  transits:        [],
  districts: {
    'northgate':    { label: 'Joyland',                 category: 'residential', humans: 1000, zombies: 0, unitIds: [], loot: rollLoot('northgate',    'residential', 2) },
    'millbrook':    { label: 'Winburn',                 category: 'residential', humans: 1000, zombies: 0, unitIds: [], loot: rollLoot('millbrook',    'residential', 2) },
    'eastridge':    { label: 'Castlewood',              category: 'residential', humans: 1200, zombies: 0, unitIds: [], loot: rollLoot('eastridge',    'residential', 2) },
    'westgate':     { label: 'University of Kentucky',  category: 'government',  humans: 900,  zombies: 0, unitIds: [], loot: rollLoot('westgate',     'government', 1) },
    'police-hq':    { label: 'LPD HQ',                  category: 'government',  humans: 80,   zombies: 0, unitIds: [], loot: rollLoot('police-hq',    'government',  3) },
    'fire-station': { label: 'Station No. 1',           category: 'government',  humans: 60,   zombies: 0, unitIds: [], loot: rollLoot('fire-station', 'government',  3) },
    'city-hall':    { label: 'LFUCG Govt Center',       category: 'government',  humans: 200,  zombies: 0, unitIds: [], loot: rollLoot('city-hall',    'government',  2) },
    'memorial':     { label: 'Good Samaritan Hospital', category: 'medical',     humans: 600,  zombies: 0, unitIds: [], loot: rollLoot('memorial',     'medical',     4) },
    'ironworks':    { label: 'Old Iron Works',          category: 'industrial',  humans: 380,  zombies: 0, unitIds: [], loot: rollLoot('ironworks',    'industrial',  2) },
    'riverside':    { label: 'Kendrick Ave',            category: 'residential', humans: 1100, zombies: 0, unitIds: [], loot: rollLoot('riverside',    'residential', 2) },
    'market':       { label: 'Market St',               category: 'retail',      humans: 700,  zombies: 0, unitIds: [], loot: rollLoot('market',       'retail',      3) },
    'commerce':     { label: 'Newtown Commerce',        category: 'retail',      humans: 650,  zombies: 0, unitIds: [], loot: rollLoot('commerce',     'retail',      2) },
    'southend':     { label: 'The Red Mile',            category: 'retail',      humans: 950,  zombies: 0, unitIds: [], loot: rollLoot('southend',     'retail', 2) },
    'industrial':   { label: 'Lexington Quarry',        category: 'industrial',  humans: 400,  zombies: 0, unitIds: [], loot: rollLoot('industrial',   'industrial',  2) },
  }
}

// Spawn starting units and people
let _unitCounter = 0

;(function initStartingUnits() {
  // members: [{ role, items }, ...] — first entry is the leader
  function spawnUnit(districtId, members) {
    const label   = `Unit ${++_unitCounter}`
    const persons = members.map(({ role, items }) => makePerson(nextPersonName(role), role, items))
    const unit    = makeUnit(label, districtId, persons.map(p => p.id))
    persons.forEach(p => { p.unitId = unit.id; state.people[p.id] = p })
    state.units[unit.id] = unit
    state.districts[districtId].unitIds.push(unit.id)
  }

  // Police HQ — 2 units: 2 police + 1 embedded civilian
  spawnUnit('police-hq', [
    { role: 'police',   items: ['gun']       },
    { role: 'police',   items: ['gun']       },
    { role: 'civilian', items: ['radio']     },
  ])
  spawnUnit('police-hq', [
    { role: 'police',   items: ['gun']       },
    { role: 'police',   items: ['gun']       },
    { role: 'civilian', items: ['first-aid'] },
  ])

  // Fire Station — 2 units: 2 fire + 1 embedded civilian
  spawnUnit('fire-station', [
    { role: 'fire',     items: ['fire-axe']  },
    { role: 'fire',     items: ['fire-axe']  },
    { role: 'civilian', items: ['first-aid'] },
  ])
  spawnUnit('fire-station', [
    { role: 'fire',     items: ['fire-axe']  },
    { role: 'fire',     items: ['fire-axe']  },
    { role: 'civilian', items: ['radio']     },
  ])

  // City Hall — 2 units: 2 civilian + 1 police for protection
  spawnUnit('city-hall', [
    { role: 'civilian', items: ['first-aid', 'radio'] },
    { role: 'civilian', items: ['first-aid']          },
    { role: 'police',   items: ['gun']                },
  ])
  spawnUnit('city-hall', [
    { role: 'civilian', items: ['radio']   },
    { role: 'civilian', items: ['rations'] },
    { role: 'police',   items: ['gun']     },
  ])
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

function computeHopDistances(graph) {
  const dist = {}
  for (const start of Object.keys(graph)) {
    dist[start] = { [start]: 0 }
    const queue = [start]
    while (queue.length) {
      const cur = queue.shift()
      const d = dist[start][cur]
      for (const next of graph[cur] || []) {
        if (dist[start][next] === undefined) { dist[start][next] = d + 1; queue.push(next) }
      }
    }
  }
  return dist
}
const HOP_DISTANCE = computeHopDistances(adjacency)
const hopsBetween = (a, b) => HOP_DISTANCE[a]?.[b] ?? 1

let _transitCounter = 0

const DISTRICT_CODE = {
  'northgate': 'JL', 'millbrook': 'WB', 'eastridge': 'CW', 'westgate': 'UK',
  'police-hq': 'PD', 'fire-station': 'S1', 'city-hall': 'GC', 'memorial': 'GS',
  'ironworks': 'IW', 'riverside': 'KA', 'market': 'MK', 'commerce': 'NC',
  'southend': 'RM', 'industrial': 'LQ',
}

// ── INIT ──


// ── DOM REFS ──

const godBtn      = document.getElementById('btn-god-mode')
const tickDisplay = document.getElementById('tick-display')
const timeDisplay = document.getElementById('time-display')
const mapContainer  = document.getElementById('map-container')
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
const btnCdvCallback = document.getElementById('btn-cdv-callback')
const idvName     = document.getElementById('idv-name')
const idvDesc     = document.getElementById('idv-description')
const btnIdvBack  = document.getElementById('btn-idv-back')

// ── WINDOW MANAGER ──

const WIN_IDS = ['dispatch', 'map', 'contacts', 'radio', 'sitrep', 'items', 'alert']
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
    alert:    { x: Math.floor((dw - 380) / 2), y: Math.floor((dh - 180) / 2), w: 380, h: 180 },
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

    titlebar.addEventListener('dblclick', e => { if (id !== 'alert' && !e.target.closest('.win-btn')) toggleMaximize(id) })

    // Remove old single-corner resize, add full 8-edge resize handles
    const oldResize = winEl.querySelector('.win-resize')
    if (oldResize) oldResize.remove()
    for (const dir of ['n','ne','e','se','s','sw','w','nw']) {
      const edge = document.createElement('div')
      edge.className = `win-edge win-edge--${dir}`
      edge.addEventListener('mousedown', e => startResize(id, dir, e))
      winEl.appendChild(edge)
    }

    // Generate window controls — order: PIN | MIN | MAX | CLOSE.
    // The InfoBox (alert window) is the one exception — it gets a minimal,
    // state-driven header instead (see renderAlertControls), not this set.
    if (id === 'alert') continue
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

  // Shared by taskbar buttons and desktop icons: minimized → restore, already-focused → minimize
  // (closing it back to desktop), otherwise bring to front.
  function focusOrToggleWindow(id) {
    if (winState[id].minimized) { toggleMinimize(id) }
    else if (_activeWin === id)  { toggleMinimize(id) }
    else                         { bringToFront(id) }
  }

  document.querySelectorAll('.task-btn, .desktop-icon').forEach(btn => {
    btn.addEventListener('click', () => focusOrToggleWindow(btn.dataset.win))
  })

  // Every window starts minimized — bare desktop (badge + icons) is the first thing the player
  // sees. The tutorial script reveals panels one at a time; skipping it reveals them all at once
  // via resetLayout() inside startGame(). Nothing is "default focused" until something is shown.
  for (const id of WIN_IDS) {
    winState[id].minimized = true
    document.getElementById(`win-${id}`).classList.add('win-minimized')
  }

  // Alert starts pinned so it can't be accidentally dragged
  winState.alert.pinned = true
  winState.alert.required = false
  renderAlertControls()

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
    renderDistrictDetail()
  }
  syncTaskbar()
}

// ── RADIO / COMMS ──

const RADIO_MAX = 10
const RADIO_TTL = 10
const STATIC_TAGS = ['[wzzt]', '[szzt]', '[krrk]', '[fssh]']
let radioFeed = []

function crackle() {
  return Math.random() < 0.45 ? STATIC_TAGS[Math.floor(Math.random() * STATIC_TAGS.length)] + ' ' : ''
}

function broadcastEvent(text) {
  if (!state.started) return
  radioFeed.unshift({ text, tick: state.tick, time: gameTime(), sep: Math.random() < 0.35 })
  radioFeed = radioFeed.filter(m => state.tick - m.tick < RADIO_TTL)
  if (radioFeed.length > RADIO_MAX) radioFeed.length = RADIO_MAX
  renderRadio()
}

const RADIO_STATIC_SEPS = ['[krrk]', '[szzt]', '[fssh]', '[wzzt]']

function renderRadio() {
  const feed = document.getElementById('radio-feed')
  if (!feed) return
  feed.innerHTML = radioFeed.map((m, i) => {
    const locMatch = m.text.match(/^\[([^\]]+)\]\s*(.*)$/)
    const location = locMatch ? locMatch[1] : null
    const body     = locMatch ? locMatch[2] : m.text
    const locHtml  = location ? `<span class="radio-location">[${location}]</span>` : ''
    const sep      = i < radioFeed.length - 1 && m.sep
      ? `<div class="radio-sep">${RADIO_STATIC_SEPS[i % RADIO_STATIC_SEPS.length]}</div>`
      : ''
    return `<div class="radio-msg"><span class="radio-time">[${m.time}]</span>${locHtml}<span class="radio-body">${body}</span></div>${sep}`
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

// ── WINDOW-MANAGER SCRIPTING API ──
// Lets a narrative script's onEnter side effect puppet the UI (panel spotlight, etc.)
// without reaching into window-manager internals directly.

function closeWindow(id)    { toggleMinimize(id) }
function minimizeWindow(id) { toggleMinimize(id) }
function maximizeWindow(id) { toggleMaximize(id) }

// Guaranteed-visible, unlike the toggle-based three above — every window now starts minimized,
// so the tutorial (or skipping it) is what reveals them. Safe to call on an already-visible window.
function revealWindow(id) {
  if (winState[id].minimized) toggleMinimize(id)
  else bringToFront(id)
}

function setWindowPosition(id, x, y) {
  const ws = winState[id]
  if (!ws) return
  ws.x = x; ws.y = y
  clampWin(id)
  applyWinGeometry(id)
}

// `value` is visibility, 1.0 = fully clear, 0.0 = fully obscured. Implemented as a black overlay
// layered over just the window's body (not the titlebar), so a dimmed window still reads as a
// solid, present frame — like someone dimmed the lights, not like the window turned see-through.
function setWindowOpacity(id, value) {
  const body = document.getElementById(`win-${id}`)?.querySelector('.win-body')
  if (!body) return
  let overlay = body.querySelector('.win-dim-overlay')
  if (value >= 1) {
    overlay?.remove()
    return
  }
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'win-dim-overlay'
    body.appendChild(overlay)
  }
  overlay.style.opacity = 1 - value
}

// Dims every window except `id` to make it stand out — the panel-highlight mechanic
// design.md's Onboarding section calls for.
function spotlightWindow(id) {
  for (const winId of WIN_IDS) setWindowOpacity(winId, winId === id ? 1.0 : 0.1)
}

function clearSpotlight() {
  for (const winId of WIN_IDS) setWindowOpacity(winId, 1.0)
}

// Capability object handed to a script node's onEnter(state, actions) — scripts are plain data
// modules with no import access to main.js internals, so this is how they reach window-manager
// and game-flow functions without a cross-module import.
const SCRIPT_ACTIONS = {
  closeWindow, minimizeWindow, maximizeWindow, revealWindow, setWindowPosition, setWindowOpacity,
  spotlightWindow, clearSpotlight, bringToFront, showAlert, startGame,
}

function syncTaskbar() {
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.classList.toggle('win-minimized', winState[btn.dataset.win].minimized)
  })
}

// ── ALERT / INFOBOX SYSTEM ──
// The alert window doubles as a generic InfoBox: showAlert(title, body) covers the simple
// one-off case (LEADER DOWN, UNIT DISBANDED — title text, dismissible by X/click-outside/Escape).
// Passing { required: true } turns it into a blocking box with no X and no outside-dismiss —
// the only way out is for something inside `body`'s own markup to call dismissAlert() itself
// once its action completes (see the login box). dismissAlert() always works when called
// directly; it's only the three *external* dismiss triggers that respect `required`.

const alertWinTitle = document.getElementById('alert-win-title')
const alertMessage  = document.getElementById('alert-message')

function renderAlertControls() {
  const controls = document.getElementById('win-alert').querySelector('.win-controls')
  if (winState.alert.required) {
    controls.innerHTML = ''
  } else {
    controls.innerHTML = `<button class="win-btn win-close-btn">×</button>`
    controls.querySelector('.win-close-btn').addEventListener('click', dismissAlert)
  }
}

function _onAlertClickOutside(e) {
  if (winState.alert?.required) return
  if (!document.getElementById('win-alert').contains(e.target)) dismissAlert()
}

function showAlert(title, body, opts = {}) {
  const { required = false } = opts
  alertWinTitle.textContent = title
  alertMessage.innerHTML = `<div class="alert-body">${body}</div>`
  winState.alert.required = required
  renderAlertControls()
  if (winState.alert?.minimized) toggleMinimize('alert')
  bringToFront('alert')
  document.removeEventListener('click', _onAlertClickOutside, true)
  if (!required) setTimeout(() => document.addEventListener('click', _onAlertClickOutside, true), 0)
}

function dismissAlert() {
  if (!winState.alert?.minimized) toggleMinimize('alert')
  document.removeEventListener('click', _onAlertClickOutside, true)
}

document.addEventListener('keydown', e => {
  if (winState.alert?.required) return
  if (e.key === 'Escape' && !winState.alert?.minimized) dismissAlert()
})

// ── LOGIN ──
// First required InfoBox the player ever sees — appears the instant the desktop is revealed,
// before CONTACTS, before any script. Stores the name to sessionStorage and hands off via
// onDone once submitted; nothing else is wired to this name yet (see todo.md's name-interpolation
// item — that's a separate piece, this just captures and stores it).

function getPlayerName() {
  return sessionStorage.getItem('playerName') ?? ''
}

// Generic token substitution for script node text — {{name}} today, more tokens can join
// later without touching call sites.
function resolveText(text) {
  return text.replace(/\{\{name\}\}/g, getPlayerName() || 'Dispatcher')
}

function showLoginBox(onDone) {
  showAlert('LOG IN', `
    <div class="login-prompt-text">Sign in to start your shift.</div>
    <div class="login-row">
      <input type="text" id="login-name-input" class="login-name-input" autocomplete="off" maxlength="40" placeholder="Your name">
      <button class="choice-btn" id="login-submit-btn">LOG IN</button>
    </div>
  `, { required: true })

  const input = document.getElementById('login-name-input')
  const submit = () => {
    const name = input.value.trim()
    if (!name) return
    sessionStorage.setItem('playerName', name)
    dismissAlert()
    onDone()
  }
  document.getElementById('login-submit-btn').addEventListener('click', submit)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  input.focus()
}

director.on('unit-disbanded', ({ unitId, districtId }) => {
  const d = state.districts[districtId]
  showAlert(
    'UNIT DISBANDED',
    `All personnel lost at ${d?.label ?? districtId}. The district has been left unprotected.`
  )
})

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
  renderDistrictDetail()
})

function syncGodBtn() {
  godBtn.textContent = 'SITREP'
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
  if (state.selected) {
    const prev = document.getElementById(state.selected)
    if (prev) prev.classList.remove('selected')
  }

  if (state.selected === id) {
    state.selected = null
    delete mapContainer.dataset.view
    return
  }

  state.selected = id
  const poly = document.getElementById(id)
  if (poly) poly.classList.add('selected')
  mapContainer.dataset.view = 'district'
  renderDistrictDetail()
}

function getDistrictStatus(d) {
  const total = d.humans + d.zombies
  if (total === 0 || d.zombies === 0) return { label: 'CLEAR',   cls: 'ddv-status--clear' }
  const ratio = d.zombies / total
  if (ratio < 0.35)              return { label: 'LIGHT',   cls: 'ddv-status--light' }
  if (ratio < 0.75)              return { label: 'HEAVY',   cls: 'ddv-status--heavy' }
  return                                { label: 'OVERRUN', cls: 'ddv-status--overrun' }
}

function renderDistrictDetail() {
  if (!state.selected) return
  const d = state.districts[state.selected]
  if (!d) return

  document.getElementById('ddv-name').textContent = d.label
  document.getElementById('ddv-cat').textContent  = d.category

  const hasIntel  = state.godMode || districtHasRadio(state.selected) || districtHasBinoView(state.selected)
  const revealHint = `<div class="ddv-reveal-hint">Reveal: <span class="roster-item-abbrev item-chip--radio">RAD</span><span class="roster-item-abbrev item-chip--binoculars">BNO</span></div>`
  const unknown    = `<span class="ddv-status--unknown">UNKNOWN</span>${revealHint}`

  // Status
  const ddvStatus = document.getElementById('ddv-status')
  if (hasIntel) {
    const { label, cls } = getDistrictStatus(d)
    ddvStatus.innerHTML = `<span class="${cls}">${label}</span>`
  } else {
    ddvStatus.innerHTML = unknown
  }

  // Population
  const ddvPop = document.getElementById('ddv-pop')
  if (hasIntel) {
    ddvPop.innerHTML = `<span>Humans: ${d.humans.toLocaleString()}</span><span>Infected: ${d.zombies.toLocaleString()}</span>`
  } else {
    ddvPop.innerHTML = unknown
  }

  // Units here
  const ddvUnits = document.getElementById('ddv-units')
  if (!hasIntel) {
    ddvUnits.innerHTML = unknown
  } else {
    const unitsHere = Object.values(state.units).filter(u => u.districtId === state.selected)
    const listHtml  = unitsHere.length === 0
      ? '<span class="ddv-no-intel">None</span>'
      : unitsHere.map(u => renderUnitCard(u, 'badges')).join('')
    ddvUnits.innerHTML = listHtml
  }

  // Possible loot (static pool — what can spawn here, not live items)
  const ddvLoot = document.getElementById('ddv-loot')
  const pool      = LOOT_POOLS[state.selected] ?? LOOT_POOLS[d.category]
  if (!pool || pool.length === 0) {
    ddvLoot.innerHTML = '<span class="ddv-no-intel">None</span>'
  } else {
    const uniqueKeys = [...new Set(pool.map(e => e.item))]
    ddvLoot.innerHTML = uniqueKeys.map(key => {
      const item = ITEMS[key]
      return `<div class="item-chip item-chip--${key}">${item?.name ?? key}</div>`
    }).join('')
  }
}

// ── LEFT PANEL ──

initWindowManager()

function setUnitsView(view)    { unitsPanel.dataset.view    = view || '' }
function setContactsView(view) { contactsPanel.dataset.view = view || '' }

unitsList.addEventListener('click', e => {
  const card = e.target.closest('[data-unit-id]')
  if (!card) return
  showUnitDetail(card.dataset.unitId)
})

unitsList.addEventListener('mouseover', e => {
  const card = e.target.closest('[data-unit-id]')
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

  udvType.textContent = unit.label
  if (!unit.districtId) {
    const t = state.transits.find(t => t.kind === 'unit' && t.refId === unit.id)
    const destLabel = state.districts[t?.destId]?.label ?? '—'
    const countdown = t ? formatCountdown(t.etaMs) : '0:00'
    udvLocation.textContent = `EN ROUTE → ${destLabel} (${countdown})`
  } else {
    udvLocation.textContent = d?.label ?? '—'
  }

  udvActivity.innerHTML = `
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
      ${isLeader ? leaderStar(p.role, ws) : `<span class="member-dot member-dot--${p.role}"></span>`}
      <span class="udv-member-name">${p.name}</span>
      <span class="udv-member-role">${p.role.toUpperCase()}</span>
      <span class="udv-ws-badge ws-${ws}">${ws.toUpperCase()}</span>
    </div>`
  }).join('')

  udvTarget.innerHTML = Object.entries(state.districts)
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([nid, nd]) => `<option value="${nid}"${nid === unit.districtId ? ' selected' : ''}>${nd.label}</option>`)
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

function _clearContactDistrictPulse() {
  document.querySelectorAll('#districts polygon.contact-district').forEach(p => p.classList.remove('contact-district'))
}

// Green arcs = on the line, can still be called back. Red = disconnected for good — dead air
// on their end. No blinking either way — same connection glyph used in the contact-detail
// header and the contacts-list row (see renderContactsPanel), markup built once here so both
// places stay identical.
function phoneIconHTML(alive) {
  return `<svg class="cdv-phone-icon${alive ? '' : ' cdv-phone-icon--disconnected'}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path class="cdv-phone-body" d="M5.13641 12.764L8.15456 9.08664C8.46255 8.69065 8.61655 8.49264 8.69726 8.27058C8.76867 8.07409 8.79821 7.86484 8.784 7.65625C8.76793 7.42053 8.67477 7.18763 8.48846 6.72184L7.77776 4.9451C7.50204 4.25579 7.36417 3.91113 7.12635 3.68522C6.91678 3.48615 6.65417 3.35188 6.37009 3.29854C6.0477 3.238 5.68758 3.32804 4.96733 3.5081L3 4C3 14 9.99969 21 20 21L20.4916 19.0324C20.6717 18.3121 20.7617 17.952 20.7012 17.6296C20.6478 17.3456 20.5136 17.0829 20.3145 16.8734C20.0886 16.6355 19.7439 16.4977 19.0546 16.222L17.4691 15.5877C16.9377 15.3752 16.672 15.2689 16.4071 15.2608C16.1729 15.2536 15.9404 15.3013 15.728 15.4001C15.4877 15.512 15.2854 15.7143 14.8807 16.119L11.8274 19.1733" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="cdv-phone-arc cdv-phone-arc--inner" d="M12.9997 7C13.9765 7.19057 14.8741 7.66826 15.5778 8.37194C16.2815 9.07561 16.7592 9.97326 16.9497 10.95" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="cdv-phone-arc cdv-phone-arc--outer" d="M12.9997 3C15.029 3.22544 16.9213 4.13417 18.366 5.57701C19.8106 7.01984 20.7217 8.91101 20.9497 10.94" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

function updatePhoneIcon(contact) {
  document.getElementById('cdv-phone-icon')?.classList.toggle('cdv-phone-icon--disconnected', !contact.alive)
}

function showContactDetail(contactId) {
  const contact = state.contacts.find(c => c.id === contactId)
  if (!contact) return
  maybeFireFirstOpen(contact)
  state.selectedContact = contactId
  contact.unread = false
  renderContactsPanel()
  cdvName.textContent = contact.name
  updatePhoneIcon(contact)
  renderContactMeta(contact)
  renderContactMessages(contact)
  setContactsView('contact-detail')
  _clearContactDistrictPulse()
  if (contact.location) {
    const poly = document.getElementById(contact.location)
    if (poly) poly.classList.add('contact-district')
  }
}

function hideContactDetail() {
  state.selectedContact = null
  setContactsView(null)
  _clearContactDistrictPulse()
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

// Always available, even on a resolved/lost contact — calling back is a player-initiated
// action, not a reply, so it renders as a system note (see chat-bubble--system), never as
// something the caller said. Default behavior is just the emit + a flat "No response." — a
// script can wire director.on('player-callback', ...) later to make a specific contact's
// callback mean something more (an answer, a clue, anything) without changing this function.
// Spamming the button never stacks duplicates: any existing no-response note is dropped first,
// so the fresh one always lands as the single, most-recent entry at the end of the thread.
function callBackContact(contactId) {
  const contact = state.contacts.find(c => c.id === contactId)
  if (!contact) return
  director.emit('player-callback', { contactId, tick: state.tick })
  contact.messages = contact.messages.filter(m => m.kind !== 'no-response')
  pushMessage(contact, { text: 'No response.', time: gameTime(), sender: 'system', kind: 'no-response' })
  renderContactMessages(contact)
}

function renderContactMessages(contact) {
  if (contact.messages.length === 0) {
    cdvMessages.innerHTML = '<div class="no-messages">No messages yet.</div>'
  } else {
    let lastTime = null
    const parts = contact.messages.map(m => {
      const isSystem = m.sender === 'system' || m.text === '[contact lost]'
      const isPlayer = m.sender === 'player'
      if (isSystem) {
        return `<div class="chat-bubble chat-bubble--system"><div class="chat-text">${m.text}</div></div>`
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
    cdvMessages.innerHTML += '<div class="chat-bubble chat-bubble--npc chat-waiting">' +
      '<span class="chat-waiting-dot"></span><span class="chat-waiting-dot"></span><span class="chat-waiting-dot"></span>' +
      '</div>'
  }

  cdvMessages.scrollTop = cdvMessages.scrollHeight

  const choicesEl = document.getElementById('cdv-choices')
  if (!choicesEl) return
  if (contact.type === 'narrative' && contact.alive && contact.pendingNext === null) {
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

  let contact, isNewContact
  const useExisting = state.contacts.length > 0 && (Math.random() < 0.5 || _callerIdx >= CALLER_POOL.length)
  if (useExisting) {
    // Only reuse alive ambient contacts — narrative callers run on their own schedule
    const candidates = state.contacts.filter(c => c.alive && c.type === 'ambient')
    if (!candidates.length) return
    contact = candidates[Math.floor(Math.random() * candidates.length)]
    isNewContact = false
  } else {
    const name = CALLER_POOL[_callerIdx++]
    const isNamed = name !== 'Unknown Caller'
    const districtId = isNamed ? triggerId : null
    const person = makePerson(name, 'civilian', [], {
      sim: true, districtId, location: 'residence', activity: 'hide',
    })
    state.people[person.id] = person
    contact = makeContact(name, districtId)
    contact.personId       = person.id
    contact.reportDistrictId = triggerId  // unnamed callers have no fixed location — remembers
                                           // why they're calling until the player opens the thread
    state.contacts.push(contact)
    isNewContact = true
  }

  if (isNewContact) {
    // First call ever — the contact now exists in the list, but hasn't "spoken" yet. The
    // opener + their actual line fire on first open instead (see maybeFireFirstOpen).
    contact.unread = true
    return
  }

  // Named callers report from their fixed location; unknowns from the triggered district
  const reportDist = (contact.location && state.districts[contact.location])
    ? state.districts[contact.location]
    : triggerDist

  // Named callers in safe zones go quiet
  if (contact.location && reportDist.zombies === 0) return

  const pool = CALL_TEMPLATES[getCallTier(reportDist.zombies)]
  const text = pool[Math.floor(Math.random() * pool.length)](reportDist)

  pushMessage(contact, { text, time: gameTime(), sender: 'npc' })
  contact.unread = true
}

// "Hey look here" — unread message or a RESPOND decision still waiting on the player.
// One universal flag, not two separate signals; more states can feed into this later.
function needsAttention(c) {
  if (c.unread) return true
  return c.type === 'narrative' && c.alive && c.pendingNext === null &&
    c.messages.length > 0 &&
    NARRATIVE_SCRIPTS[c.scriptId]?.nodes[c.phase]?.choices?.length > 0
}

function renderContactsPanel() {
  const list = document.getElementById('contacts-list')
  if (!list) return

  const sorted = state.contacts.slice().sort((a, b) => {
    const aFlag = needsAttention(a), bFlag = needsAttention(b)
    if (bFlag !== aFlag) return (bFlag ? 1 : 0) - (aFlag ? 1 : 0)
    return b.lastActivityTick - a.lastActivityTick
  })

  list.innerHTML = sorted.length === 0
    ? '<div class="no-contacts">No contacts yet.</div>'
    : sorted.map(c => {
        const flagged    = needsAttention(c)
        const flagClass  = flagged ? ' has-unread' : ''
        const dotClass   = flagged ? ' contact-dot--unread' : ''
        return `<div class="contact-card${flagClass}" data-contact-id="${c.id}">
          <span class="contact-dot${dotClass}"></span>
          <span class="contact-name">${c.name}</span>
          ${phoneIconHTML(c.alive)}
        </div>`
      }).join('')
}

// ── EVENT LISTENERS ──

btnUdvBack.addEventListener('click', hideUnitDetail)
btnCdvBack.addEventListener('click', hideContactDetail)
btnIdvBack.addEventListener('click', hideItemDescription)
btnCdvCallback.addEventListener('click', () => {
  if (state.selectedContact) callBackContact(state.selectedContact)
})

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
  pushMessage(contact, { text: choice.label, time: gameTime(), sender: 'player' })

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
  src.unitIds = src.unitIds.filter(id => id !== unitId)
  unit.districtId = null
  if (state.selectedUnit?.unitId === unitId) state.selectedUnit.districtId = null

  const ticks = hopsBetween(srcId, destId) * UNIT_TICKS_PER_HOP
  state.transits.push({
    id: `t${++_transitCounter}`, kind: 'unit', refId: unitId,
    srcId, destId, ticksRemaining: ticks, totalTicks: ticks,
    etaMs: Date.now() + ticks * TICK_MS,
  })

  director.emit('unit-departs', { unitId, srcId, destId })
  broadcastEvent(`[${dest.label.toUpperCase()}] Unit en route from ${src.label}.`)
  renderUnitsPanel()
  renderUnitDots()
  renderTravelingPanel()
}

function resolveTransits() {
  if (state.transits.length === 0) return
  const remaining = []
  for (const t of state.transits) {
    t.ticksRemaining--
    if (t.ticksRemaining > 0) { remaining.push(t); continue }
    if (t.kind === 'unit') {
      const unit = state.units[t.refId]
      const dest = state.districts[t.destId]
      if (unit && dest) {
        unit.districtId = t.destId
        dest.unitIds.push(t.refId)
        if (state.selectedUnit?.unitId === t.refId) state.selectedUnit.districtId = t.destId
        director.emit('unit-enters', { unitId: t.refId, destId: t.destId, srcId: t.srcId })
        broadcastEvent(`[${dest.label.toUpperCase()}] Unit arrived from ${state.districts[t.srcId]?.label ?? t.srcId}.`)
      }
    } else if (t.kind === 'person') {
      const person = state.people[t.refId]
      if (person) {
        person.districtId = t.destId
        director.emit('person-arrives', { personId: t.refId, destId: t.destId, srcId: t.srcId })
      }
    }
  }
  state.transits = remaining
  renderUnitsPanel()
  renderUnitDots()
  renderTravelingPanel()
  if (unitsPanel.dataset.view === 'unit-detail' && state.selectedUnit) {
    const unit = state.units[state.selectedUnit.unitId]
    if (unit) renderUnitDetail(unit)
  }
}
setInterval(resolveTransits, TICK_MS)

// Unconditional, like resolveTransits above — narrative scripts (timers AND choice reply-delays)
// need to advance before state.started is ever true, so the tutorial can use completely normal
// script authoring (no special-cased event-driven-only advancement).
setInterval(processNarrativeCallers, TICK_MS)

// Refreshes only the displayed countdowns every real second — decoupled from TICK_MS so the
// TRAVELING panel and EN ROUTE label count down 0:11, 0:10, 0:09... instead of jumping in
// TICK_MS-sized chunks. Resolution of actual arrivals still happens in resolveTransits above.
setInterval(() => {
  if (state.transits.length === 0) return
  renderTravelingPanel()
  if (unitsPanel.dataset.view === 'unit-detail' && state.selectedUnit) {
    const unit = state.units[state.selectedUnit.unitId]
    if (unit && !unit.districtId) renderUnitDetail(unit)
  }
}, 1000)

btnUdvSend.addEventListener('click', () => {
  if (!state.selectedUnit) return
  const destId = udvTarget.value
  const unit = state.units[state.selectedUnit.unitId]
  if (!destId || !unit || destId === unit.districtId) return
  dispatchUnit(state.selectedUnit.unitId, destId)
  hideUnitDetail()
})

// ── DRAG-AND-DROP DISPATCH ──

unitsList.addEventListener('dragstart', e => {
  const card = e.target.closest('[data-unit-id]')
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

const FLAVOR = {
  winDawn:      'At some point in the early hours, the radio went quiet in a way that was different from before. Not the quiet of a district going dark — the quiet of nothing new moving. Dawn came without an announcement. The city held through the night. Not every district, not without cost, but enough. The logs were reviewed for days afterward, looking for the decision that made the difference. Nobody could agree on which one it was.',
  loseUnits:    'The final unit transmission came in without a distress call — a routine contact report, then nothing. With no assets left in the field, the remaining districts were left uncontested. The city didn\'t fall all at once. It went quiet street by street, district by district, until the only thing moving on the radio was static. The last entry in the dispatch log belongs to you.',
  loseOverrun:  'The tipping point was never a single moment. Districts fell one by one, each one making the next easier to lose. By the time ten were gone, the math had already finished the argument. The last transmissions were just confirmation of what the map had been saying for hours. The city is gone. The dispatcher is still at the console.',
  loseHope:     'Four units. That\'s the number that broke it. Each disbandment was a decision — someone\'s last transmission, someone\'s equipment going silent. After the fourth, the weight of the radio traffic changed. It wasn\'t about the city anymore. It was about how long the city had left. The dispatcher closed the channel at 23:12 and didn\'t reopen it.',
}

const OVERRUN_THRESHOLD    = 0.75  // zombie ratio at which a district counts as lost for losecon
const UNITS_LOST_LIMIT     = 4
const DISTRICTS_LOST_LIMIT = 10
const MAX_UNIT_SIZE        = 4     // leader + 3 members max; enforced when adding survivors

function showEndScreen(title, restartLabel, flavor) {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  document.getElementById('win-title').textContent        = title
  document.getElementById('win-ticks').textContent        = `${state.tick} TICKS`
  document.getElementById('win-time').textContent         = `DAY ${gameDay()} · ${gameTime()}`
  document.getElementById('btn-win-restart').textContent  = restartLabel
  document.getElementById('win-flavor').textContent       = flavor
  document.getElementById('win-overlay').classList.add('visible')
}

function checkLose() {
  if (state.won || state.lost) return

  // Condition 1 — all units dead
  if (Object.keys(state.units).length === 0) {
    state.lost = true
    showEndScreen('ALL UNITS LOST', 'TRY AGAIN', FLAVOR.loseUnits)
    return
  }

  // Condition 2 — 10 of 14 districts functionally overrun (≥75% zombie ratio)
  const overrunCount = Object.values(state.districts).filter(d => {
    const total = d.humans + d.zombies
    return total > 0 && d.zombies / total >= OVERRUN_THRESHOLD
  }).length
  if (overrunCount >= DISTRICTS_LOST_LIMIT) {
    state.lost = true
    showEndScreen('CITY FALLEN', 'TRY AGAIN', FLAVOR.loseOverrun)
    return
  }

  // Condition 3 — too many units lost to combat
  if (state.unitsLost >= UNITS_LOST_LIMIT) {
    state.lost = true
    showEndScreen('SITUATION UNCONTAINABLE', 'TRY AGAIN', FLAVOR.loseHope)
  }
}

function checkWin() {
  if (state.won || state.lost) return
  if (state.tick < ticksFor(30)) return   // dawn = 6am next day, 600 ticks

  state.won = true
  showEndScreen('OUTBREAK CONTAINED', 'PLAY AGAIN', FLAVOR.winDawn)
}

function tick() {
  state.tick++

  // Snapshot humans before spread — needed to detect newly-overrun districts
  const prevHumans = {}
  for (const [id, d] of Object.entries(state.districts)) prevHumans[id] = d.humans

  // Local spread — SIR interaction term: β × (zombies × humans) / total
  // Peaks at 50/50, tapers naturally when either population is rare.
  // This makes early infection slow, mid-game fast, and the last survivors hard to eliminate.
  for (const d of Object.values(state.districts)) {
    if (d.zombies === 0 || d.humans === 0) continue
    const β     = getEffectiveSpreadRate(d)
    const total = d.zombies + d.humans
    const n     = Math.floor(β * d.zombies * d.humans / total)
    if (n > 0) {
      d.zombies += n
      d.humans   = Math.max(0, d.humans - n)
    }
  }

  // Detect newly-overrun districts
  for (const [id, d] of Object.entries(state.districts)) {
    if (d.humans === 0 && prevHumans[id] > 0) {
      broadcastEvent(`[${d.label.toUpperCase()}] SIGNAL LOST — district fallen.`)
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
          broadcastEvent(`[${state.districts[spreadDest].label.toUpperCase()}] Movement detected — infected advancing.`)
        }
      }
    }
  }

  // Combat / activity resolution
  for (const [districtId, d] of Object.entries(state.districts)) {
    const districtUnits = unitsInDistrict(districtId)

    // Scavenge phase — runs even in clear districts
    for (const unit of districtUnits) {
      if (unit.activity !== 'scavenge' || d.loot.length === 0) continue
      for (const person of personsInUnit(unit.id)) {
        if (d.loot.length === 0) break
        if (Math.random() < 0.40) {
          const found = d.loot.pop()
          person.items.push(found)
          broadcastEvent(`[${d.label.toUpperCase()}] ${person.name} — recovered ${ITEMS[found]?.name ?? found}.`)
        }
      }
    }

    if (d.zombies === 0) continue

    const persons = personsInDistrict(districtId)
    if (persons.length === 0) continue

    // Attack phase — engage units only; each person rolls their weapon's hit chance
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

    // Counterattack — every Person present is exposed (unit members and standalone callers
    // alike), weighted by effectiveThreatMod's Location×Activity exposure multiplier
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
    const needHeal   = postCombat.filter(p => p.health <= 50 && p.health > 0).sort((a, b) => a.health - b.health)
    for (const medic of medics) {
      if (needHeal.length === 0) break
      const patient = needHeal.shift()
      patient.health = Math.min(100, patient.health + 20)
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
  checkCallEvent()
  render()
  checkLose()
  checkWin()
}

// ── RENDERING ──

function render() {
  tickDisplay.textContent = state.started ? `TICK ${String(state.tick).padStart(3, '0')}` : '—'
  timeDisplay.textContent = `DAY ${gameDay()} · ${gameTime()}`
  renderDistrictDetail()
  renderUnitsPanel()
  renderUnitDots()
  renderTravelingPanel()
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

const STAR_POINTS = '7,1 8.5,5 12.7,5.1 9.4,7.8 10.5,11.9 7,9.4 3.5,11.9 4.6,7.8 1.3,5.1 5.5,5'
function leaderStar(role, ws) {
  return `<svg class="leader-star ws-${ws}" data-role="${role}" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><polygon points="${STAR_POINTS}"/></svg>`
}

function renderUnitsPanel() {
  const units = Object.values(state.units)
  if (units.length === 0) {
    unitsList.innerHTML = '<div class="no-units">No active units</div>'
    return
  }

  const layout = document.getElementById('units-panel').dataset.cardLayout || 'cards'
  const byDistrict = {}
  for (const unit of units) {
    if (!unit.districtId) continue  // in transit — shown only in the TRAVELING panel
    if (!byDistrict[unit.districtId]) byDistrict[unit.districtId] = []
    byDistrict[unit.districtId].push(unit)
  }
  const sorted = Object.keys(byDistrict).sort((a, b) =>
    (state.districts[a]?.label ?? a).localeCompare(state.districts[b]?.label ?? b)
  )

  unitsList.innerHTML = sorted.map(districtId => {
    const d        = state.districts[districtId]
    const inner    = byDistrict[districtId].map(u => renderUnitCard(u, layout)).join('')
    const wrapCls  = 'district-cards'
    return `<div class="district-group">
      <div class="district-group-header">${d?.label ?? districtId}</div>
      <div class="${wrapCls}">${inner}</div>
    </div>`
  }).join('')
}

function renderUnitCard(unit, layout) {
  const leader     = state.people[unit.leaderPersonId]
  if (!leader) return ''
  const persons    = personsInUnit(unit.id)
  const allItems   = [...new Set(persons.flatMap(p => p.items))]
  const itemsHtml  = allItems.map(k =>
    `<span class="roster-item-abbrev item-chip--${k}">${ITEM_ABBREV[k] ?? k}</span>`
  ).join('')
  const leaderWs   = woundState(leader)
  const nonLeaders = persons.filter(p => p.id !== unit.leaderPersonId)
  const memberDots = nonLeaders.map(p =>
    `<span class="member-dot member-dot--${p.role}" title="${p.name}"></span>`
  ).join('')
  const actBadge   = `<span class="roster-activity roster-activity--${unit.activity}">${unit.activity.toUpperCase()}</span>`
  const shortName  = leader.name.replace(/^(\w)(\w+)\s/, '$1. ')

  if (layout === 'cards' || layout === 'badges') {
    const membersEl = nonLeaders.length > 0
      ? `<div class="roster-members-dots">${memberDots}</div>`
      : `<div class="roster-alone">LONE OPERATOR</div>`
    return `<div class="roster-card" draggable="true" data-unit-id="${unit.id}" data-district-id="${unit.districtId}">
      <div class="roster-portrait" data-role="${leader.role}">${PORTRAIT_SVG}</div>
      <div class="roster-card-body">
        <div class="roster-card-headline">
          <span class="roster-unit-label">${unit.label}</span>
          ${actBadge}
        </div>
        <div class="roster-leader-row">
          <div class="roster-leader-name">${leaderStar(leader.role, leaderWs)}<span class="leader-name-text">${shortName}</span></div>
          ${membersEl}
        </div>
        ${itemsHtml ? `<div class="roster-card-items">${itemsHtml}</div>` : ''}
      </div>
    </div>`
  }

}

function renderUnitDots() {
  const dotsGroup = document.getElementById('unit-dots')
  if (!dotsGroup) return
  dotsGroup.innerHTML = ''

  for (const [districtId] of Object.entries(state.districts)) {
    const units = unitsInDistrict(districtId)
    if (units.length === 0) continue

    const poly = document.getElementById(districtId)
    if (!poly) continue

    const bbox   = poly.getBBox()
    const dotR   = 11
    const dotGap = 26
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

// Wall-clock ETA, refreshed on its own 1s interval (see startCountdownClock below) — kept
// separate from ticksRemaining (which drives actual arrival in resolveTransits) so the displayed
// countdown ticks down smoothly every second instead of jumping by TICK_MS-sized chunks.
function formatCountdown(etaMs) {
  const secs = Math.max(0, Math.round((etaMs - Date.now()) / 1000))
  const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function renderTravelingPanel() {
  const panel = document.getElementById('traveling-panel')
  if (!panel) return

  if (state.transits.length === 0) {
    panel.innerHTML = ''
    panel.style.display = 'none'
    return
  }
  panel.style.display = 'block'

  const sorted = [...state.transits].sort((a, b) => a.ticksRemaining - b.ticksRemaining)
  const rows = sorted.map(t => {
    const srcCode  = DISTRICT_CODE[t.srcId]  ?? '??'
    const destCode = DISTRICT_CODE[t.destId] ?? '??'
    const countdown = formatCountdown(t.etaMs)

    if (t.kind === 'unit') {
      const unit   = state.units[t.refId]
      const leader = unit && state.people[unit.leaderPersonId]
      if (!leader) return ''
      return `<div class="traveling-row" data-unit-id="${unit.id}">
        <span class="traveling-dot traveling-dot--${leader.role} traveling-dot--siren"></span>
        <span class="traveling-name">${leader.name}</span>
        <span class="traveling-route">[${srcCode}→${destCode}]</span>
        <span class="traveling-time">${countdown}</span>
      </div>`
    }

    const person = state.people[t.refId]
    if (!person) return ''
    return `<div class="traveling-row">
      <span class="traveling-name traveling-name--bare">${person.name}</span>
      <span class="traveling-route">[${srcCode}→${destCode}]</span>
      <span class="traveling-time">${countdown}</span>
    </div>`
  }).join('')

  panel.innerHTML = `<div class="traveling-header">TRAVELING</div><div class="traveling-list">${rows}</div>`
}

document.getElementById('traveling-panel').addEventListener('click', e => {
  const row = e.target.closest('[data-unit-id]')
  if (!row) return
  showUnitDetail(row.dataset.unitId)
})

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

document.getElementById('dispatch-layout-select').addEventListener('change', e => {
  document.getElementById('units-panel').dataset.cardLayout = e.target.value
  renderUnitsPanel()
})

document.getElementById('btn-win-restart').addEventListener('click', () => location.reload())
document.getElementById('btn-reset-ui').addEventListener('click', resetLayout)

document.getElementById('btn-pause').addEventListener('click', () => {
  if (state.won || state.lost) return
  gamePaused = !gamePaused
  if (gamePaused) {
    clearInterval(tickInterval)
    tickInterval = null
  } else {
    tickInterval = setInterval(tick, TICK_MS)
  }
  document.getElementById('btn-pause').textContent = gamePaused ? 'RESUME' : 'PAUSE'
})

document.getElementById('btn-test-win').addEventListener('click', () => {
  if (state.won || state.lost) return
  state.won = true
  showEndScreen('OUTBREAK CONTAINED', 'PLAY AGAIN', FLAVOR.winDawn)
  document.getElementById('win-flavor').innerHTML =
    `<span class="win-override-notice">[Dispatcher override — outcome forced for testing.]</span>${FLAVOR.winDawn}`
})

document.getElementById('btn-test-lose').addEventListener('click', () => {
  if (state.won || state.lost) return
  state.lost = true
  showEndScreen('ALL UNITS LOST', 'TRY AGAIN', FLAVOR.loseUnits)
  document.getElementById('win-flavor').innerHTML =
    `<span class="win-override-notice">[Dispatcher override — outcome forced for testing.]</span>${FLAVOR.loseUnits}`
})

document.getElementById('btn-test-alert').addEventListener('click', () => {
  showAlert('UNIT DISBANDED', 'All personnel lost at Station No. 1. The district has been left unprotected.')
})

// ── START SCREEN ──

function seedFromDifficulty(difficulty) {
  const { numDistricts, totalZombies, distribution } = difficulty
  spreadChance = difficulty.spreadChance

  const candidates = Object.entries(state.districts)
    .filter(([, d]) => d.category !== 'government')
    .map(([id]) => id)

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const chosen = candidates.slice(0, Math.min(numDistricts, candidates.length))

  if (distribution === 'even') {
    const base      = Math.floor(totalZombies / chosen.length)
    const remainder = totalZombies % chosen.length
    chosen.forEach((id, i) => { state.districts[id].zombies = base + (i < remainder ? 1 : 0) })
  } else if (distribution === 'linear') {
    const n     = chosen.length
    const total = n * (n + 1) / 2
    chosen.forEach((id, i) => { state.districts[id].zombies = Math.round(totalZombies * (n - i) / total) })
  } else if (distribution === 'all-in-one') {
    state.districts[chosen[0]].zombies = totalZombies
  }
}

const customCounts      = {}
Object.keys(state.districts).forEach(id => customCounts[id] = 0)

const scenarioSelect     = document.getElementById('scenario-select')
const difficultySelect   = document.getElementById('difficulty-select')
const customZoneGrid     = document.getElementById('custom-zone-grid')
const customControls     = document.getElementById('custom-controls')

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

difficultySelect.addEventListener('change', () => {
  customControls.classList.toggle('visible', difficultySelect.value === 'custom')
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
  state.scenarioId = scenarioSelect.value
  if (difficultySelect.value === 'custom') {
    Object.entries(customCounts).forEach(([id, n]) => {
      if (n > 0) state.districts[id].zombies = n
    })
  } else {
    seedFromDifficulty(DIFFICULTIES[difficultySelect.value] ?? DIFFICULTIES.standard)
  }
  document.getElementById('start-screen').classList.remove('visible')
  resetLayout()
  tickInterval = setInterval(tick, TICK_MS)
}

document.getElementById('btn-start').addEventListener('click', () => {
  document.getElementById('start-screen').classList.remove('visible')
  showLoginBox(() => {
    // Window reveals from here on are the script's call, not main.js's — see Barbara's
    // first node, which reveals CONTACTS itself before her greeting renders.
    if (NARRATIVE_SCRIPTS.tutorial) {
      spawnScript('tutorial')
    } else {
      startGame()
    }
  })
})

// ── UI Theme system ──
// setGlobalTheme(id) applies all CSS vars onto document.documentElement, which
// overrides the :root block via inline-style cascade priority. applyWindowThemes()
// then layers per-window overrides on top for any windows that need them.

const GLOBAL_THEMES = {

  'terminal-green': {
    '--desktop-bg':'#020402','--taskbar-bg':'#040804','--bg':'#060b06','--surface':'#0a1208','--chrome-raised':'#0e180e',
    '--border':'#1a2e1a','--border-sub':'#0e180e','--border-active':'#2e4e30',
    '--text':'#7ed87e','--text-dim':'#7ed87e','--text-dimmer':'#7ed87e','--accent':'#a8eaa8',
    '--btn-bg':'#080f08','--btn-bg-hover':'#0e1a0e','--btn-bg-active':'#0c180c',
    '--btn-border':'#2a4a2a','--btn-border-hover':'#3a6a3a','--btn-border-active':'#2e4e30',
    '--btn-color':'#7ed87e','--btn-color-active':'#a8eaa8',
    '--win-border':'#1a2e1a','--titlebar-bg':'#090f09','--titlebar-bg-active':'#0d1a0d',
    '--titlebar-border-active':'#2e4a30','--win-title-color':'#7ed87e',
    '--winbtn-bg':'#0b140b','--winbtn-border':'#2a4a2a','--winbtn-color':'#7ed87e',
    '--winbtn-hover-bg':'#111e11','--winbtn-hover-border':'#3a6a3a',
    '--winbtn-close-bg':'#1a0808','--winbtn-close-color':'#c04040','--winbtn-close-border':'#501818',
    '--winbtn-max-bg':'#0c180c','--winbtn-max-color':'#6ab06a','--winbtn-max-border':'#1e301e',
    '--winbtn-min-bg':'#0f1a0f',
    '--chat-npc-bg':'#122012','--chat-npc-border':'#1e381e','--chat-npc-color':'#9ee89e',
    '--chat-player-bg':'#0e1e30','--chat-player-border':'#1a3050','--chat-player-color':'#7ac4e8',
    '--radio-bg':'#060b06','--radio-border':'#1a2e1a','--radio-chrome':'#0e180e',
    '--radio-win-border':'#2e4e30','--radio-title-color':'#7ed87e',
    '--radio-carrier':'#5a8e5a','--radio-freq':'#2e4e2e',
    '--radio-t0':'#a8eaa8','--radio-t1':'#7ed87e','--radio-t2':'#4a7a4a','--radio-noise':'#1a2e1a',
    '--status-lost':'#c84040','--leader-star':'#e8c030','--lone-operator':'#904040','--radio-btn-hover-bg':'#181410',
  },

  'terminal-white': {
    '--desktop-bg':'#050505','--taskbar-bg':'#080808','--bg':'#0a0a0a','--surface':'#101010','--chrome-raised':'#181818',
    '--border':'#2e2e2e','--border-sub':'#181818','--border-active':'#5a5a5a',
    '--text':'#f0f0f0','--text-dim':'#b8b8b8','--text-dimmer':'#b8b8b8','--accent':'#ffffff',
    '--btn-bg':'#0c0c0c','--btn-bg-hover':'#161616','--btn-bg-active':'#121212',
    '--btn-border':'#3a3a3a','--btn-border-hover':'#5a5a5a','--btn-border-active':'#707070',
    '--btn-color':'#d8d8d8','--btn-color-active':'#ffffff',
    '--win-border':'#2e2e2e','--titlebar-bg':'#0d0d0d','--titlebar-bg-active':'#181818',
    '--titlebar-border-active':'#5a5a5a','--win-title-color':'#e8e8e8',
    '--winbtn-bg':'#121212','--winbtn-border':'#3a3a3a','--winbtn-color':'#d0d0d0',
    '--winbtn-hover-bg':'#1c1c1c','--winbtn-hover-border':'#5a5a5a',
    '--winbtn-close-bg':'#1a0808','--winbtn-close-color':'#c04040','--winbtn-close-border':'#501818',
    '--winbtn-max-bg':'#141414','--winbtn-max-color':'#c0c0c0','--winbtn-max-border':'#3a3a3a',
    '--winbtn-min-bg':'#161616',
    '--chat-npc-bg':'#161616','--chat-npc-border':'#3a3a3a','--chat-npc-color':'#f0f0f0',
    '--chat-player-bg':'#202020','--chat-player-border':'#4a4a4a','--chat-player-color':'#ffffff',
    '--radio-bg':'#050505','--radio-border':'#2e2e2e','--radio-chrome':'#0a0a0a',
    '--radio-win-border':'#5a5a5a','--radio-title-color':'#e8e8e8',
    '--radio-carrier':'#888888','--radio-freq':'#3a3a3a',
    '--radio-t0':'#ffffff','--radio-t1':'#cccccc','--radio-t2':'#888888','--radio-noise':'#3a3a3a',
    '--status-lost':'#c84040','--leader-star':'#e8c030','--lone-operator':'#904040','--radio-btn-hover-bg':'#181818',
  },

  'morning-coffee': {
    '--desktop-bg':'#080500','--taskbar-bg':'#0c0800','--bg':'#100c04','--surface':'#171208','--chrome-raised':'#1e1810',
    '--border':'#3c2e18','--border-sub':'#261a0a','--border-active':'#7a5e38',
    '--text':'#d4b870','--text-dim':'#9a8050','--text-dimmer':'#584830','--accent':'#ecd080',
    '--btn-bg':'#130d04','--btn-bg-hover':'#1e1608','--btn-bg-active':'#1a1208',
    '--btn-border':'#4c3a20','--btn-border-hover':'#7a5e38','--btn-border-active':'#8a6e48',
    '--btn-color':'#c4a060','--btn-color-active':'#e8c878',
    '--win-border':'#483618','--titlebar-bg':'#100c04','--titlebar-bg-active':'#1a1408',
    '--titlebar-border-active':'#6a5030','--win-title-color':'#c8a860',
    '--winbtn-bg':'#150e04','--winbtn-border':'#4c3a20','--winbtn-color':'#b09850',
    '--winbtn-hover-bg':'#201808','--winbtn-hover-border':'#7a5e38',
    '--winbtn-close-bg':'#1c0a08','--winbtn-close-color':'#c04030','--winbtn-close-border':'#501818',
    '--winbtn-max-bg':'#141008','--winbtn-max-color':'#a08840','--winbtn-max-border':'#3c2c14',
    '--winbtn-min-bg':'#181408',
    '--chat-npc-bg':'#1e1508','--chat-npc-border':'#3c2c14','--chat-npc-color':'#d4b060',
    '--chat-player-bg':'#0c1018','--chat-player-border':'#1a2838','--chat-player-color':'#7ac4e8',
    '--radio-bg':'#0c0900','--radio-border':'#786858','--radio-chrome':'#100c04',
    '--radio-win-border':'#8a7a60','--radio-title-color':'#c8b880',
    '--radio-carrier':'#7a8a5a','--radio-freq':'#4a4030',
    '--radio-t0':'#e0b840','--radio-t1':'#b08828','--radio-t2':'#786020','--radio-noise':'#302810',
    '--status-lost':'#c84040','--leader-star':'#e8c030','--lone-operator':'#904040','--radio-btn-hover-bg':'#181410',
  },

  'midnight-purple': {
    '--desktop-bg':'#09070f','--taskbar-bg':'#0d0b18','--bg':'#110e1c','--surface':'#17132a','--chrome-raised':'#1e1935',
    '--border':'#3d2d6e','--border-sub':'#251a4a','--border-active':'#7f55b5',
    '--text':'#f2eeff','--text-dim':'#c4aaee','--text-dimmer':'#c4aaee','--accent':'#bb99ff',
    '--btn-bg':'#16102c','--btn-bg-hover':'#231a42','--btn-bg-active':'#2c2252',
    '--btn-border':'#5830a0','--btn-border-hover':'#7f55b5','--btn-border-active':'#9a70d8',
    '--btn-color':'#ccb0ff','--btn-color-active':'#ffffff',
    '--win-border':'#5830a0','--titlebar-bg':'#1e1040','--titlebar-bg-active':'#301a62',
    '--titlebar-border-active':'#7f55b5','--win-title-color':'#ffffff',
    '--winbtn-bg':'#221545','--winbtn-border':'#5830a0','--winbtn-color':'#ccb0ff',
    '--winbtn-hover-bg':'#381e68','--winbtn-hover-border':'#7f55b5',
    '--winbtn-close-bg':'#2a0e1e','--winbtn-close-color':'#ff6868','--winbtn-close-border':'#801830',
    '--winbtn-max-bg':'#1e1240','--winbtn-max-color':'#9878d8','--winbtn-max-border':'#3c2478',
    '--winbtn-min-bg':'#1a1038',
    '--chat-npc-bg':'#1a1235','--chat-npc-border':'#5830a0','--chat-npc-color':'#ece0ff',
    '--chat-player-bg':'#0e1430','--chat-player-border':'#182e70','--chat-player-color':'#7cc8ff',
    '--radio-bg':'#0c0a1c','--radio-border':'#5830a0','--radio-chrome':'#100e1e',
    '--radio-win-border':'#7f55b5','--radio-title-color':'#d8c8ff',
    '--radio-carrier':'#4a3a90','--radio-freq':'#302060',
    '--radio-t0':'#f0e8ff','--radio-t1':'#ccaaf0','--radio-t2':'#a888d8','--radio-noise':'#5830a0',
    '--status-lost':'#ff7070','--leader-star':'#e8c030','--lone-operator':'#ff7070','--radio-btn-hover-bg':'#1a1238',
  },

  'cyberpunk': {
    '--desktop-bg':'#030508','--taskbar-bg':'#050810','--bg':'#070b18','--surface':'#0c1025','--chrome-raised':'#101530',
    '--border':'#1a1a5e','--border-sub':'#0e0e3a','--border-active':'#00d4ff',
    '--text':'#00e5ff','--text-dim':'#0098c0','--text-dimmer':'#004870','--accent':'#ff2d78',
    '--btn-bg':'#08081e','--btn-bg-hover':'#101040','--btn-bg-active':'#14145a',
    '--btn-border':'#1a1a60','--btn-border-hover':'#00d4ff','--btn-border-active':'#ff2d78',
    '--btn-color':'#00c8f0','--btn-color-active':'#ff2d78',
    '--win-border':'#1a2080','--titlebar-bg':'#080840','--titlebar-bg-active':'#0e0070',
    '--titlebar-border-active':'#00d4ff','--win-title-color':'#00e5ff',
    '--winbtn-bg':'#08084a','--winbtn-border':'#1a1a70','--winbtn-color':'#00c8f0',
    '--winbtn-hover-bg':'#0a0a70','--winbtn-hover-border':'#00d4ff',
    '--winbtn-close-bg':'#2a0820','--winbtn-close-color':'#ff3068','--winbtn-close-border':'#801040',
    '--winbtn-max-bg':'#081040','--winbtn-max-color':'#0098c0','--winbtn-max-border':'#1a2878',
    '--winbtn-min-bg':'#060830',
    '--chat-npc-bg':'#080828','--chat-npc-border':'#1a1a70','--chat-npc-color':'#80e8ff',
    '--chat-player-bg':'#1a0820','--chat-player-border':'#501040','--chat-player-color':'#ff80b0',
    '--radio-bg':'#04040e','--radio-border':'#1a1a70','--radio-chrome':'#060618',
    '--radio-win-border':'#00d4ff','--radio-title-color':'#00e5ff',
    '--radio-carrier':'#0050a0','--radio-freq':'#101850',
    '--radio-t0':'#00e5ff','--radio-t1':'#0098c0','--radio-t2':'#004870','--radio-noise':'#1a1a60',
    '--status-lost':'#ff3068','--leader-star':'#ffe040','--lone-operator':'#ff3068','--radio-btn-hover-bg':'#0a0a28',
  },

  'windows-95': {
    '--desktop-bg':'#008080','--taskbar-bg':'#c0c0c0','--bg':'#c0c0c0','--surface':'#c0c0c0','--chrome-raised':'#a8a8a8',
    '--border':'#808080','--border-sub':'#c0c0c0','--border-active':'#000080',
    '--text':'#000000','--text-dim':'#333333','--text-dimmer':'#333333','--accent':'#000080',
    '--btn-bg':'#c0c0c0','--btn-bg-hover':'#d4d4d4','--btn-bg-active':'#b8b8b8',
    '--btn-border':'#808080','--btn-border-hover':'#404040','--btn-border-active':'#000080',
    '--btn-color':'#000000','--btn-color-active':'#000000',
    '--win-border':'#808080','--titlebar-bg':'#000080','--titlebar-bg-active':'#1084d0',
    '--titlebar-border-active':'#0000ff','--win-title-color':'#ffffff',
    '--winbtn-bg':'#c0c0c0','--winbtn-border':'#808080','--winbtn-color':'#000000',
    '--winbtn-hover-bg':'#d0d0d0','--winbtn-hover-border':'#404040',
    '--winbtn-close-bg':'#c0c0c0','--winbtn-close-color':'#000000','--winbtn-close-border':'#808080',
    '--winbtn-max-bg':'#c0c0c0','--winbtn-max-color':'#000000','--winbtn-max-border':'#808080',
    '--winbtn-min-bg':'#c0c0c0',
    '--chat-npc-bg':'#e0e8ff','--chat-npc-border':'#0000c0','--chat-npc-color':'#000060',
    '--chat-player-bg':'#ffffff','--chat-player-border':'#808080','--chat-player-color':'#000000',
    '--radio-bg':'#f0f0f0','--radio-border':'#808080','--radio-chrome':'#e0e0e0',
    '--radio-win-border':'#808080','--radio-title-color':'#000000',
    '--radio-carrier':'#008000','--radio-freq':'#808080',
    '--radio-t0':'#000000','--radio-t1':'#333333','--radio-t2':'#666666','--radio-noise':'#808080',
    '--status-lost':'#c80000','--leader-star':'#c8a000','--lone-operator':'#800000','--radio-btn-hover-bg':'#d0d0d0',
    '--map-district-stroke':'#000000',
  },

  'blood-moon': {
    '--desktop-bg':'#0a0204','--taskbar-bg':'#0e0306','--bg':'#120408','--surface':'#18060c','--chrome-raised':'#200a12',
    '--border':'#5a0e20','--border-sub':'#300610','--border-active':'#c82040',
    '--text':'#f0c8c8','--text-dim':'#c07880','--text-dimmer':'#804050','--accent':'#ff4060',
    '--btn-bg':'#160508','--btn-bg-hover':'#220810','--btn-bg-active':'#2a0c14',
    '--btn-border':'#580e1e','--btn-border-hover':'#c82040','--btn-border-active':'#e83050',
    '--btn-color':'#e09090','--btn-color-active':'#ffffff',
    '--win-border':'#8a1428','--titlebar-bg':'#1a0408','--titlebar-bg-active':'#300810',
    '--titlebar-border-active':'#c82040','--win-title-color':'#ffffff',
    '--winbtn-bg':'#200608','--winbtn-border':'#580e1e','--winbtn-color':'#e09090',
    '--winbtn-hover-bg':'#380c14','--winbtn-hover-border':'#c82040',
    '--winbtn-close-bg':'#2a0406','--winbtn-close-color':'#ff5050','--winbtn-close-border':'#901020',
    '--winbtn-max-bg':'#1e0608','--winbtn-max-color':'#c86080','--winbtn-max-border':'#480c18',
    '--winbtn-min-bg':'#180408',
    '--chat-npc-bg':'#1e0610','--chat-npc-border':'#580e1e','--chat-npc-color':'#f0a8a8',
    '--chat-player-bg':'#0c0e20','--chat-player-border':'#181e50','--chat-player-color':'#8090e0',
    '--radio-bg':'#0c0206','--radio-border':'#580e1e','--radio-chrome':'#100408',
    '--radio-win-border':'#c82040','--radio-title-color':'#e0a0a0',
    '--radio-carrier':'#702030','--radio-freq':'#3a0810',
    '--radio-t0':'#ffd0d0','--radio-t1':'#e09090','--radio-t2':'#b05858','--radio-noise':'#701828',
    '--status-lost':'#ff4040','--leader-star':'#e8c030','--lone-operator':'#ff5050','--radio-btn-hover-bg':'#1a0408',
  },
}

const _allGlobalThemeKeys = new Set(
  Object.values(GLOBAL_THEMES).flatMap(t => Object.keys(t))
)

function setGlobalTheme(id) {
  const vars = GLOBAL_THEMES[id]
  if (!vars) return
  _allGlobalThemeKeys.forEach(k => document.documentElement.style.removeProperty(k))
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
  localStorage.setItem('dispatch-theme', id)
  const sel = document.getElementById('theme-select')
  if (sel && sel.value !== id) sel.value = id
}

setGlobalTheme(localStorage.getItem('dispatch-theme') || 'terminal-green')
document.getElementById('theme-select').addEventListener('change', e => {
  setGlobalTheme(e.target.value)
  setMapPalette(document.getElementById('map-palette-select').value)
  applyMapLabelOverride(e.target.value)
})

// ── Map palette switcher ──

const MAP_PALETTES = {
  outline: {
    '--map-panel-bg':          'transparent',
    '--map-label':             '#ffffff',
    '--map-label-sub':         'rgba(255,255,255,0.60)',
    '--map-district-stroke':   'var(--accent)',
    '--col-res': 'transparent', '--col-res-h': 'color-mix(in srgb, var(--accent) 28%, transparent)',
    '--col-gov': 'transparent', '--col-gov-h': 'color-mix(in srgb, var(--accent) 28%, transparent)',
    '--col-med': 'transparent', '--col-med-h': 'color-mix(in srgb, var(--accent) 28%, transparent)',
    '--col-ret': 'transparent', '--col-ret-h': 'color-mix(in srgb, var(--accent) 28%, transparent)',
    '--col-ind': 'transparent', '--col-ind-h': 'color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  tactical: {
    '--map-panel-bg':          '#070b0e',
    '--map-label':             'rgba(170,200,185,0.95)',
    '--map-label-sub':         'rgba(110,148,130,0.78)',
    '--map-district-stroke':   '#28383f',
    '--col-res': '#1c1810', '--col-res-h': '#2a2419',
    '--col-gov': '#0c1828', '--col-gov-h': '#102234',
    '--col-med': '#0c1e14', '--col-med-h': '#10281c',
    '--col-ret': '#1a1028', '--col-ret-h': '#231538',
    '--col-ind': '#1c1008', '--col-ind-h': '#271808',
  },
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

const MAP_LABEL_OVERRIDES = {
  'windows-95': {
    '--map-label':     '#000080',
    '--map-label-sub': 'rgba(0,0,128,0.60)',
  }
}

function applyMapLabelOverride(themeId) {
  const overrides = MAP_LABEL_OVERRIDES[themeId]
  if (!overrides) return
  const root = document.documentElement
  Object.entries(overrides).forEach(([k, v]) => root.style.setProperty(k, v))
}

document.getElementById('map-palette-select').addEventListener('change', e => {
  setMapPalette(e.target.value)
  applyMapLabelOverride(document.getElementById('theme-select').value)
})

const mapPaletteSelect = document.getElementById('map-palette-select')
mapPaletteSelect.value = 'outline'
setMapPalette('outline')
applyMapLabelOverride(document.getElementById('theme-select').value)

render()

// Dev: expose internals to window for console/preview debugging
Object.assign(window, { state, tick, director, gameTime, gameDay, NARRATIVE_SCRIPTS, when, triggerToCondition, dispatchUnit, handlePersonDeath, disbandUnit, setGlobalTheme, GLOBAL_THEMES, showAlert, dismissAlert, winState })
