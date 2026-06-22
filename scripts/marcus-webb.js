// Marcus Webb — Old Iron Works
// Machinist holed up with a group of coworkers. Competent, pragmatic, no-nonsense.
// Trigger: zombies reach Old Iron Works.
// Arc: he's already organized. Wants to know if you're worth coordinating with.
//      Player can tell him to hold, ask for intel, or push him north toward LPD HQ.
//      Pushing north is risky. Holding is stable but costs him a man eventually.

export default {
  id:          'marcus-webb',
  name:        'Marcus Webb',
  callerRole:  'civilian',
  callerItems: [],
  district:    'ironworks',
  trigger:     { type: 'zombie-presence', district: 'ironworks' },
  once:        true,

  nodes: {

    0: {
      text: "Marcus Webb, Old Iron Works. Eight of us here — machinists, couple maintenance guys. Solid doors, some improvised tools. Are you people running a coordinated response or are we handling this ourselves?",
      choices: [
        { label: 'We have it. Hold your position.',     next: 'webb-hold'  },
        { label: 'What can you see from your end?',     next: 'webb-intel' },
      ],
      timer: 12, timerNext: 'webb-silent',
    },

    'webb-hold': {
      text: "Copy. We'll hold. Just know — we're not going to sit here and rot if it comes through the door. You give the word, we can push.",
      choices: null,
      timer: 15, timerNext: 'webb-update',
    },

    'webb-intel': {
      text: "Street's bad to the south. Something happened at the warehouse two blocks over — don't know what. We've got line of sight on the main road. Foot traffic stopped about an hour ago. No vehicles.",
      choices: [
        { label: 'That helps. Keep your doors locked.',          next: 'webb-hold' },
        { label: 'If it worsens, push north toward LPD HQ.', next: 'webb-push' },
      ],
      timer: 10, timerNext: 'webb-hold',
    },

    'webb-update': {
      text: "Lost one man — went to check on his truck in the lot. We gave it thirty minutes. He's not coming back. Seven of us now. Everything else holding.",
      choices: [
        { label: 'Hold position. You did right by him.',     next: 'webb-resolve' },
        { label: 'Get your people moving. Head north now.', next: 'webb-push'    },
      ],
      timer: 10, timerNext: 'webb-resolve',
    },

    'webb-resolve': {
      text: "Understood. We'll hold. Whatever happens tonight — you have my word nobody panicked.",
      choices: null,
      resolve: 'waiting',
    },

    'webb-push': {
      text: "Copy. We're moving. I'll call when we're clear. Or I won't. Either way we went down doing something.",
      choices: null,
      timer: 8, timerNext: 'webb-lost',
    },

    'webb-lost': { text: null, resolve: 'lost' },

    'webb-silent': {
      text: "We'll handle it.",
      choices: null,
      resolve: 'waiting',
    },
  },
}
