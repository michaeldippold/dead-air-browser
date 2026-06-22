// Tutorial — day-shift handoff colleague (INFRASTRUCTURE STUB)
//
// This is a placeholder, not the real tutorial content. It exists to prove the
// onEnter + spotlightWindow + game-start-interception infrastructure works end to end:
// START MISSION spawns this script instead of calling startGame() directly, its onEnter
// can dim/spotlight panels, and its final node hands off into the real game.
//
// No `trigger`/`once` fields — unlike the other four scripts, this one is never
// Director-polled. It's spawned directly by the START MISSION click handler in main.js.
//
// TODO (todo.md NEXT SESSION item 4): replace with real content — a named, characterized
// colleague, a panel-by-panel walkthrough, 1-2 real scripted dispatches using the actual
// dispatch UI, and an end-of-tutorial handoff transit that lands her as a normal Person.

export default {
  id:          'tutorial',
  name:        'Dispatch Trainer',
  callerRole:  'civilian',
  callerItems: [],
  district:    null,

  nodes: {
    0: {
      text: "Hey, before you take the board — quick walkthrough. This is your DISPATCH panel. Ready?",
      onEnter: (state, actions) => actions.spotlightWindow('dispatch'),
      choices: [
        { label: 'Ready.', next: 'handoff' },
      ],
    },
    'handoff': {
      text: "That's the board. It's yours now. Good luck out there.",
      onEnter: (state, actions) => { actions.clearSpotlight(); actions.startGame() },
      choices: null,
    },
  },
}
