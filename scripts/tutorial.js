// Tutorial — day-shift handoff colleague: Barbara West
//
// Every player talks to Barbara at least once — she's the only contact that exists at game
// start (see main.js: initial state.contacts is now empty). Her first node reveals CONTACTS
// itself; nothing is shown before that, and no other window is revealed until either her "No"
// branch or her walkthrough explicitly reveals it. No `trigger`/`once` fields — unlike the
// other scripted characters, this one is never Director-polled. It's spawned directly by the
// START MISSION → login click-through in main.js.
//
// TODO (todo.md Tutorial Content): the walkthrough below is still minimal — one panel
// (DISPATCH), no practice callers yet, no end-of-tutorial handoff transit. Those are separate,
// still-open todo.md items.

export default {
  id:          'tutorial',
  name:        'Barbara West',
  callerRole:  'civilian',
  callerItems: [],
  district:    null,

  nodes: {
    0: {
      text: "Good evening, {{name}} — hope you're ready for another boring night. Need a refresher before I cut you loose, or do you remember where everything is?",
      onEnter: (state, actions) => actions.revealWindow('contacts'),
      choices: [
        { label: 'Yes, walk me through it.', next: 'walkthrough-dispatch' },
        { label: "No, I've got it.", next: 'no-tutorial' },
      ],
    },
    'no-tutorial': {
      text: "No problem. Good luck out there.",
      onEnter: (state, actions) => actions.startGame(),
      choices: null,
    },
    'walkthrough-dispatch': {
      text: "Alright — quick walkthrough. This is your DISPATCH panel.",
      onEnter: (state, actions) => { actions.revealWindow('dispatch'); actions.spotlightWindow('dispatch') },
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
