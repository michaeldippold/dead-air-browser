# Dispatch — TODO / Scratchpad

> Provisional. Not a changelog. Things move around here.

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
⚠️ **NEEDS REVIEW AFTER PERSON REFACTOR** — written before Person became the core type. The concept below is still correct but the implementation details are stale. Specifically: "no body on the map, no health, no items" should now read "scripted: true flag on Person, excluded from simulation." Items can now belong to scripted persons. Re-read the Person refactor before touching this.

Phantom contacts — scripted Person objects that exist only in the call system and are directed by us as storytellers. They get a `scripted: true` flag so the simulation ignores them, but the Director can manipulate them.

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
⚠️ **NEEDS REVIEW AFTER PERSON REFACTOR** — written before Person/Unit existed. The shape of what an event can target has changed. "Spawn a narrative caller" now means "create a scripted Person and push them to contacts." Re-read the Director entry in the Later/Backlog section before designing this — Director and Events System are closely related and should probably be designed together.

Game-driven triggers that can:
- Spawn a scripted Person as a narrative caller
- Advance an existing caller to a new phase ("she heard the explosion — she knows now")
- Change a district state (barricade collapses, generator goes out)
- Target specific people or units by role, location, or condition (this is new — the Person model makes this possible)
- Interact with the radio feed (events generate transmissions)

This is what ties the whole thing together. The events system is the storyteller's hand.

---

## Onboarding / Tutorial (post-gameplay-loop)

> Do this once the core loop feels compelling and the interface is stable. Not before.

Once the game is fun on its own terms, the first-run experience should teach it — not through a help screen, but through the phone system itself.

**The idea:** replace some of the early randomness with scripted direction. The first caller a new player gets is a tutorial caller — someone who walks you through the interface before the real chaos starts. After the tutorial resolves, the full game kicks off normally.

**Panel spotlight mechanic:** as the caller describes each panel ("you should be seeing a map on your screen right now..."), briefly dim all other panels so the one being described feels lit up. A CSS class on `#desktop` + per-panel overrides can do this cleanly — something like `#desktop.spotlight [data-panel] { opacity: 0.25 }` with an explicit `[data-panel="map"] { opacity: 1 }` to pull it forward. Short transition in, short hold, then fade back out.

**What the tutorial should cover (roughly):**
1. The map — districts, what the colors mean
2. Contacts — how to open a call, how to reply
3. The dispatch roster — what units are, how to send them somewhere
4. COMMS — what the radio feed is telling you and why to watch it
5. Then: "Good luck. You're on your own from here."

**Tone:** in-universe. Not a game tutorial screen. Someone on the other end of the line. Could be a supervisor, could be a recorded training line that gets interrupted by the real situation starting. The handoff from tutorial to chaos should feel like a gear shift, not a menu transition.

**Keep it short.** Players who already know what they're doing should be able to skip it (a "skip training" option on the start screen). Players who don't should feel oriented, not lectured.

---

## Later / Backlog

### District Consequences (gameplay weight)
- `SECURED` status: zombies cleared, slowed reinfection, maybe unlocks something
- `OVERRUN` status: loot inaccessible, civilians 0, spreads faster
- These states should appear on the map (color shift or label) and in the radio feed

### Combat Mechanics Overhaul (future)
Does unit damage scale with number of people in the unit? Currently each person gets one attack roll per tick regardless of unit size — worth revisiting if we ever do a proper fight mechanics pass. Larger units may feel more powerful through survivability alone right now, but concentrated firepower scaling is an open question.

### Win Condition (currently undefined)
design.md says "survive N ticks or contain spread below threshold" — needs actual design. Options:
- Survive until dawn (fixed tick count) — simple
- Secure X% of the city — spatial
- Keep a specific district (City Hall?) alive the whole game — narrative
- All three in escalating difficulty tiers

### Windowed UI flavor additions
We went to the trouble to really make this look and work like a computer with windows, let's add some fake icons to the destkop, or maybe they correspond to the windows too. And maybe some kind of desktop background - civil, federal, radio operator - once we are sure about the flavor of dispatcher we can do stuff like this to really sell the time and place. 

