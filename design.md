# Dead Air — Game Design Document

> This document is the canonical answer to "what is this game." todo.md tracks what's built and
> what's queued to build it; scratchpad.md is working ideation space. This file is where settled
> identity, premise, and systems-level philosophy live, independent of build status.
>
> **Rewritten 2026-09-10.** The game was re-centered on the parts that were working (calls,
> dispatch, the real map) and away from the parts that never were (patrolling, suppression, a
> hidden sim the player was scored against). The reasoning for every dropped ruling is in
> "Superseded rulings" at the end, so nothing is lost silently and nothing gets reopened by
> accident.

---

## The game in one breath

You're the night dispatcher. The outbreak is the weather. Calls come in from named people at real
addresses, and reports pin fires, wrecks and sightings on a map that starts blank. You have a
handful of cars. Everything you see is provisional, and sending a car is the only way to learn
more. Choose who to answer, who to check on, who to stop for on the way, who to send where, and
who to leave. If you make it to dawn, you get to see how you did.

Every system in this document serves that paragraph. Anything that doesn't is out of scope.

---

## Premise

You are a night-shift emergency communications supervisor. Not a hero, not police — the voice on
the other end of the line. You coordinate police, fire and EMS across a city during a 12-hour
overnight shift that goes very wrong.

You are physically safe and you have almost no hands. You never see a zombie. You see a map of
the city with your own cars on it, a call list, a scanner, a phone directory, a binder of
procedures, and the memos your boss sends down. Every decision is made with less *capacity* than
you want, not less information: the dispatcher's tragedy is knowing exactly who is dying and
having three cars.

Trying to *control* a zombie outbreak would be hubris. You do your best, and if you survive the
night you get to see how you did.

This identity does real work:
- It explains why everyone calls *you* — 911 is the number.
- It explains your authority over police, fire and EMS — dispatchers coordinate all of them, nobody else does.
- It sets up a real tension with the people above you in the org chart — the Office of Emergency Management, the governor, the people the governor answers to — who have more formal authority and less useful information.
- It explains the aesthetic — a work computer, windows, feeds, a desk. Not a battlefield.

---

## The Desk

**The player is sitting at a work computer, and that framing is the whole game.** The windowed
desktop — CONTACTS, DISPATCH, COMMS, the taskbar, the badge wallpaper — is not chrome around the
game; it *is* the game's body. Every source of information is a window. Every action is something
you do on that computer or on the phone beside it. If the player ever stops feeling like they're at
a desk on the night shift, the whole thing falls apart. This framing was nearly cut more than once
and is now ruled permanent.

The consequence for design: **new information is a new window, not a new HUD element.** A phone
directory is a window. The procedures binder is a window. A log is a window. The work of the game
is flipping between them to put a picture together — see Information, below. **If the player can
play a whole night looking only at the map, the information hasn't been spread out enough.**

The touchstone for the workspace is *11:59* (GMTK jam): a fake PC is the entire interface and
operating it is the play. What Dead Air takes from it is the workspace. What it does **not** take
is the scramble — see Pace.

---

## Setting

**The town:** Lexington, Kentucky, the real one, rendered from OpenStreetMap (see The Map). The
game's title is **Dead Air**. **Nine districts** drawn from named road corridors — Downtown
(government), Northside, East End and Lakeview Acres (residential), University (government),
Southside, Red Mile and Hamburg (retail), West End (industrial) — with real hospitals, stations,
parks and malls as the named places inside them. Neither the names nor the count is sacred; move a
boundary by naming a road in the bake, don't add districts without a ruling. Still open: what the
city's declining industry was (steel, auto parts, textiles, tobacco) — it should flavor caller voice
and district identity.

**The timeframe:** a single overnight shift, **20:00–08:00**. The night ends at **dawn, 06:00**;
08:00 is administrative. The clock gives the night its structure for free: early evening is routine,
midnight is a hinge, 2–4 AM is the hardest stretch, pre-dawn is desperate, dawn is earned.

**Target session length:** roughly 30 real minutes per run.

---

## Design Philosophy

**The outbreak is weather, not an opponent.** The infection spreads on its own schedule and
nothing the player does reduces it. The player cannot fight the outbreak; they work inside it. This
is the single most important ruling in the document and the reason for most of the others. The
previous design asked the player to suppress an infection they couldn't see, which made the correct
instinct (answer the phone) compete with an optimization problem hidden in fog. Now the instinct is
the game. See The Infection for exactly what the sim still does.

**Complete information, scattered.** The old rule was "the player never gets clean numbers." That
rule only made sense when beating the sim was the game. The new rule: **nothing is hidden, but
nothing is in one place.** The caller gives a landmark; the directory turns it into an address; the
map turns the address into a district; the roster says who's free; the binder says what the
procedure is; the memo from OEM says the procedure changed an hour ago. Assembling that is the
work. This is the *Papers, Please* model — everything is on the desk and the difficulty is
cross-referencing under a clock — and it is truer to the premise than hiding numbers ever was.
Overdo this and scale back; undercooked, it feels optional, and then it's nothing.

