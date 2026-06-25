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
triage a genuine decision instead of a free action. The two are *coupled* but never equalized: a
resolved caller does give a little back to the simulation (see "On resolving a call"), but always
less than engaging would have — so the caller move stays the inferior *pure-sim* play even as it
stops being pure cost. That gap is the point — it keeps district dispatch the optimization and
caller dispatch the commitment.

**The district map is a strategic abstraction, not a literal one.** Districts don't represent
"X zombies standing in a field" — they represent how bad an area's situation is right now. The
map tells the player *where* to look. Callers tell them *what's actually happening there*.
Neither tells the whole picture on its own, and that's correct — a building-level map is a
different game, and explicitly out of scope for what's buildable in a browser.

**The two halves must reinforce each other, or they're two games sharing a screen.** The simulation
and the story are not a balance to strike — they're one experience, and the work of design is to
remove the seam between them. The sim exists to be a pitiless, unscriptable antagonist that keeps the
story from ever running on rails; the story is why the player cares whether the sim is held.
Concretely, each side must discipline the other: answering callers has to carry real (if bounded)
weight in the simulation, and neglecting the simulation has to cost the player real ground. When the
two only touch at a single point — a unit leaving the board to answer a call — and that point is
pure cost, the player correctly learns to ignore one of them. The fix is never to balance them on a
scale; it's to make district-work and caller-work feel like the same job seen from two angles. (The
mechanics that deliver this live in Content System, "On resolving a call.")

**Information is the real currency, more than firepower.** In a game built on being informationally
crippled, what most changes a player's odds is not three more dead zombies — it's knowing where to
look. This is why the rewards for good play lean toward *intel* over *force*, and why the exact
per-district zombie counts (the dev-only SITREP / god view) must never be visible to the player. The
moment the player can read raw numbers, the machine-in-the-middle is gone and the game is a
dashboard. The numbers run with full fidelity in the engine; the player only ever receives them
mediated.

**Every loss must be legible.** If a player loses and has no earthly idea *why*, the game has failed
them. A loss does not need to over-explain — no post-mortem screen, no breakdown of contributing
factors — but the player should always be able to name the cause: *I spread myself too thin; I poured
everyone into a district that was already gone; I stopped answering the phone.* This is the deep
reason the lose conditions stay specific and distinct rather than collapsing into one hidden number
(see Win/Lose): a specific cause is a story the player tells about their own night, and that story is
the entire point of a run that keeps no score.

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
entirely** — while it waits it neither kills zombies nor can be killed by the ambient counterattack during the call. A unit on a
call is not also a multitasking zombie-killing machine; answering a person costs you that unit's
sim presence until the call resolves. The one exception is the resolution itself: a successful
rescue is never bloodless — the unit shoots its way in — so completing a call produces a one-time,
bounded local suppression *at the moment it resolves* (see "On resolving a call"), after which it
reverts to ENGAGE. The during-call insulation is the cost; that at-resolution suppression is the
small reward, and the two never overlap. Its only stakes are the
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
identity" rule is retired — it made COMMS read like perfect status text from nobody.) Today COMMS is
exactly one thing: the overheard police scanner — off-duty / quick-response officers who aren't in
any dispatchable unit, radioing district status by badge number. The impersonal system lines
(movement detected, area clear, units en route) were *removed* so that every entry is a human voice,
not a status readout. What keeps COMMS distinct from CONTACTS is direction, not anonymity — it's
half-listened-to broadcast, never a thread the player replies to. A unit's repliable channel is its
CONTACT entry, where its own en-route / on-scene reports live; whether any of that unit-and-event
traffic should *also* surface in COMMS later, retooled into scanner voice, is an open question
(tracked in todo.md). For now the feed is purely ambient chatter — and that turned out to be the
right flavor.

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
  responding units are off the sim for the entire response window — the at-resolution suppression is a
