# Dispatch — TODO / Scratchpad

> Provisional. Not a changelog. Things move around here.

---

## Design North Star (capture before it drifts)

The long game is this: **the player never gets clean numbers.** The simulation runs in the background with full fidelity, but everything the player sees is mediated — through a radio feed, a voice on the line, a unit's last transmission, a map color that's going the wrong way. You have an engine on one side, a player on the other, and a machine in the middle that turns state into narrative.

The current god mode is a dev tool, not a game mode. Eventually it disappears entirely (or becomes a late-game unlock that feels like cheating). The player should be flying *mostly* blind and making good decisions anyway. That's the skill expression.

---

## Up Next (current arc)

### 1. Radio / Broadcast Feed  ✅ SHIPPED
The dispatch consequences system, styled as an inbound-only radio/emergency broadcast channel instead of a clean log. This is the first "narrative machine" expression.

**What it is:**
- A feed of incoming transmissions — styled like police scanner chatter or EBS text
- Messages are generated from game events: units engaging zombies, districts falling, units dying, districts being cleared, spread events
- Translate state into words: not "14 zombies killed" → something like `[RIVERSIDE] Alpha Squad reports contact — situation developing`
- Static/noise markers in the text (`<wzzt>`, `<szzt>`) for vibe
- Scrolling log or transient ticker — TBD. Transient (no scroll) adds more friction / urgency. Log is more forgiving. Maybe configurable or just decide one.
- Lives in the SITREP window (rename it?) or gets its own window

**Flavor reference:** Project Zomboid's EBS channel — radio noise rendered as subtitle-style `<wzzt>` artifacts while a message scrolls. No voice. The noise IS the voice.

**Implementation scope:**
- `broadcastEvent(msg)` function that pushes to a feed array
- Ticker component in the radio window that renders most recent N messages
- Message templates for: unit engaged, unit wounded, unit died, district cleared, district overrun, spread event, loot found
- CSS: monospace, scanline feel, maybe a blinking cursor, `color: #88ff88` or amber — terminal green/amber, not blue

**Design note:** This is also where dispatch outcomes land. When you send a unit somewhere and something happens, the radio tells you. Not a UI callback, a transmission.

---

### 2. Version bump → v0.2  ← **DO THIS NEXT**
What we have: windowed UI, loot rarity, rations, binoculars, items reference, COMMS radio feed, GOD MODE → sitrep coupling. That's a real game upgrade from v0.1.

---

## Next Arc: The Caller System

> Don't start this until radio feed is in. The radio feed will teach us what the narrative machine needs to do.

### 3. Contact System Light Refactor
Minimum viable prep for narrative callers. Don't touch the existing contacts (they still work fine as-is), just make the structure forward-compatible.

Add to each contact:
- `phase` — which step of their story they're on (0 = start)
- `timer` — ticks until auto-advance (null = no timer)
- `alive` — boolean (some contacts can die off-screen)
- `type` — `'ambient'` (current style) | `'narrative'` (conversation tree)

Keep existing contacts as `type: 'ambient'`. New narrative callers use the new fields.

### 4. Narrative Callers
Phantom contacts — no body on the map, no health, no items. They exist only in the call system and are directed by us as storytellers.

**Structure:**
- Pre-written conversation trees: nodes with text, choices (or no choices — monologue), timer per node
- If a timer expires with no player response, auto-advance to a consequence branch
- The player's "response" options are limited and pre-written (no free text)
- Caller can die, go silent, or resolve — the contact entry reflects this

**Examples of what these unlock:**
- A civilian trapped in a district who gives you intel but only if you answer fast enough
- A confused city official who doesn't believe you and you have to convince them (stakes: they control a district's evacuation)
- A kid on a landline who doesn't know what's happening
- Levity: a deli owner very upset about something unrelated

### 5. Events System (proper)
Game-driven triggers that can:
- Spawn a narrative caller ("Sandra Hill calls back")
- Advance an existing caller to a new phase ("she heard the explosion — she knows now")
- Change a district state (barricade collapses, generator goes out)
- Interact with the radio feed (events generate transmissions)

This is what ties the whole thing together. The events system is the storyteller's hand.

---

## Later / Backlog

### District Consequences (gameplay weight)
- `SECURED` status: zombies cleared, slowed reinfection, maybe unlocks something
- `OVERRUN` status: loot inaccessible, civilians 0, spreads faster
- These states should appear on the map (color shift or label) and in the radio feed

### Win Condition (currently undefined)
design.md says "survive N ticks or contain spread below threshold" — needs actual design. Options:
- Survive until dawn (fixed tick count) — simple
- Secure X% of the city — spatial
- Keep a specific district (City Hall?) alive the whole game — narrative
- All three in escalating difficulty tiers

### Sound
Someday. The radio crackle is an obvious first piece. Ambient hum. Unit acknowledgement clicks. NOT voice acting. The zomboid EBS vibe works precisely because you hear noise and read text — your brain fills in the voice.

### Pure Data Removal (long game)
Eventually:
- No HP numbers on units — just status words (HEALTHY / WOUNDED / CRITICAL)
- No zombie counts even in god mode — just density (CLEAR / LIGHT / HEAVY / OVERRUN)
- Map colors tell you trend, not value
- The only source of truth is the radio and the callers

This is a late-stage pass, not something to design around now. But keep it in mind when adding new UI — ask "can this be expressed narratively instead?"

---

## Known Bugs / Polish
- Window resize from N/W edges doesn't clamp (can push window off-screen while resizing — low priority)
- SITREP window shows "GOD MODE REQUIRED" as primary content in normal play — this should eventually become the radio feed