**Nothing appears on the map until someone tells you.** The map starts blank except for your own
cars and stations. A fire, a wreck, a horde, a caller's house — each appears only when a caller,
an officer on the scanner, or one of your own units reports it, as a dated *mark*. Marks are
provisional: they never move, they never expire on their own, and they can be stale. The city is
coming apart in the dark and the map is the sum of what you've been told about it. See The World
→ Marks.

**Sending a car is how you learn.** Every mark is dispatchable. Send a fire unit to a fire and they
put it out. Send police to a horde sighting and they verify it — or report it gone, which is worse,
because you don't know which way it went. Interacting with the world is the only way to get an
update on it. Information costs a unit's time, and a unit's time is the only currency.

**Stopping on the way is the game.** A unit driving to one call passes something else — a person
flagging them down, a wreck, a fire starting. The unit radios in and asks. Stop, and the original
caller waits and might not last. Continue, and you drove past someone. This is the one decision
that is spatial, moral and scarce at the same time; it only exists because the map is real, only
matters because units are few, and is generated, so it scales without a script per instance.
Everything else in this document is a support for that moment.

**Pace: more than you can comfortably do, never click faster.** The game is not an RTS. Pressure
comes from having more calls, marks and decisions than hands, not from reflex. Pause exists and
stays. Simulation speed is load-bearing: the target feeling is "I lost someone and I almost had
it," not "I couldn't keep up with the interface." (If someone loves it enough to speedrun it, good
for them — the design just never *demands* speed.)

**Every ending is legible.** There is no score. A run ends in a specific way for a specific,
nameable reason, and the card at the end tells the story of the night in names and places. See
Endings.

---

## The World

### Districts

Nine named districts, each with a category, forming a graph via adjacency derived from their
polygons. **A district is the infection's unit of state, not the unit of position.** Every unit,
caller, situation and mark has a real position on the road graph; the district is derived from it
by point-in-polygon. The sim reads the district; the map and the story read the position.

### The crowd — one ledger, no names

Every district tracks an **anonymous crowd**: `humans` and `zombies`, plain numbers, no identity,
governed by an SIR-style spread formula. This crowd never resolves into individuals, and **nothing
the player does touches it.** Most people in a disaster are statistics; that's the city the player
is losing in aggregate while they save the ones they can reach by name.

### Places

- **Authored named places** — real buildings with footprints, addresses and entrance nodes (68
  baked, 5–10 per district): hospitals, stations, parks, malls. Dispatch targets. **Units go
  *inside* them, and so do rescued people.** This is load-bearing: it's what lets stories be
  written around arrival (`onArrive`), what lets a place be a refuge (see Dispatch → Refuges), and
  what lets survivors who end up in the same building be formed into a unit — by a story script,
  never at random.
- **Residences** — a baked pool of house-shaped buildings per district, no addresses ever shown.
  Every named caller who is "at home" lives in one of these, assigned through the directory (see
  Information): each directory entry is a name *and* a house, an entry is used at most once per
  run, so two unrelated callers never phone from the same address. If that ever happens, it's
  scripted. Real people live in these houses, so the game never shows a street address.
- **Every other named building** comes free from the tiles: hover for the name, click for a card.

### Situations and marks

Two layers, and the distance between them is the game.

A **situation** is ground truth: a fire, a blocked road, a crowd on foot, a horde. The sim spawns
them (see The Infection), each has a real position and a **hidden lifecycle** — a fire burns for a
while and then the house is gone; a block might get cleared by someone else; a horde moves. The
player never sees a situation directly.

A **mark** is a belief: a dated, kinded, provisional pin — *what* was reported, *where*, *when*,
*by whom*. Kinds: **fire**, **blocked road**, **horde sighting**, **crowd**, **caller** (a disclosed
location), **last known** (where a caller was before they moved). Every kind except *caller* is
dispatchable.

Rules:
- A mark is created **only by a report**: a caller says it, a scanner officer radios it, or one
  of your own units runs into it. The sim never places anything on the map directly.
- A mark **never moves and never expires on its own.** A fire reported at 23:10 sits there,
  labeled 23:10, until a unit checks it and reports what's actually there now. If you waited three
  hours, the house is gone and nobody's around — and the mark stayed the whole time as a reminder
  of what you decided to skip. A mark doesn't know when its situation ended; that's the point.
- **Every situation mark is dispatchable**, and sending a unit is how it gets resolved (fire out,
  road cleared), confirmed (still here, refreshed timestamp), or cleared (nothing here).
- **Routing avoids marks, not the truth.** Your cars route around what you've been told about.
  A stale horde pin makes them detour around nothing. A missing report sends them straight through
  something real — and the unit tells you about it the hard way (see Dispatch → Interrupts). The
  gap between what you know and what's true is where units get hurt, and the player feels that gap
  without ever seeing a number.

