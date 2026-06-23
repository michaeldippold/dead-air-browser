# Dispatch — Game Design Document

> This document is the canonical answer to "what is this game." todo.md tracks what's built and
> what's queued to build it; scratchpad.md is working ideation space. This file is where settled
> identity, premise, and systems-level philosophy live, independent of build status.

---

## Premise

You are a night-shift emergency communications supervisor. Not a hero, not police — the voice
on the other end of the line. You coordinate police, fire, and civilian response across a city
during a 12-hour overnight shift that goes very wrong.

You are physically safe and informationally crippled. You never see a zombie. You never see a
street. You see a map of districts, a handful of voices on the phone, and the radio chatter of
units you can't watch in action. Every decision is made with less information than you want,
and the game does not get easier once you understand it — it gets clearer, which is different.

This identity does real work:
- It explains why everyone calls *you* — 911 is the number.
- It explains your authority over police, fire, and civilian units — dispatchers coordinate all of them, nobody else does.
- It sets up a real tension with anyone above you in the org chart (Office of Emergency Management) who has more formal authority and less useful information.
- It explains the aesthetic — radio feeds, status boards, a desk, not a battlefield.

---

## Setting

**The town:** Lexington, Kentucky — picked as the real-world setting. The game's title is
**Dead Air** (topbar shows this, not the city or "Dispatch"); the desktop background is a
Lexington-Fayette Urban County Police badge, recolored to match whatever theme is active. District
labels are now real Lexington-flavored names (Joyland, Winburn, Castlewood, University of
Kentucky, LPD HQ, Station No. 1, LFUCG Govt Center, Good Samaritan Hospital, Old Iron Works,
Kendrick Ave, Market St, Newtown Commerce, The Red Mile, Lexington Quarry) — internal district IDs
are unchanged, only the `label` field and map text. University of Kentucky and The Red Mile are
classified `government` and `retail` respectively (not `residential`), which feeds their loot
table and COMMS flavor. Still open: deciding what the city's declining industry was
(steel, auto parts, textiles, tobacco) — that detail should flavor caller voice and district identity,
not just the skyline.

**The timeframe:** a single overnight shift, **20:00–08:00**. Not open-ended. The original
vision was an open-ended sim, but that conflicts directly with being a narrative game — finite
authored content needs a finite container, and a game that can't be optimized into a routine
needs an ending that isn't negotiable. Win condition is survival to **dawn, 06:00** — not the
end of the shift (08:00), which is administrative. Dawn means something. Shift-end doesn't.

**Target session length:** roughly 30 real minutes per run. The night's structure (see Content
System, below) maps cleanly onto the actual hours — early evening is calm, midnight is a hinge,
2–4 AM is the hardest stretch, pre-dawn is desperate, and dawn is earned, not administered. This
structure was free — it came from the clock, not from design effort.

---

## Design Philosophy

**The player never gets clean numbers.** The simulation runs with full fidelity in the
background, but everything the player sees is mediated — a radio feed, a voice on the line, a
unit's last transmission, a map color trending the wrong way. The engine is on one side, the
player on the other, and the interface is a machine that turns state into narrative, not a
dashboard that turns state into numbers.

**The win screen is a myth, and that's intentional.** Winning takes skill and luck both. If a
player finishes a full run assuming a win state doesn't exist, that's the correct experience.
The game is about the decisions made under incomplete information, not the scoreboard at the
end. Don't design features to be optimized — design them to be *survived*, once, under pressure,
with consequences that can't be undone.

**Nobody should be able to triage the call list at a glance.** A pending-response indicator, a
named recurring character vs. a one-off Incident, a routine-sounding call vs. a secretly
significant one — none of it should be guessable before the player actually reads the line. Mixing
real tactical intel into story calls (and vice versa), and making some routine-sounding calls
secretly significant, keeps the player reading instead of pattern-matching. (Anonymous zone
reports used to sit in this list too; they've moved to COMMS as police chatter — see Content
System — so the call list is now exclusively things worth reading closely.)

**Player advice should carry real weight.** Telling a caller to run, telling a unit to redeploy
— both should cost something. See Movement & Risk, below.

