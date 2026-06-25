# Writing Scripts for Dead Air

> A practical guide for writing **callers** — the people who phone the dispatcher. You don't need
> to understand the simulation, the combat math, or the rest of the game to write one. You need to
> understand a *conversation tree*, and the handful of fields below. If you can write a branching
> screenplay, you can write a caller.

For real, working examples, read the existing files in `scripts/` — `holt.js` is the clearest
(a full branching call), `tutorial.js` is the simplest.

---

## What a script is

One script = **one caller**: a named person on the other end of a phone, plus the conversation
they have with the dispatcher. Each caller lives in its own file in `scripts/` (e.g.
`scripts/danny.js`). The game shows the caller in the CONTACTS list; the player opens the thread
and talks to them by picking replies.

Your character is **protected from the simulation** — the zombies can't randomly kill them. Only
*your script* decides whether they live, die, or go quiet. That's deliberate: spine characters
(the authored ones) are never killed by a dice roll, only by the story you write.

---

## The shape of a script file

A script is a plain object with a few top-level fields and a `nodes` map. Here's a complete,
minimal one, annotated:

```js
export default {
  id:          'maria',          // unique id, should match the filename
  name:        'Maria Reyes',    // the caller's name, shown in CONTACTS
  callerRole:  'civilian',       // 'civilian' | 'police' | 'fire' — affects their map dot + risk
  callerItems: [],               // items they're carrying (usually none for a civilian)
  district:    'joyland',        // which district they're calling from (or null)
  trigger:     { type: 'game-time', hour: 23 },  // WHEN they call in (see Triggers). Omit = never auto-fires.
  once:        true,             // fire only once (default true)

  nodes: {
    // ... the conversation, see below ...
  },
}
```

That's the whole envelope. Everything interesting happens inside `nodes`.

---

## Nodes — the beats of the conversation

A **node** is one beat: a message the caller sends, plus how the conversation continues from
there. Nodes have ids (numbers *or* strings — both work; strings are easier to follow, like
`'maria-trapped'`). The conversation starts at node `0`.

```js
nodes: {
  0: {
    text: "There's someone outside my door. Please, is anyone coming?",
    choices: [
      { label: "Stay quiet. Help is on the way.", next: 'reassure' },
      { label: "Get out the back now.",           next: 'flee' },
    ],
  },
  'reassure': {
    text: "Okay. Okay, I'll stay quiet.",
    resolve: 'waiting',
  },
  // ...
}
```

### Node fields