### Hordes

A horde is a situation, not a sim object — **a wandering fire.** It has a position on the road
graph, a heading, and a size *word* (a few, a crowd, a wall of them), never a count. It drifts along
its district's roads. A bad district has a few of them; a clean one has none. They're pieces to
foul up your dispatching, not particles.

- **The district count spawns them; they carry the spread in fiction.** Tier decides how many
  exist in a district. When the sim's inter-district spread fires, a horde crosses the line — so
  the spread is something the player might see coming, if someone reports it.
- **You only see one when someone reports it.** A caller or a badge officer near it, or your own
  unit meeting it. The mark lands at that position at that moment and stays there. By the time
  you check, it may have moved.
- **They can't be fought.** Verify means police get close enough to see it and withdraw. Nobody on
  the board kills zombies.
- **A horde reaching a place is what makes a refuge fall** — the fall is visible in the fiction,
  not a threshold firing in the dark.
- **They nudge.** "Bigger now, and moving toward the mall" is the game telling you to start an
  evacuation without a single number.

---

## The Infection

This is the whole of "the sim" now. It is deliberately small.

**What it computes.** Per district: `humans`, `zombies`, SIR-style local spread (peaks at a 50/50
ratio), probabilistic inter-district spread over the adjacency graph, and a **tier** (0–4) read off
the zombie count. That's it. No unit combat, no suppression, no loot, no per-person HP in the tick.

**What it never does.** It never decrements a zombie count because of a unit. It never targets a
named person in the tick loop. It never places anything on the map directly. Units influence
*people*, never zombie counts.

**What it emits — the symptoms.** The infection is invisible; what the player sees are its
symptoms, and the Director turns district state into them. The *rate and kind* of each symptom is
sim-driven by the district's tier; only the exact street is random. This is what makes the night
escalate legibly: a district going bad shows as a swell of reports from it, then fewer, then none —
and that quieting is the signal.

| Symptom | What the player sees | Driven by |
|---|---|---|
| **Calls** | Named citizens phoning from addresses in the district, tiered in tone by how bad it is there | tier → call rate and template pool |
| **Reports** | Scanner officers (badge numbers) radioing fires, blocked roads, sightings, crowds — each becomes a mark | tier → report rate and kind mix |
| **Situations** | Fires, blocks, crowds, hordes spawned as ground truth with hidden lifecycles | tier → spawn rate and kind |
| **Interrupts** | A unit en route hits a situation and asks what to do | true situations along the route |
| **Caller survival windows** | How long an unhelped caller lasts before going silent | tier + their location class |
| **Places falling** | A refuge gets overrun; everyone you sent there is lost | a horde reaching the place |
| **COMMS decay** | Scanner lines from the district fray into static, then stop | ratio (built) |
| **Heat** | Red on the district's streets (see Information → The heat rule) | ratio, gated by recency of contact |
| **The dawn card** | Who lived, who didn't, and where they are | everything above, read at the end |

**Consistency guards.** Symptoms must never contradict the state that produced them: no string of
callers from a district with no humans left, no "wall of them" report from a district at tier 0, no
horde piece in a clean district. The guards are part of the spawner, not an afterthought.

**Ambiguity is a feature.** Some symptoms should fire in clean districts too — a wreck that's just
a wreck, a fire that's just a fire, a welfare check that's probably nothing. The player can't sort
the board by importance before reading it.

---

## Information

### The windows

Each source is a window on the desk. The set grows as the night's fiction adds channels and shrinks
as others degrade; **the tools are all on the desk from minute one** — it's a desk — and the sense
of growing mastery comes from having worked the board for hours, not from a menu unlocking.

- **CONTACTS** — the call list. Citizens, spine characters, inquiries, your units' threads,
  services. The only surface with back-and-forth.
- **DISPATCH** — the map and the roster. Your cars, the marks, the places, the heat. The only
  surface where cars are sent.
- **COMMS** — the scanner. Off-duty and quick-response officers, identified by badge number,
  radioing district status and **reports** — the source of every mark not tied to a caller.
  Passive, half-listened-to, never replied to. Badge officers are stable per district and can
  become characters by repetition — the badge that's reported from Northside all night and then
  stops is a story nobody had to write.
- **DIRECTORY** — a searchable phone book. Fictional names, fictional numbers, each mapped onto a
  house in the residence pool. It's also **the pool callers are drawn from**, so anyone who phones
  can be looked up, and anyone looked up could phone. A child who doesn't know his address but
  knows his dad's name is a lookup. A caller who hung up is a lookup. Cross-referencing a name to a
  house on the map is the single most dispatcher-shaped action in the game.
- **BINDER** — standard operating procedures, plus the **memos** OEM sends down over the night
  amending them. "Structure fire: one fire unit; if occupied, add police." "No response into a
  district above level 3." Following the binder is easy at 21:00 and impossible at 03:00. See
  People → The people above you.