**Dispatch is two verbs, not one.** Sending a unit to a *district* is a sim move — suppress a hot
zone, reposition for what's coming, try to win the simulation under fog. Sending a unit to a
*caller* is a story move — you're answering a specific person, and the unit is tied up with them
until the beat resolves, doing nothing else. The first is optimization; the second is a narrative
commitment with real opportunity cost. Keeping them mechanically distinct — a district move runs
ENGAGE, a caller dispatch enters RESPONDING and waits, insulated from the sim — is what makes
triage a genuine decision instead of a free action.

**The district map is a strategic abstraction, not a literal one.** Districts don't represent
"X zombies standing in a field" — they represent how bad an area's situation is right now. The
map tells the player *where* to look. Callers tell them *what's actually happening there*.
Neither tells the whole picture on its own, and that's correct — a building-level map is a
different game, and explicitly out of scope for what's buildable in a browser.

---

## The World

### Districts

A fixed set of named districts, each with a category (residential, government, medical, retail,
industrial), forming a graph via adjacency — not a literal geometric distance, a hop-count
graph. That graph is reused for two purposes: zombie inter-district spread, and travel time (see
Movement & Risk).

### Two population ledgers, not one

Every district tracks an **anonymous crowd** — `humans` and `zombies`, plain numbers, no
identity, governed by an SIR-style spread formula. This crowd never resolves into individuals.
Most people in a disaster are statistics; that's the city the player is failing or saving in
aggregate.

Separately, **named Persons** exist alongside the crowd, not as a subset of it. Unit members,
scripted story callers, the people behind Incident calls — these have health, items, a location,
and can die individually through the combat system. Killing a zombie in combat decrements the same
`district.zombies` number the crowd formula reads — the two systems are connected, just at
different resolutions. A named Person dying does not move the crowd numbers; a crowd conversion
does not touch named Persons.

### Locations within a district

Districts are too coarse a unit to make "where, exactly" feel real, and a building-level map is
out of scope. The middle ground: every district has a small set of **locations** a Person can
occupy.

- **General categories**, identical rules everywhere: **Outside**, **Private Residence**,
  **Business**. These need no authoring — they work the same in every district from day one.
- **A small number of named story locations per district** (two or three, at most), authored
  only when a piece of content actually needs one. A district with no scripted arc needs zero
  named locations.

Location is never rendered on the map. It's metadata — a modifier on exposure and a label in
contact text ("Marcus Webb — Old Iron Works, Loading Dock"), nothing more.

Mechanically, location is a multiplier on the same threat-weight system that already governs
combat targeting (the same lever the HIDE unit activity uses). Outside means high exposure.
Residence means low. No new simulation layer, no new per-tick phase.

Location safety is not immunity — it degrades as a district's zombie ratio climbs. A secure
residence buys time at 10% infection; it's just delaying the inevitable at 90%. The crowd
eventually reaches everyone. Location only changes how long it takes.

---

## People

### Persons

The core identity type: name, role, health, items, a location, and a `sim` flag. `sim` governs the
single most important question about a person: **is the simulation allowed to decide their fate, or
only the script?** It controls combat participation (whether the counterattack can target them,
whether they roll attacks) *and* call resolution (whether a dispatched unit's arrival can save or
lose them by the generic roll — see Content System, "On resolving a call"). It never touches the
crowd numbers.

- A **`sim: true`** Person is fully in the sim's hands — killable in combat, and resolvable (saved
  or lost) by the generic call roll. This is the **lightweight filler caller**: a random call about
  zombies that just needs handling or it doesn't, with no hand-authored ending.
- A **`sim: false`** Person is protected from the sim entirely — no random combat death, and no
  generic call roll. Their fate is *only ever* authored, through their script. This is the
  **heavyweight spine character**: the calls that carry the main mission, whose outcome is decided
  by the player's choices in the script flow, never by a background dice roll.

That one flag is the clean line between the two kinds of caller content — heavyweight authored
arcs versus the filler the player simply deals with or doesn't.

### Units

