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
named vs. unknown caller, a story arc vs. an ambient report — none of it should be guessable
before the player actually reads the line. Mixing real tactical intel into story calls (and vice
versa), and making some routine-sounding calls secretly significant, keeps the player reading
instead of pattern-matching.

**Player advice should carry real weight.** Telling a caller to run, telling a unit to redeploy
— both should cost something. See Movement & Risk, below.

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
scripted callers, ambient callers with names — these have health, items, a location, and can
die individually through the combat system. Killing a zombie in combat decrements the same
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

The core identity type: name, role, health, items, a location, and a `sim` flag. `sim` controls
**combat participation only** — whether the counterattack system can target them, whether they
roll attacks. It never touches the crowd numbers. A Person with `sim: false` is protected from
random combat death; their fate (if any) is authored.

### Units

Containers of Persons, dispatched by the player, with an activity (ENGAGE / HIDE / SCAVENGE).
Units are mobile and active across a whole district — they do not occupy a specific location
within it the way a caller does. That's the distinguishing trait of a unit versus a caller: a
unit is doing something across the district; a caller is somewhere specific, staying there
until told otherwise.

### Callers

Every caller — named, scripted, or anonymous — has a real Person behind them. There is no
caller that exists only as a phone thread with no identity. A **Contact** is the phone thread
itself; the Person is who's on the other end. This unifies what used to be two different systems
(scripted callers with Persons, ambient callers without) into one: any caller can have a
location, can have items, and can die through the same mechanism, whether or not anyone
authored their specific fate.

**COMMS broadcasts are not callers.** They're ambient radio chatter — no identity, no inbox, no
Person. Keeping this distinct matters: COMMS should read like a scanner the player is half-
listening to, not a third inbox to manage.

---

## Content System

Story content comes in three tiers, each with different rules about randomness and stakes.

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

### Ambient zone reports — the filler

The existing tiered caller pool, reporting district danger level in flavor language rather than
numbers. This is where replay randomness lives — pools tagged by difficulty band and rough time-
of-night appropriateness, drawn randomly within those bounds, so a replay feels different without
compounding into an accidentally brutal or accidentally trivial run.

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

---

## Onboarding

The tutorial is in-fiction: the last stretch of the day shift, handed off by a colleague before
the real situation starts. It runs before the game clock starts at all — the clock does not
begin until the handoff ends or the player skips it. Skipping lands the player at the same
starting state with a one-line summary instead of a walkthrough; it does not change the actual
game state.

The handoff is taught by doing real (if mundane) dispatcher work — an Incident or two, a routine
dispatch — rather than by explaining the UI directly. The colleague disappears once the real
situation starts; their identity and fate are not yet decided.

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