- **LOG** — the CAD log: every call, every dispatch, every arrival and outcome, every memo,
  timestamped. It *supplements* COMMS (which is incoming scanner traffic), it doesn't replace it —
  it's the record of what *you* did and what came of it. The thing you scroll back through to
  remember who said what, and the surface a save-and-resume would restore. The impersonal status
  lines pulled out of COMMS ("unit en route," "unit arrived") belong here.
- **Later channels** arrive in fiction: OEM opens a line at midnight, a caller gives you a private
  number, a camera feed comes up. Other channels **degrade**: COMMS frays, cameras go down in a
  district that loses power, calls from a bad district get shorter and then stop.

### The cross-reference loop

A call is not "dispatch yes or no." A call is a small assembly problem followed by a contested
decision:

1. **Where are they?** A landmark, a cross street, a business, a parent's name, or nothing. Turn it
   into a place on the map (DIRECTORY, the map's own search, the caller's own words).
2. **What do they need?** Fire, police, EMS. Sometimes it's obvious; sometimes the caller is wrong.
3. **Who can get there, and when?** Real travel time, real positions, the marks on the roads.
4. **What does the book say?** The BINDER, and whatever OEM has memo'd since.
5. **Decide.** Which car, or none — and *whose* call goes unanswered because of it. And if someone
   is coming out of there, *where they go* (see Dispatch → Refuges).

Step 5 is only interesting because steps 1–4 took work and because the answer costs someone else.

**The loop runs both ways.** Some callers want information *from you* — see Content System →
Inquiries. Answering them means looking it up in the binder, the log, or the map while the phone
is ringing.

### The heat rule