Containers of Persons, dispatched by the player, with an activity (ENGAGE / HIDE / SCAVENGE /
RESPONDING). RESPONDING is the busy state a unit enters when dispatched to a specific caller: it
sits in the caller's district, visible on the map, but is **insulated from the sim's combat loop
entirely** — it neither kills zombies nor can be killed by the ambient counterattack. A unit on a
call is not also a multitasking zombie-killing machine; answering a person costs you that unit's
sim presence until the call resolves, at which point it reverts to ENGAGE. Its only stakes are the
caller's authored content (or a generic fallback). Units are mobile and active across a whole
district — they do not occupy a specific location within it the way a caller does. That's the distinguishing trait of a unit versus a caller: a
unit is doing something across the district; a caller is somewhere specific, staying there
until told otherwise.

### Callers

Every caller in CONTACTS — named story character or one-off Incident — has a real Person behind
them. There is no caller that exists only as a phone thread with no identity. A **Contact** is the
phone thread itself; the Person is who's on the other end: any caller can have a location, can have
items, and can die through the same mechanism, whether or not anyone authored their specific fate.
(The old anonymous "ambient caller" — a report with no real person behind it — is no longer a
caller at all; that filler moved to COMMS as police chatter. See Content System.)

**COMMS carries identity now, but it is still not an inbox.** (The old "COMMS broadcasts have no
identity" rule is retired — it made COMMS read like perfect status text from nobody.) COMMS is the
overheard scanner: the player's own dispatched units echo status here, and off-duty / quick-
response police officers who aren't in any dispatchable unit radio in district reports. What keeps
it distinct from CONTACTS is not anonymity but direction — COMMS is half-listened-to broadcast,
never a thread the player replies to. A unit's repliable channel is its CONTACT entry; its COMMS
lines are the version everyone else overhears.

---

## Content System

Story content comes in three tiers, each with different rules about randomness and stakes.

**On silence and timers.** Every scripted node's `timer`/`timerNext` pair is optional, not a
default inclusion — most nodes should have none at all, and wait indefinitely for the player to
choose. There is no visible countdown anywhere in the UI, and there won't be one; a hidden clock
is the right amount of pressure, a literal one would feel like an RTS objective marker. When a
node *does* carry a timer, the `timerNext` outcome must be a specific, deliberately authored beat
that earns its place in that character's story — never a generic "the player didn't answer"
filler or a blanket death for not picking up the phone fast enough. Silence is not nothing, but
it has to mean something specific to be worth writing.

**On answering.** Picking up a call is a deliberate act, not a passive notification. An unopened
caller sits in the list with nothing knowable about them — no preview, no severity, not even an
unread flag — until the player actually opens the thread. Only then does the dispatcher's own
line ("911, what is your emergency?") fire, followed by a beat of silence before the caller
actually speaks. This is "nobody should be able to triage the call list at a glance," made
literal: there is nothing to triage on a call that hasn't been answered yet. The one exception is
the tutorial handoff — Barbara doesn't dial 911 to onboard the player.

**On arrival.** When a dispatched unit reaches a caller, the arrival is handed to the caller's
script hook along with *who showed up* — the unit, how many units, and their roles (a fire crew vs
a police unit vs a civilian squad). Authored content can branch on any of it: the character reacts
to the unit type, a beat forks on whether enough force arrived, or the call simply resolves. This
is the first point where authored content touches a specific unit at all — everything before reacts
to time, place, and zombie state, never to the player's own roster. Two layers keep authoring
cheap: the radio chrome ("en route," "on scene") is generated automatically for every dispatch,
while the story (what the unit finds, mid-beats, the resolution) is authored per caller and
optional. If several units answer the same call, the first to arrive owns its resolution — the
caller reacts once, not once per unit — and the rest are backup: present and insulated, checking in
on their own threads but not re-triggering the caller's beat. Backups still *matter*, though (see
below): more force improves a filler caller's odds, and the count and roles are handed to an
authored script to use however it likes.

**On resolving a call.** How a call *ends* is governed entirely by the caller's `sim` flag (see
People → Persons) — this is the whole reason that flag exists:

