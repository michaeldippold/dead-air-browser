# Changelog

All notable changes to Dispatch will be documented here.

---

## [0.1.0] — 2026-06-13

### Overview

First playable version. Dispatch is a browser-based zombie outbreak coordinator — the player sits at a command center, dispatches government units across a city map, and must contain an outbreak using incomplete information. The core design tension is that the player never sees exact zombie counts unless they actively build that awareness through radio units or god mode. The game is technically winnable but not easily so, and the real experience is the city and the people in it rather than the score.

---

### Map

- 14 named districts across 5 categories: Residential, Government, Medical, Retail, Industrial
- Fixed inline SVG map, no scrolling or panning — a paper map pinned to the desk
- Pastel category fills (color = identity, never threat level)
- Click to select a district; hover brightens fill only
- Selected district shows a red inner-stroke border (clip-path technique to prevent bleed into neighbors)
- District labels and category text rendered on the SVG in dark ink

---

### Simulation

- Tick-based loop (3.5 seconds per tick)
- Local spread: each tick, zombies in a district convert a portion of the human population (rate suppressed by units present — each unit reduces local spread rate by 12%, capped at 80%)
- Inter-district spread: 10% chance per tick that zombies spill from an infected district into a random neighbor (units in the source district can block this — 15% per unit, capped at 70%)
- Outbreak seeds at game start based on selected scenario

---

### Units

Three unit types, each with a starting location and loadout:

| Type | Starting Location | Items |
|---|---|---|
| Police | Police HQ | Gun × 3 |
| Fire | Fire Station | Fire Axe × 3 |
| Civilian | City Hall | First Aid Kit + Radio × 2, First Aid Kit × 1 |

- Each unit has 100 HP; units can die permanently
- Units are displayed as colored cards in the left panel, grouped by district
- HP shown as a 10-segment bar (green → amber → red as health drops)
- Clicking a unit card opens its detail view: type, location, HP bar, item chips, dispatch controls

---

### Combat

When units are present in a district with zombies, combat resolves each tick:

- **Attack phase** — each unit rolls to kill one zombie. Hit chance: Gun 70%, Fire Axe 65%, unarmed 50%
- **Counterattack phase** — zombies strike back. Number of strikes = unit count at start of tick. Each strike targets a unit weighted by threat modifier (Police 3×, Fire 2×, Civilian 1×), so front-line units absorb the majority of hits. Damage: 10 HP per hit
- **Medic phase** — after counterattacks, Civilian units carrying a First Aid Kit heal the most critically wounded unit in the district (≤50 HP threshold). Restores 20 HP. Kit is consumed on use

---

### Information Design

Player information is deliberately restricted:

- **Default state** — clicking a district shows its name and category only. No counts
- **God mode** — toggleable overlay (persists in localStorage). Reveals a full situation report: all 14 districts alphabetized with live human count, zombie count, and effective spread rate. Spread rate shown in teal when suppressed by units
- **Radio intel** — when a Civilian carrying a Radio is present in a district, that district's live counts are visible in the info panel (marked RADIO INTEL). If the Civilian dies or redeploys, intel goes dark
- **Contacts panel** — callers drip-feed zone information via a texting-style interface. 10% chance per tick that an infected district triggers a call. Messages are timestamped with game time. Contacts accumulate over the game; unread messages show a teal dot. Caller pool includes named individuals and unknown callers

---

### Items

Each item is displayed as a colored chip in the unit detail view. Clicking a chip opens a description panel with mechanical details.

| Item | Color | Effect |
|---|---|---|
| Gun | Brass | Attack hit chance 70% |
| Fire Axe | Orange | Attack hit chance 65% |
| First Aid Kit | Red | Civilian heals most critical unit at ≤50 HP; consumed on use |
| Radio | Grey | Reveals live counts for the unit's current district |

---

### UI Structure

- **Three-column layout** — units/contacts panel (left), city map (center), district info/legend/situation report (right)
- **Left panel states** — base view (units + contacts list) → unit detail → item description; or base view → contact chat thread. All transitions use the same slide-over pattern
- **Topbar** — tick counter and elapsed game time (white, always visible), god mode toggle

---

### Start Screen

- Title screen overlays the game until the player starts
- Scenario dropdown with two options:
  - **Default** — 15 zombies seed in Millbrook at game start
  - **Custom** — exposes all 14 districts with +/− controls to set any starting count per zone
- Tick loop does not start until Start Mission is clicked

---

### Win / Lose

- **Win** — all zombies eliminated. "OUTBREAK CONTAINED" overlay shows tick count and elapsed time
- **Lose** — all units dead. "ALL UNITS LOST" overlay shows tick count and elapsed time
- Both end states offer a Restart button that reloads to the start screen