single instant, not ongoing presence (see Design Philosophy, "Dispatch is two verbs", and "On what a
rescue does to the simulation" below).
- **`sim: false` (spine):** *no roll, ever.* The outcome is 100% the script's — the arrival fires a
  beat, the player's choices and the script's flow decide save vs lose, and the script ends the call
  itself. Send no help and the script handles that with its own authored beat. The danger-weighted
  roll never touches a spine character.

**On what a rescue does to the simulation.** A successful rescue is never bloodless, and that is the
bridge between the two halves of the game (see Design Philosophy). Completing a call produces a
bounded, one-time effect on the district *at the moment of resolution* — not continuous combat while
the unit waits, which stays insulated. The effect comes in two flavors, tuned oppositely. **Force:**
a few zombies die in the breach, and *occasionally* an able-bodied survivor joins the rescuing unit
(capped at unit size, and only when the Person actually is one — the frightened child does not pick
up a fire axe). Force is held under a hard invariant — **a rescue's suppression must always be
strictly less than what that same unit-time would have killed on ENGAGE** — so callers are never the
*efficient* way to fight the sim, and "answer every call" can never win. **Information:** the rescued
survivor saw things on the way out, and a save lifts a sliver of the fog (a read on an adjacent
district). Information is self-limiting — it kills nothing, and the player still needs finite units
to act on it — so it can be given generously, and it is the most on-theme reward the game has. The
reinforcement this creates is *structural*, not a flat bonus: a player who only engages concentrates
force on the hottest districts and loses on **breadth** as quieter districts creep to the
critical-district threshold behind them, while answering callers scatters the player across the map,
thinning crowds and lifting fog exactly where concentrated play is blind. District-work covers depth,
caller-work covers breadth, and either failure is lethal — the seam collapsing into one coverage
problem seen from two angles.

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

**On where grief lives.** The gut-punch — the call you replay in your head, the *please don't die*
as a unit rolls out — is reserved for the spine. The generic, `sim: true` callers are ordinary
people you'd pass on the street: their stories are real and worth answering, but they are not grand
tragedies, and their fate can be a roll, because a roll produces *ambient* grief (the people you
couldn't get to) which is the right weight for them. The heavy, authored deaths must be `sim: false`,
because only an authored arc can make a death feel *caused by the player's choice* rather than
unlucky — a hidden dice roll produces "unlucky," a branching script the player steered produces "I
did this." If you want a death to wreck someone, you write it; you do not roll it. That writing is
what the spine is for: multiple characters, real branching pivots with consequences, cohering into a
single story the player effectively chooses their way through — different every run.

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
status text from nobody, the player overhears specific officers in specific districts. Each officer
is identified by a stable **badge number** (one per district — a placeholder for a fuller identity
later), and lines read `[Badge #NNN]: …` with the district named *inside* the message body rather
than in a variable-width prefix, so the fixed-width prefix keeps the feed skimmable. (Built and live.)

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

**One way to win, many ways to lose.** This asymmetry is load-bearing, not incidental — borrowed
deliberately from games like This War of Mine — and it does three jobs at once: it forces balanced
play without any balance meter, it gives every run its replay variety through the *texture of
failure*, and it gives each loss a specific cause the player can feel responsible for.

- **Win** — survive to dawn, 06:00. The win is **binary and singular** — you made it or you didn't.
  Its *flavor* may vary with the state of the night, but it is never *graded*: there is no good-win
  or bad-win, because the moment a win carries a quality score the game has a scoreboard again.
- **Lose** — several distinct conditions, each anchored to a concrete, legible circumstance so the
  player can always name what went wrong:
  - **All units dead** — you spent your people.
  - **Ten or more districts at critical infection** — the city was physically overrun; this is the
    *breadth* failure, the price of concentrating force too narrowly.
  - **Too many units disbanded** — attrition ground you down.
  - **Failing the job** — too many calls left unanswered or unresolved over the night: the purest
    dispatcher failure, where you didn't have to lose the city, you just stopped doing the work.
    **Adopted — no longer a candidate.** It is the *stick* that makes the call list matter, the
    counterweight to a lose model that otherwise only ever punished losing the simulation. It still
    depends on the call-resolution model (to tell answered/resolved from ignored), and "too many" /
    "which calls count" remain to be tuned (todo.md).

All of these conditions are about the player's situation, not a score, and **the finite roster is
what makes them reinforce one another**: a unit on a call is a unit not holding the city, and a unit
holding the city is a unit not on a call, so the breadth, attrition, and job failures are all
fighting over the same scarce units. The systems don't need to mechanically interlock — they only
need to *both be lethal*, with one roster to spend between them. Over-tend the calls and the city
falls; over-tend the city and you fail the job.

**Every loss is legible, and the loss reads the board to author its own ending.** A loss must never
feel arbitrary, so each condition telegraphs its approach through its own surface — districts
darkening on the map, COMMS fraying into static and going silent, the OEM/supervisor's calls
sharpening as the job slips, unit threads thinning out. The loss should feel *caused and foreseeable
in hindsight*, never a number springing from nowhere. And at the instant a condition fires, the game
checks the state of the board — how many districts still held, how many people were pulled out, what
time it is — and uses it to color the end-text. "CITY FALLEN, 03:14, four districts holding, nine
people out tonight" is a specific epitaph, not a generic one, and it costs nothing because the state
already exists. The specific cause *is* the score, in a game that refuses to keep one. There is no
partial credit and no replay-to-optimize loop — a finished run, win or lose, is the experience.

**"Oppressive but winnable" is a tuning target.** The feeling the difficulty aims for is *I almost
had it* — which means the common outcome should be losing **late and close**, not early and not
comfortably. That is a narrow band, and it is where This War of Mine lives: you usually lose someone,
rarely everyone, and the ending is relief rather than triumph.

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
exposed to the simulation like anyone else from that point on. Her *fate* beyond that point is not
authored — the sim decides whether she lives or dies at home — but she is not inert: she remains a
real, call-backable contact, and reaching her while she's still alive can yield a small authored
reward (an easter egg for the player who thinks to try, and who tries early enough — if the sim has
already killed her, the callback simply gets the standard "No response."). She's also the one
exception to "On answering" (Content System, above) — she doesn't
open with a 911 line, since it would be strange for a colleague handing off the shift to dial it.

---

## Touchstones

Two games mark the poles Dead Air sits between. **This War of Mine** is the model for
survival-sim-as-story-engine — one win, many graded losses, personalized epilogues, and a mechanical
system (there, mental health) that the moral choices feed. Its lesson is also a warning: that system
is load-bearing because *that* game's subject is psychological toll, whereas Dead Air's subject is
informational crippling — which is exactly why a morale scalar is the wrong central mechanic here
(see Out of Scope). **Papers, Please** is the model for the other axis — the mediated functionary,
the desk and not the hero, moral weight delivered *through* mundane procedural work rather than
beside it. Dead Air is the cross of the two: a survival sim experienced entirely from a dispatcher's
desk.

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
- A global "morale" or master score that the lose model hangs on. Flattening every event — callers
  saved or lost, districts falling, units dying — into one hidden scalar pegged to lose thresholds
  was considered and rejected. It collapses the distinct, *legible* causes of a loss into a single
  illegible number (the clean-numbers abstraction the game exists to avoid, even when the number is
  hidden), it turns the whole game into a hidden-score-optimization problem, and it makes the two
  dispatch verbs fungible. The one thing it offered — graded endings — is achieved instead by reading
  board state at the moment of loss (see Win/Lose). Morale is not banned as a future *local* mechanic
  (a per-district "hope" value feeding emergent events like survivor groups forming), but only where
  a specific mechanic needs it — never as the master lose condition.