- **`sim: true` (filler):** the call resolves with a single, terminal **save/lose roll**, weighted
  by the responding force (more units → better odds, with diminishing returns) and the district's
  danger. It fires *once*, at the end of the response window — not as continuous exposure. **Saved
  means extracted:** the person comes *off the board* — evacuated out of the district, removed from
  the sim, permanently safe. That is the deliberate guarantee that a saved caller cannot quietly die
  five minutes later once the unit leaves: saving them *is* removing them from danger. **Lost means
  they die** at that moment. Either way the outcome is sealed. This is why sending too little to a
  bad call is a real failure — and why blobbing every unit at one call is still a mistake, since the
  responding units are off the sim the whole time (see Design Philosophy, "Dispatch is two verbs").
- **`sim: false` (spine):** *no roll, ever.* The outcome is 100% the script's — the arrival fires a
  beat, the player's choices and the script's flow decide save vs lose, and the script ends the call
  itself. Send no help and the script handles that with its own authored beat. The danger-weighted
  roll never touches a spine character.

**Every resolution leaves the player closure, because there is no scoreboard.** On a save, *both*
the caller and the responding unit sign off — the caller's final message is the one piece of
feedback the player gets that they did well ("you got us out, thank you — we're clear"), a character
telling them, in effect, how they did, before leaving the call log for good. On a loss, the caller
and/or the unit report it — a last transmission, a unit confirming what they found. Without these, a
`sim: true` caller would simply vanish from the list and the player would never know whether they
were saved or not. The sign-off *is* the score.

**On completion and timers.** A unit is dismissed from a call back into the general pool by
`completeResponse`, and *when* that happens is the script's call for authored content — the script
runs it when its beat resolves, with no clock on a spine character. The only timer is the generic
path's response window, after which the `sim: true` roll lands; it is a per-call window, never a
global "you've had an hour, succeed or fail" clock.

### Spine — the Scenario

One to three named characters, fully authored, the best writing in the game. Anchored to
triggers (district infection reaching a place, a specific time) — never randomized in timing or
selection once a scenario is chosen. A scenario has a length dial:

- **Short** — one character, a tight arc that resolves within a fraction of the night.
- **Long** — multiple characters whose arcs can intersect (see Movement & Risk — sending two
  callers to the same named location and having the Director notice both arrived is how
  multi-character beats work without any new infrastructure).

A "Random" scenario option exists for replay value once a player has already seen the authored
content — it draws more heavily from filler and guarantees no specific named arc.

### Incidents — the routine job

Generic, non-zombie scripted events: fire calls, crime calls, welfare checks, false alarms. This
is what makes the world feel like a real 911 board instead of a zombie game wearing a dispatcher
costume — and it's also the tutorial content, since these calls are inherently zero zombie-
threat. They reuse the exact same authored-script format as named characters (text, choices,
timer, resolve), just shorter and without a persistent identity. The mechanical stakes are
opportunity cost, not simulation complexity: dispatching a unit to a fire ties it up for several
ticks, unavailable for whatever the zombies are doing elsewhere. No new sim systems, no new
items — a fire unit has a hose because it's a fire truck.

Some Incidents should be deliberately ambiguous about whether they're zombie-related at all — a
welfare check for someone "acting erratically" reads as routine and might just be routine. That
ambiguity is a feature: it's one more way to stop the player from sorting calls by importance
before they've read them.

### Ambient police chatter — the filler