| Field | What it does |
|---|---|
| `text` | The message the caller sends. Use `{{name}}` to drop in the player's name. Set to `null` for a node that only resolves (no message). |
| `choices` | The player's reply options: `[{ label, next }]`. `label` is what the player clicks (and what gets shown as their reply); `next` is the node id to go to. Omit or `null` for no choices. |
| `then` | Auto-continue: the caller keeps talking. The node sends its `text`, then advances on its own to the `then` node after a short "still typing" beat. Use this to send **several messages in a row** before offering a choice. (Don't combine with `choices`.) |
| `timer` + `timerNext` | A deadline. If the player doesn't act within `timer` ticks, the conversation jumps to `timerNext`. Use sparingly — most nodes should wait forever. There's no visible countdown; silence is the pressure. |
| `onEnter` | A function run when the node is entered, for side effects (revealing a window, etc.). See "Side effects." |
| `resolve` | Ends the caller's involvement. `'waiting'` = alive but quiet (no more prompts). `'lost'` = they died (removed from the game, thread closes). |

---

## The four ways to leave a node

Every node continues in exactly one of these ways. This is the core grammar:

1. **`choices`** — the caller waits for the player to pick a reply, which routes to `next`.
   *This is the default conversational beat.*
2. **`then`** — the caller continues talking on their own (no player input). For multi-message
   speeches. Short, fixed "typing" beat between lines.
3. **`timer` + `timerNext`** — a clock. Two flavors:
   - On a node **with** `choices`: a *deadline* — answer in time, or it jumps to `timerNext`.
   - On a node **without** choices: a *pause* — the caller goes quiet for `timer` ticks, then the
     next line lands. (Like `then`, but a longer, author-set silence instead of a quick beat.)
4. **`resolve`** — the conversation ends (`'waiting'` or `'lost'`).

A terminal "they died" node is just `{ text: null, resolve: 'lost' }`.

---

## Triggers — when your caller phones in

The `trigger` field decides *when* the call arrives. It's polled by the game's Director. Pick one:

| Trigger | Fires when… |
|---|---|
| `{ type: 'game-time', hour: 23, min: 0 }` | the clock reaches that time (`min` optional) |
| `{ type: 'zombie-presence', district: 'joyland' }` | that district has any zombies |
| `{ type: 'humans-gone', district: 'joyland' }` | that district's population hits zero |
| `{ type: 'unit-presence', district: 'joyland' }` | any unit is in that district |
| `{ type: 'random', chance: 0.02 }` | a random roll passes (per poll) |

Add `once: true` (the default) so they only call once. **Omit `trigger` entirely** and the script
won't auto-fire at all — it has to be spawned by game code (this is how the tutorial works, and
it's rare; for a normal caller, give them a trigger).

> **Not available yet:** combining conditions in one trigger (e.g. "after 1 AM *and* Joyland is
> falling"). If a beat needs that, flag it — it's a small addition.

---

## Side effects — what `onEnter` can do

`onEnter(state, actions)` runs when a node is entered. `actions` is a fixed toolbox for touching
the interface. You'll rarely need these in a normal caller — they're mostly for the tutorial — but
here's the full set:

```js
onEnter: (state, actions) => actions.revealWindow('map'),
```

| Action | Effect |
|---|---|
| `revealWindow(id)` | Show a window that was hidden/minimized |
| `minimizeWindow(id)` / `maximizeWindow(id)` / `closeWindow(id)` | Window controls |
| `bringToFront(id)` | Raise a window above the others |
| `setWindowPosition(id, x, y)` | Move a window |
| `setWindowOpacity(id, value)` | Dim a window (0 = black overlay, 1 = clear) |
| `spotlightWindow(id)` | Dim everything *except* this window (focus attention) |
| `clearSpotlight()` | Undo a spotlight |
| `showAlert(title, message)` | The big ALERT popup — reserve for rare, major events |
| `startGame()` | Hand off from the tutorial into the real game (starts the clock) |
| `completeResponse(unit)` | Release a unit from a call back to the pool (see Arrivals) |

**Window ids:** `contacts`, `dispatch`, `map`, `radio` (this is the **COMMS** window — note the
internal name is `radio`), `items`, `sitrep`, `alert`.

---

## Arrivals — when a unit reaches your caller

If the player *dispatches a unit to your caller*, you can author what happens on arrival with a
top-level `onArrive` function (not a node field — it sits next to `nodes`):

```js
onArrive: (state, actions, { contact, unit, roles, hasRole }) => {
  if (hasRole('fire')) {
    // a fire crew showed up — author a fire-specific beat
  }
  // ... when your beat is done, release the unit:
  actions.completeResponse(unit)
}
```

The arrival context gives you:
- `contact` — your caller's thread, `unit` — the unit that arrived.
- `roles` — array of the roles in that unit (e.g. `['police', 'police', 'civilian']`).
- `hasRole(role)` — quick check, e.g. `hasRole('fire')`.

If you don't write an `onArrive`, a generic outcome runs. Only the **first** unit to arrive
triggers your beat; later units are silent backup.

---

## Reading the game state

Both `onEnter` and `onArrive` receive `state`, the whole game world. You can read anything:

- `state.districts['joyland'].zombies` / `.humans` — the crowd in a district.
- `state.tick` — how far into the night (use the clock, not raw ticks, when you can).
- `state.units` — the units and where they are.

You can *read* all of this freely. **Routing the conversation on it** (e.g. "if Joyland's zombie
ratio is over half → grim node, else → hopeful node") is **not wired yet** — today only *time*
deadlines (`timer`/`timerNext`) can branch automatically. If you write a beat that needs to fork
on district state, flag it; it's a small, known addition (making `next` able to compute itself).

---

## How to actually write one

You do **not** have to write the `.js` directly. The intended workflow:

1. **Write a screenplay.** Numbered beats, caller lines in quotes, player choices as `A -> "…" -> nextBeat`.
   Whatever shorthand is comfortable — it just has to be unambiguous about who says what and where each
   choice goes.
2. **Mark the hooks in plain language** where you want something special — "she keeps talking here,"
   "this is a deadline," "if I called a fire truck, she reacts," "reveal the MAP window now."
3. **Hand it off to be translated** into the module. Any hook you reach for that doesn't exist yet
   gets flagged and either added (if small) or discussed (if it needs a design call).

The fields above are your vocabulary; the screenplay is how you compose them. You're never blocked
on syntax — write the story, name the hooks, and the translation handles the rest.

---

## Quick reference card

```
SCRIPT
  id, name, callerRole, callerItems, district
  trigger: { type, … }      → when they call (omit = code-spawned only)
  once                      → fire once (default true)
  nodes: { … }              → the conversation
  onArrive(state, actions, { contact, unit, roles, hasRole })  → when a unit reaches them

NODE
  text          → the caller's message ({{name}} = player's name; null = silent)
  choices       → [{ label, next }]   player picks a reply
  then          → nodeId              caller keeps talking (multi-message)
  timer/timerNext → number/nodeId     deadline (with choices) or pause (without)
  onEnter(state, actions)             side effects
  resolve       → 'waiting' (alive, quiet) | 'lost' (dead, thread closes)
```