The district heat paint (red blooming along a district's own streets, boundary reddening with it) is
kept as the "how is this part of town doing" glance. It is **painted from the true ratio, but only
for districts you've heard from recently** — a call, a report, or a unit check-in within the last
stretch of the night. A district that's gone quiet goes **grey**, with "no word from Northside
since 02:40" on its card. Silence becomes visible, which is the scariest thing the map can show, and
it costs nothing because every report is sim-driven anyway. The fallen look (a near-black shroud
once a district's crowd is effectively gone) is kept and, like silence, isn't gated.

---

## People

### Callers

Every caller in CONTACTS is a real Person: a name, a location, and either a script or a template.
**Callers have names and live at addresses.** The old "Timmy is somewhere in a park for no reason"
is gone: Timmy lives in a specific house in Northside, drawn from the directory, it lights up when
he tells you, and you can send an officer to fetch him.

Two kinds of caller, distinguished by **content, not by a flag**:
- **Scripted** — the spine. Their fate is only ever authored, through their script. No roll ever
  touches them; the script branches on the state of the world instead (see Movement & Risk → Stay
  or go).
- **Generated** — citizens. Templated, named, housed. If nobody reaches them inside their survival
  window they go silent and the thread closes with a last line. Their outcome when a unit arrives
  is the arrival roll, narrated.

*(The old `sim` flag is retired. It answered "can combat kill this person" — no longer a question —
and "does arrival roll or run a script," which is a property of the content, not the person.)*

### Units

A unit is a **crew with a callsign**. Three issued roles: **Police**, **Fire**, **EMS** — the real
911 triad, each with jobs only it can do (see Dispatch → Roles). No inventories, no loot, no items.
A unit's capability is its role and its headcount.

**The callsign is what you dispatch; the names are who comes back.** UNIT 3 is the handle you send.
Sullivan and Chen are in it, visible in the roster, and the report that says "lost Chen getting
out" is what stings. Issued units are callsigns so that losing a *car* is a resource loss; losing
a *person in it* is told by name so it's still a loss. A unit whose last member is gone is
**disbanded** — the one alert the game still raises. Because attrition happens only on dispatch
(see the arrival roll), not per tick, cascades are the player's doing; the starting unit count is a
tuning knob against the night feeling over before it starts.

**Earned units invert the rule.** A survivor group that becomes a unit (see Content System → Two
kinds of saved) keeps its leader's name as its callsign: WEBB, not UNIT 7. The player built that
unit out of a story; losing it is personal, and it should be. Earned units are the **Civilian**
role: they can do most things at higher risk and with no authority.

Unit states are few: **available** (parked at a station or staged wherever you left them), **en
route**, **on scene** (tied up with a call or a mark until it resolves), **holding** (inside a
place, keeping it a refuge). No patrol. No hide. No scavenge.

### Services you phone

Not everything you interact with is a unit. Some things are a **phone call**: a tow truck for a
wreck, a utility crew for a downed line, later the National Guard. You request them, give them an
address, they take time, and they don't cost a car. They don't appear on the map as yours. This is
the switchboard verb, and it's the answer to "should there be a city crews role" — no; that's a
service you call.

### The people above you

Deputy Director Holt and the Office of Emergency Management sit above the player with more
authority and worse information. They are the game's **moral engine**, *Papers, Please* style: the
BINDER says one thing, the person on the phone needs another, and over the night OEM's memos amend
the book — hold all units at stations pending state guidance; no response into Northside;
prioritize government facilities. Some memos are sensible, some are late, some are wrong. "Dispatch
yes or no" becomes "dispatch against orders, for this person, knowing Holt will call." Holt's calls
are the warning system for the job-failure ending (see Endings), and they're legible because they're
a character talking to you, not a meter.

Holt is one voice of several. **The governor calls. The governor calls because the president called
them.** A Louisville dispatcher wants to know what's coming their way. The press has the number.
Each of these is an **inquiry** — someone who wants an answer from you, which you have to go and
find — and each costs time while the board burns. Several people should be hassling you over how
you're working, all night. The **National Guard** lives at the end of one of these conversations:
convince the right person, and late in the night new units arrive, or you're finally allowed to
call for them.

---

## Dispatch

**The map is the only dispatch surface; the panels are display** (ruled 2026-09-04, kept).
Left-click a target with a unit selected, right-click for the explicit verb. One click rule for a
unit wherever it appears; one Escape rule closes the topmost thing. Cars route on real roads and
arrival is real travel time.

### Verbs

- **Respond** — send a unit to a caller. The unit drives to their place, goes inside, and the
  caller's script (or the arrival roll) takes over. If someone is coming out, you say where to.
- **Check** — send a unit to any situation mark. Fire: put it out. Blocked road: clear it. Horde:
  verify it — still there, or gone. Crowd: help them. This is how marks get resolved, confirmed, or
  cleared, and it's also how the player buys information.
- **Hold** — leave a unit inside a place to keep it a refuge. People sent there are safer while
  it's held.
- **Stage** — park a unit somewhere on purpose so it's closer to what's coming. Because travel
  time is real, where you leave a car after a call decides who it can reach next. This replaces
  patrol with a decision that actually recurs.

### Roles

Three issued roles, three sets of jobs. **Fire** puts out fires and gets people out of buildings.
**Police** clears roads, verifies sightings, escorts, and fetches people. **EMS** takes the injured
and runs them to a hospital that's still standing. **Civilian** (earned) can attempt most of it at
worse odds. Sending the wrong role isn't forbidden; it's a worse roll and a worse story.

### The arrival roll — the only combat in the game

When a unit arrives at a **generated** caller or any **mark**, **one roll** decides the outcome:
**success**, **partial** (job done, someone hurt or lost), or **loss** (the unit is gone, or comes
back short). The roll is weighted by role fit and the district's tier at that moment. The outcome
is **narrated on the unit's thread**, never simulated in the tick loop. This one roll is the entire
unit-risk model: "I sent UNIT 3 into Northside at level 4 and lost them" is a story the player
tells about their own decision. Attrition on tick 340 to an ambient counterattack was not.

**Scripted callers don't roll.** When a unit reaches a spine character, the script's `onArrive`
owns what happens — including whether the unit gets hurt — and it can branch on who showed up.

### Interrupts — stopping on the way

A unit in transit passing near a real situation — a fire, a wreck, a crowd, a horde it didn't know
about because nobody reported it — may get an **interrupt**: the unit radios in with what it sees
and asks. *"Woman with a kid flagging us down on Broadway, says her husband's still inside. Do we
stop?"* The player answers on the unit's thread. Stop → the unit is on scene here now, the original
target waits, and the arrival roll runs for *this* situation. Continue → the unit drives on and
reports what it passed. Either way the moment closes with a line from the unit, and either way a
mark is created, because now you know.

Driving **through an unreported horde** is the sharpest interrupt: the roll can hurt or kill some
or all of the unit before the player even gets a choice. This is the price of the gap between the
marks and the truth, and the reason to send police to verify sightings.

Route choice matters because of interrupts: the short road through a bad district has more of
them. "Go around" is a real decision the player makes on the map.

### Refuges — where the saved go

There is no "out." Lexington isn't necessarily ground zero, and in this world evacuation is
temporary anyway. So rescued people don't leave the board; **they go somewhere you choose** — a
hospital, the government center, a station, the mall — and every one of those is a place that can
fall. "Saved" is never final. It's *safe for now, at Good Samaritan.*

- A **held** refuge (a unit inside) is safer; an unheld one is a building with people in it.
- A **horde reaching a refuge** overruns it. Everyone you sent there is lost at once, and the place
  updates on the map the moment someone tells you — a last call from inside, or the unit that
  arrives to find it.
- The emergent story this produces is the one we want: you centralized everyone at the Government
  Center, the streets around it got worse, a sighting lands two blocks away, and now you're
  scrambling to coordinate an evacuation of your own refuge.
- The dawn card reads **where everyone ended up**, by name and by place — including the refuge
  that fell with everyone inside.

Refuges are the one way units and choices touch the fate of the people you reached. They never
touch the crowd numbers, which stay pure weather.

---

## Movement & Risk

**Unit travel.** A dispatch is a real drive over Lexington's real roads: route computed, car moving
at road speed, travel time derived from the route. While in transit a unit belongs to no district
and is on scene nowhere. **Routes avoid marks, not the truth** (see The World → Situations and
marks). Danger on the true state along the route is felt as interrupts, not as a hidden cost.

**Stay or go — caller travel.** Telling a caller to move (run, go to a neighbor, go to the
hospital, go look for dad) has to carry consequences either way, and the two options are two
*different shapes* of risk, both readable on the map before you answer:

- **Stay is a slow burn.** A hunkered caller has a survival window driven by their district's tier,
  and it shrinks as the district gets worse. Staying buys time for a car to get there. It never
  buys safety.
- **Go is one sharp roll.** Moving is a trip on foot, resolved by the same one-roll shape as a
  unit's arrival, weighted by the truth along the way — the tier, and any horde actually near the
  route. Arrive; arrive with news; or go silent. Their pin drops to a **last known** mark at the
  place they left, and stays there until they check in from somewhere else or don't. If you'd
  already sent a car to that house, it arrives to nobody — the cost of advising movement.
- **Going buys information.** A caller who makes it somewhere tells you what they saw, and that
  becomes a mark. Stay is quiet and safe-ish; go is loud and dangerous. That's why both options
  stay live all night instead of "stay" being the always-right answer.
- **Scripted callers branch instead of rolling.** Danny's "go look for dad" routes on the real
  conditions the script vocabulary already has (a horde near, a ratio over, a unit at). The writer
  owns the beats, the world picks which one fires, and the player's advice decided which branch
  was even possible.

Caller travel is never animated. A unit is yours; you know where your cars are. A person on foot in
the dark is not. Watching a last-known mark sit on a darkening street is the point.

---

## Content System

Story content comes in five kinds. The real writing lives in the citizens who phone in — that's a
lot of the game, but not all of it, and the rest is mostly generated, which takes pressure off the
script.

### Spine — the scenario

A scenario is **anchored on a place**, and a small cast of fully authored characters orbit it all
night. It's the one big story running through a sea of randomly drawn callers and reports, and the
test of a scenario is whether it feels baked into the *entire* run — if it doesn't, it fails as a
scenario and the feature gets rethought.

The first scenario is **the mall** — *Dawn of the Dead*. Whatever else happens, people are heading
to the mall, calling from it, and needing things from you: more people sent there, a road cleared to
it, a decision about whether it can hold. It's the run's biggest refuge, and it can fall.

Spine characters are scripted: anchored to triggers (a district reaching a tier, a time, a place),
never randomized in timing once a scenario is chosen, with real branching pivots that route on the
state of the world. Currently: E. Novak, Marcus Webb, Danny, Dep. Dir. Holt — to be re-homed under
the scenario model.

### Citizens — the volume

Generated, named, housed (from the directory). Templated openings tiered by their district's state,
a real survival window, a real outcome when a unit arrives (the arrival roll), a destination
question when they're rescued, and a **closing line** either way. Some are routine (a fire, a
welfare check, a wreck with injuries) and some turn out not to be. This is most of the calls in a
night and has to be good enough to carry a run on its own.

### Reports — the low-writing content

Scanner officers radioing situations: *"Badge 324: structure fire, Loudon and 6th, send help."*
*"Badge 563: road's completely blocked at Broadway and Main, don't send anyone through."* One line
each, drawn from a pool by kind and tier, and each one becomes a mark. Dispatching a unit to see
whether it's real is fun and needs almost no specific writing.

### Interrupts — generated moments

The en-route beats above. A pool of situations by kind and tier, each with a line for the unit's
question and lines for each outcome. Generated, but they're the game's most memorable decisions,
so the pool has to be written with care.

### Inquiries — callers who want something from you

The governor's office. A Louisville dispatcher. A reporter. A woman asking whether anyone's been to
her mother's address. They don't need a car; they need an **answer**, and the answer is somewhere
in the binder, the log, or the map. Some are worth the time. Some are the job-failure ending
calling ahead. All of them make the player flip windows while the board burns.

### Rules that apply to all of it

**On answering.** Picking up a call is a deliberate act. An unopened caller sits in the list with
nothing knowable about them — no preview, no severity, no unread flag — until the player opens the
thread. Then the dispatcher's own line ("911, what is your emergency?") fires, a beat of silence,
and the caller speaks. Nobody can triage the call list at a glance because there's nothing to
triage on a call that hasn't been answered. (Barbara, the tutorial colleague, is the one exception.)

**On silence and timers.** A scripted node's timer is optional, not default. No visible countdown,
ever. When a node does carry a timer, the timeout beat must be specific and authored — never a
generic "you didn't answer" death. Citizens have survival windows instead of node timers; when the
window closes, they go silent and the thread closes with a last line.

**On arrival.** The arrival is handed to the caller's script with *who showed up* — the unit, its
role, its headcount. Authored content can branch on any of it. Radio chrome (en route, on scene) is
generated for every dispatch; the story of what they find is authored per spine character and
rolled for citizens. The first unit to arrive owns the resolution; later units are backup.

**Two kinds of saved.** A saved **individual** goes to a refuge you name — safe for now, a name
on the dawn card next to a place. A saved **group** may instead *join*: the group becomes an earned
unit with its leader's name, or joins an existing one — by script, never at random. Either way a
saved caller can never quietly die five minutes later *on their own*; only the fall of the place
they're in can take them, and that's a story you'll be told.

**Every resolution leaves closure.** On a save, both the caller and the unit sign off. On a loss,
the caller and/or the unit report it. On a mark, the unit says what it found. Nothing vanishes from
the list without a line, because the sign-off is the only feedback the player gets, and the LOG of
those lines is the story of the night.

**Where grief lives.** The gut-punch is reserved for the spine and the earned units — the people
the player chose their way toward. Citizens are people you'd pass on the street: real, worth
answering, and their fate can be a roll, because a roll produces ambient grief (the ones you
couldn't get to), which is the right weight for them. If you want a death to wreck someone, you
write it; you don't roll it.

---

## Difficulty vs. Scenario

Two independent axes, chosen separately at game start:

- **Difficulty** — how bad the weather is. Seed size and placement, spread rate, how fast survival
  windows close, how many hordes a tier spawns. Answers "how hard is the night."
- **Scenario** — which spine is loaded (the mall, first). Answers "whose story am I living
  through." Picking a scenario *biases* the seeding toward its anchor; it never guarantees or
  time-locks the beat.

They compose freely. A "Random" scenario draws only from citizens and reports, for replay.

---

## The Map *(ruled 2026-09-04, kept; amended 2026-09-10 where noted)*

**Stack.** MapLibre GL JS rendering a self-hosted PMTiles extract of Lexington; a baked road graph
with our own A\*; authored GeoJSON for districts and places; units, places, marks and pins as
layers on the map; the terminal aesthetic in the DOM around it. Build steps, vendored deps, a
Python bake and paid hosting are all acceptable; the only constraint is playable and fun in the
browser. OSM is ODbL: "© OpenStreetMap contributors" stays visible. Non-negotiable.

**District is state, position is geography.** Every unit has a real road position; its district is
derived. Dispatch to a district lands at the nearest routable node inside it. Units spawn at real
stations. A unit sent to a place goes *inside* (the car disappears, the place wears a count badge).

**Districts are drawn to fit the city.** Landmarks first; polygons traced over real neighborhoods
from named road corridors. Ground inside no district is dim and not dispatchable. Dead air.

**What the map is allowed to show** *(amended)*:
- **Marks, on report only.** See The World. Nothing the sim knows reaches the map without someone
  saying it. Hordes and situations are never drawn directly.
- **Heat, on recency.** See Information → The heat rule. Grey means silence.
- **Your own units, fully.** Positions, routes, ETAs. Dispatchers know where their cars are.
- **Caller pins on disclosure**, and a last-known mark once they move.
- **Refuges** — the places you've sent people to, with who's there, and their status (held,
  unheld, fallen) the moment it's reported.

**Layout.** One DISPATCH window: the map with a thin, never-hiding roster, floating district and
place cards. CONTACTS and COMMS as sidebars; DIRECTORY, BINDER and LOG join them as windows the
player opens and arranges. The desktop, badge wallpaper and taskbar stay behind everything. Target
is a desktop PC at 1080p.

---

## Endings

There is no sim to beat, so there is no win and no lose. There are **endings**, and every ending is
a card that names its cause. Nothing is graded. The card tells the night in names and places.

- **Dawn.** The shift ends at 06:00. The card reads the board: the people you got to safety, by
  name and by where they are; the people you lost, by name; the calls you never answered, counted;
  each spine character's fate; each unit's fate; the refuges that held and the one that didn't.
  This is the good ending, and "good" means *while everything is still terrible, you did some real
  good.* Gold star: you made the best of the literal apocalypse. The old line "the win screen is a
  rumor" becomes literal — there isn't one, there's morning.
- **Relieved of duty.** OEM pulls you off the desk mid-night and someone else finishes the shift.
  Two roads there, pulling in opposite directions: **negligence** (too many calls left unanswered)
  or **insubordination** (too many orders broken). Holt's calls are the warnings; the binder and
  the memos are the rules you're being measured against. This is the job-failure ending, and it's
  two-sided so that neither "follow the book" nor "ignore the book" is safe.
- **No hands.** Every unit lost. **Open:** end the night there with a card, or let it run — the
  calls keep coming and you can only talk, until dawn. Lean: let it run; it's the ending players
  would tell people about. Decide after the first playtest that reaches it.

The "many ways to lose" texture the old design liked lives on as **epilogue variance**: the same
night can end with Novak alive and UNIT 3 gone, or the reverse, and the card says so. Every ending
must be foreseeable in hindsight — districts going grey, COMMS going quiet, Holt's voice sharpening,
unit threads thinning — so the player can always name what happened.

---

## Onboarding

The tutorial is in-fiction: the last stretch of the day shift, handed off by **Barbara West**
before the real situation starts. The clock doesn't start until the handoff ends or the player
declines a refresher; declining is itself the first RESPOND choice they make. The handoff is taught
by doing real, mundane dispatcher work — a routine fire report, a welfare check, a lookup in the
DIRECTORY, a dispatch that actually drives — not by explaining the UI. Barbara then goes home to a
residential district through the same transit system, lands as a normal citizen, and is reachable
(and losable) like anyone else from then on.

---

## Touchstones

- **This War of Mine** — survival as story engine; you usually lose someone, rarely everyone; the
  ending is relief, not triumph; personalized epilogues.
- **Papers, Please** — the mediated functionary; everything is on the desk and cross-referencing
  under a clock is the difficulty; the rulebook versus the person in front of you; many endings,
  each a card.
- **911 Operator** — the map reference, and the proof that a dispatch game needs no strategy layer:
  its whole tension is positioning and triage.
- **11:59** (GMTK jam) — the fake PC as the entire interface. Taken: the workspace. Left: the
  scramble.
- **Dawn of the Dead** — the first scenario.

Dead Air is the cross: a survival story experienced entirely from a dispatcher's desk.

---

## Explicitly Out of Scope

- **A finer infection sim.** No per-building zombie counts, no heat grid. Hordes are *pieces with a
  size word*, never a count; the sim only knows districts.
- **Zombie combat in the sim.** No attack rolls, no per-tick counterattack, no unit suppression of
  spread. The only combat is the arrival roll, narrated, or a scripted beat.
- **Patrol, hide, scavenge.** Units respond, check, hold and stage. Nothing else.
- **Inventories, loot, items.** A unit's capability is its role. A fire truck has a hose because
  it's a fire truck. Intel is gated by contact, not by carrying a radio.
- **Evacuation out of the city.** There is no "out." The saved go to a refuge you name.
- **Animated movement of anything but units.** Callers who move become a last-known mark; hordes
  are only ever seen as a sighting.
- **Real addresses.** The residence pool is real buildings; the directory is fictional names on
  them; no street address is ever shown.
- **An RTS scramble.** Pressure from volume, never from reflex. Pause stays.
- **A global morale or master score.** Rejected as a lose model because it collapses legible causes
  into one number. Endings read the board instead.
- **An open-ended mode as the primary experience.** The night has a beginning and an end.

---

## Superseded rulings *(2026-09-10)* — what was dropped, and why

Recorded so the reasoning isn't lost and the question isn't reopened by accident.

- **"The player never gets clean numbers."** Only made sense when beating the sim was the game.
  Replaced by *complete information, scattered*. The premise survives — it was never about
  numbers; it's about having no hands.
- **Dispatch is two verbs (district = sim move, caller = story move).** The district verb was the
  problem: sending a car to "hang out and suppress" was never fun, its effect was invisible, and
  the dominant strategy was one car per district then wait. Replaced by *respond / check / hold /
  stage*, all of which are story moves with spatial consequences.
- **Sim↔caller reinforcement (rescue suppression, the ENGAGE invariant, breadth-vs-depth).** All of
  it was scaffolding to make a bolted-on sim matter. With the sim demoted to weather, there's
  nothing to reinforce. Deleted.
- **Combat: hit chances, HP, counterattack, wound states, medics, rations.** RTS residue from the
  SVG era. Replaced by the single arrival roll.
- **The `sim` flag on Persons.** Existed to say whether combat could kill someone. Combat can't
  kill anyone now. The scripted/generated distinction it also carried is a property of content.
- **Items and intel gating (radio, binoculars).** Intel is gated by recency of contact now, which
  is more on-theme and needs no inventory.
- **Lose: six of nine districts critical.** The player can't affect it, so it can't be their
  failure. The city's fate is the setting, read by the dawn card, not a verdict.
- **Lose: too many units disbanded.** Folded into *No hands*.
- **"Saved = extracted off the board."** There's no off-the-board. The saved go to a refuge and a
  refuge can fall. (An intermediate "evacuation" lever was proposed and dropped the same day: it
  only made sense if Lexington were ground zero.)
- **Danger paint gated by a radio in the district.** Replaced by the heat rule (recency).
- **Routes read the true danger.** Gave the player perfect routing information for free. Routes read
  marks now; the truth is felt as interrupts.
- **Marks fade over time.** A mark that fades pretends to know when its situation ended. It doesn't.
  Marks persist until checked; the *situation* has the hidden lifecycle.
- **Civilian as an issued unit role.** Its only job was the first aid kit. Replaced by EMS; civilian
  is the earned role.
- **"A morale scalar is wrong because the subject is informational crippling."** Still wrong, for a
  simpler reason: it's a score.
- **The old "ambient caller" pool.** Reborn twice — as badge chatter (done), and now as *reports*
  that create marks. The tier system it carried survives in citizens and reports.
