# Dispatch — TODO / Scratchpad

> Provisional. Not a changelog. Things move around here.

---

## Era / World Canon (do not break this frame)

The green terminal aesthetic implicitly sets the game in the late 1980s / very early 1990s. This is load-bearing — it's why information is scarce, why the radio is text, why contacts call on landlines with no ID, why there's no live CCTV. **All future flavor text and narrative additions must stay inside this frame.** Don't write dialogue that implies smartphones, streaming, or instant global comms. The crappy terminal IS state of the art. The radio feed IS the best available intelligence. That's the whole point.

---

## Design North Star (capture before it drifts)

The long game is this: **the player never gets clean numbers.** The simulation runs in the background with full fidelity, but everything the player sees is mediated — through a radio feed, a voice on the line, a unit's last transmission, a map color that's going the wrong way. You have an engine on one side, a player on the other, and a machine in the middle that turns state into narrative.

The current god mode is a dev tool, not a game mode. Eventually it disappears entirely (or becomes a late-game unlock that feels like cheating). The player should be flying *mostly* blind and making good decisions anyway. That's the skill expression.

**The win screen is a myth — and that's intentional.** Winning requires both skill and luck. The backend randomization makes it genuinely hard. If players finished a full run and assumed a win state didn't exist, that is the correct experience. It's about the decisions under pressure, the radio going quiet, the moment a district goes dark. Not the end state. Design every feature with this in mind: don't optimize for winning, optimize for meaningful play until you lose. The win screen exists, but it should feel like a rumor.

**Simulation speed is load-bearing.** The pace needs to give players enough time to understand the interface before they lose. Too fast and it becomes an RTS — reflex-based, click-heavy, not the target. The goal is: you lose, but you feel like you *almost* had it. You were reading the radio, you were dispatching, you were trying to understand the map — and the city still fell. That's the feeling. Tick intervals should be tuned so that understanding and losing happen at roughly the same time, not sequentially.

---

## Up Next (current arc)

### 1. Radio / Broadcast Feed  ✅ SHIPPED
### 2. UX Pass — Start Screen + Taskbar  ✅ SHIPPED
Custom game form pre-fills from default preset. Spread rate stepper on start screen (5–80%, default 35%). Start card sized with VW units. Taskbar and interface text doubled in size.

### 1. Radio / Broadcast Feed  ✅ SHIPPED (v0.1)
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

### 3. Version bump → v0.2  ✅ SHIPPED
Windowed UI, loot rarity, rations, binoculars, items reference, COMMS radio feed, GOD MODE → sitrep coupling, spread rate config, bigger start screen, bigger taskbar.

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

### 5. More Narrative Scripts

**Serious callers (write next):**
- A kid on a landline who doesn't know what's happening
- A confused city official who doesn't believe you and won't evacuate until convinced (stakes: unlocks district evacuation)
- Sandra Hill — she's already in the ambient pool, promote her to a narrative arc

**Comedy/levity callers (write when tone needs balancing):**
- **The Oblivious Guy** — calls about something completely unrelated (a parking dispute, a noise complaint, a question about hours). Does not believe in zombies. Suffers zero consequences regardless of how long the game runs. Resolves peacefully every time.
- **The Prank Caller** — shows up periodically, never has anything useful to say, hangs up before you can respond or just breathes into the phone. No narrative arc, just occasional chaos.
- **The Song Request Guy** — keeps calling back specifically until you answer once. When you do, he yells a song request for a song you've never heard of. Never calls again after that one response. Implement with a `one-shot-acknowledged` resolve type.

### 6. Events System (proper)
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
- **Contrast pass needed across the whole UI.** Many text elements are too dim against their backgrounds — readable in dev but not in real play conditions. Needs a systematic audit: panel labels, radio messages, district info text, start screen epitaph, taskbar states, item descriptions. Target: everything intentionally dim should still be legible; only decorative/idle elements should be near-invisible.