### Time overhaul
Seriously consider swapping from a time since game start to time in the world time. So start at 9:00 AM for example, much like Zomboid. The start of a work day. Or set it at night as an overnight job for thematic framing. Either way, tracking real world time will allow me to stop saying "wait x ticks" for something to happen, and give you a number in hours.

### Sound
Someday. The radio crackle is an obvious first piece. Ambient hum. Unit acknowledgement clicks. NOT voice acting. The zomboid EBS vibe works precisely because you hear noise and read text — your brain fills in the voice.

### Pure Data Removal (long game)
Eventually:
- No HP numbers on units — just status words (HEALTHY / WOUNDED / CRITICAL)
- No zombie counts (god mode is basically dev mode, not exposed in the final game) — just density (CLEAR / LIGHT / HEAVY / OVERRUN)
- The only source of truth is the radio and the callers

This is a late-stage pass, not something to design around now. But keep it in mind when adding new UI — ask "can this be expressed narratively instead?"

---

## Future: Notification / Alert System

A lightweight popup layer for events the player must not miss — distinct from the radio feed (which is ambient) and contacts (which require action). First use: unit disbanded (all people dead). Design as a general hook so other systems can push to it later (director events, story beats, district overrun, etc.). Should auto-dismiss after a few seconds but be visually distinct enough to catch peripheral attention.

---

## Future: Director Object

A scripting layer that watches game state and injects events, caller triggers, and story beats in response to conditions. The goal is manufactured drama — not random events, but authored situations that exploit the current state of *your specific game* to create a real decision.

**The essence of what it should do:** fire breaks out at Memorial Hospital (Director injects this). Director checks which units contain a person with a firefighter role. Firefighters have a hose. A hose counters fire. Now the player has a real choice: dispatch the fire team to put out the fire, or keep them fighting zombies. That tension — role-specific capability meeting a targeted crisis — is the drama. The Director's job is to manufacture that moment, not just randomize events.

**Architecture sketch:** a collection of authored "beats," each with a condition function (reads game state) and a trigger function (injects an event, spawns a caller, mutates a district). The game loop runs the Director's condition checks each tick and fires beats when conditions are met — once, or on a cooldown, or repeatedly. Keeps authored content completely decoupled from the simulation. Pairs with the Events System and the onboarding tutorial. This is the "storyteller's hand" referenced elsewhere in this doc.

---

## Future: Item Death Transfer + District Loot Pool

On person death, each carried item has an X% chance to transfer to the district's loot pool rather than vanishing. District holds `items[]` alongside its other state. Any unit entering the district can pick items up (auto or manual — TBD).

This is a behind-the-scenes shortcut that avoids keeping body entities in the model while producing real emergent gameplay: sending a lone runner or a desperate unit into a long-fallen district to scavenge becomes a meaningful risk/reward call. The more dangerous and overrun the district, the more likely dead people dropped something worth recovering. Implement alongside or shortly after the Person refactor — district loot pool is a natural add to the district object.

---

## Future: Unit-Scoped Morale

A morale meter attached to the Unit (not individual people). Drops on bad outcomes (member lost, district overrun nearby), rises on success. Affects combat effectiveness or response time. Mostly a display/flavor hook for now — gives the unit card a second axis of character beyond HP. Design later once the Person refactor settles.

---

## Known Bugs / Polish
- Window resize from N/W edges doesn't clamp (can push window off-screen while resizing — low priority)
- SITREP window shows "GOD MODE REQUIRED" as primary content in normal play — this should eventually become the radio feed
- **Contrast pass needed across the whole UI.** Many text elements are too dim against their backgrounds — readable in dev but not in real play conditions. Needs a systematic audit: panel labels, radio messages, district info text, start screen epitaph, taskbar states, item descriptions. Target: everything intentionally dim should still be legible; only decorative/idle elements should be near-invisible.