The tiered ambient pool, rethemed from "civilians calling in" to **off-duty / quick-response
police officers** radioing district status over the scanner. The player's handful of starting
officers are the ready quick-response teams, not every cop in the city — so other officers exist,
report in, and are *not* dispatchable. (A small, accepted immersion cost: if there are more police,
why can't the player send them? Because these are the ones already on the board.) The danger-tier
escalation system survives intact — an actual zombie-count tier the player never sees directly
picks how dire the radioed line sounds — as does the difficulty-band / time-of-night tagging that
keeps replays varied without compounding into an accidentally brutal or trivial run.

This content lives in **COMMS, not CONTACTS**. CONTACTS is the active surface — stories, Incidents,
and unit threads, things with back-and-forth and stakes. Ambient reports are passive info-income,
which is what the scanner is for. Moving them here is also what humanizes COMMS: instead of perfect
status text from nobody, the player overhears specific officers in specific districts.

**Degradation is the fog of war.** Each scanner line garbles as the *reporting district's* zombie
ratio climbs — per-district, not a global clock, so a calm district still sounds calm while an
overrun one sounds like hell at the same moment. Structured radio discipline ("be advised,
10-96…") corrupts over time into static, fragments, panic, screams; a fully overrun district can
fall silent on the air entirely. The information is real and useful early, and decays exactly when
the player most needs it clean — early-warning radar and fog of war in the same mechanism.

---

## Difficulty vs. Scenario

Two independent axes, chosen separately at game start:

- **Difficulty** — simulation parameters. Spread rate, zombie density, starting seed pattern,
  unit strength. Answers "how hard is the sim fighting me."
- **Scenario** — which spine content is loaded. Answers "whose story am I living through."

They compose freely. The same scenario can be played easy or hard; the same difficulty can pair
with any scenario.

---

## Movement & Risk

Nothing in the game animates movement. Distance is graph distance over the district adjacency
map — hop count, not geometry — and that one piece of data drives two related mechanics:

**Unit travel.** Dispatching a unit between districts takes time proportional to hop count, not
instant teleport. Units are vehicle-equipped and move fast per hop. While in transit, a unit is
not present in any district — not on the map, not clickable, not contributing to combat or
suppression anywhere — until it arrives.

**Caller travel — "Outside."** Telling a caller to relocate (run, evacuate, regroup at a named
location) puts them into the Outside category for a period of real exposure — much higher risk
per hop than a unit, because they're on foot and alone. This is deliberate: player advice to a
civilian should carry the same weight as a tactical order to a unit, but the risk profile is
completely different, and the player should feel that difference. Watching someone you told to
run go silent mid-transit is the emotional core this mechanic exists to produce.

Both kinds of transit surface in a single TRAVELING list, sorted by soonest arrival, showing
units (their unit map-dot, role-colored) and callers (bare name) side by side. The stakes differ
— a unit in transit is an opportunity cost, a caller in transit can die — but the row format
doesn't telegraph which. Reading the name is the only way to know.

---

## Win / Lose

- **Win** — survive to dawn, 06:00.
- **Lose** — all units dead; ten or more districts reach critical infection ratio; too many
  units disbanded over the course of the night.

All four conditions are about the player's situation, not a score. There is no partial credit
and no replay-to-optimize loop — a finished run, win or lose, is the experience.

**Candidate (not yet adopted):** a further lose condition — *failing the job itself*: letting too
many calls go unanswered or unresolved over the night. It's the purest dispatcher failure — you
didn't have to lose the city, you just stopped doing the work — and it pairs directly with the
dispatch-to-caller verb. Needs a definition of "too many" and which calls count (it depends on the
call-resolution model above being able to tell answered/resolved from ignored). Tracked in todo.md.

---

## Onboarding

The tutorial is in-fiction: the last stretch of the day shift, handed off by a colleague before
the real situation starts. It runs before the game clock starts at all — the clock does not
begin until the handoff ends or the player answers no to a refresher. There is no separate skip
button; declining is itself the first RESPOND choice the player ever makes, and it lands them at
the same starting state with a one-line summary instead of a walkthrough — it does not change the
actual game state.

The handoff is taught by doing real (if mundane) dispatcher work — an Incident or two, a routine
dispatch — rather than by explaining the UI directly. The colleague is **Barbara West**. She
doesn't vanish once the real situation starts: she hands off the board, then travels off-screen
to a residential district through the same transit system units use, landing as a normal Person
exposed to the simulation like anyone else from that point on. Her fate beyond that point is not
authored. She's also the one exception to "On answering" (Content System, above) — she doesn't
open with a 911 line, since it would be strange for a colleague handing off the shift to dial it.

---

## Explicitly Out of Scope

- A building-level or street-level map. The district abstraction, backed by named locations
  within it, is the intended fidelity. Don't reach for more granularity than that.
- Animated movement of any kind. Distance and time are represented through countdowns and lists,
  not motion on the map.
- A real inventory or equipment system. Items only exist where they modify a simulation outcome
  (combat, healing, intel reveal). If something would only ever matter narratively, it doesn't
  need to be a tracked item.
- An open-ended/endless mode as the primary experience. The night has a beginning and an end.
