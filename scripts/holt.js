// Deputy Director Holt — Office of Emergency Management
// A government official who doesn't believe the player and won't act without proper channels.
// Trigger: game time reaches 21:00, fires regardless of district state.
// Arc: he calls to question your authority, not to ask for help.
//      Player can push back, warn him directly, or get caught in his skepticism.
//      If convinced, he becomes cooperative. If not, he goes through "proper channels"
//      while his building goes quiet around him.

export default {
  id:          'holt',
  name:        'Dep. Dir. Holt',
  callerRole:  'civilian',
  callerItems: [],
  district:    null,   // not tied to a district — he calls from wherever he is
  trigger:     { type: 'game-time', hour: 21 },
  once:        true,

  nodes: {

    0: {
      text: "This is Deputy Director Holt, Office of Emergency Management. I understand you're running some kind of parallel operation tonight. I'd like to understand the authority under which you're operating and what exactly you're telling people.",
      choices: [
        { label: 'We are the only response on the ground right now.',  next: 'holt-pushback' },
        { label: 'Director, you need to evacuate your building now.',  next: 'holt-warn'     },
      ],
      timer: 10, timerNext: 'holt-no-answer',
    },

    'holt-pushback': {
      text: "The only response. Right. I have seventeen years in emergency management. I've seen mass panic events before. People in crisis misidentify — what exactly are we dealing with here?",
      choices: [
        { label: 'Confirmed infected individuals across multiple districts.', next: 'holt-warn'    },
        { label: 'Something we have never seen before.',                      next: 'holt-skeptic' },
      ],
      timer: 10, timerNext: 'holt-dig-in',
    },

    'holt-warn': {
      text: "You're telling me to move my staff based on — look, I have people trying to reach the mayor's office. I am not going to authorize a building evacuation because a dispatcher told me to.",
      choices: [
        { label: 'Director. The spread will reach City Hall. Please move.', next: 'holt-convinced' },
      ],
      timer: 10, timerNext: 'holt-dig-in',
    },

    'holt-skeptic': {
      text: "Something you've never seen before. That's — that's not a briefing. That's not actionable information. I need facts, not atmosphere.",
      choices: null,
      timer: 6, timerNext: 'holt-dig-in',
    },

    'holt-convinced': {
      text: "...alright. I'm going to take this seriously. Shelter-in-place for the block — I can authorize that. You have my cooperation. What do you need from me?",
      choices: null,
      resolve: 'waiting',
    },

    'holt-dig-in': {
      text: "I need to go through proper channels on this. I'll have someone call you back.",
      choices: null,
      timer: 15, timerNext: 'holt-lost',
    },

    // ── Ignored path ──────────────────────────────────────────────────────────

    'holt-no-answer': {
      text: "I see. Well. We'll handle this through the appropriate office.",
      choices: null,
      timer: 15, timerNext: 'holt-no-answer-final',
    },

    'holt-no-answer-final': {
      text: "I've been unable to reach anyone in the chain of command. The building has gone very quiet. I want it on record — for whatever record still exists — that I followed procedure.",
      choices: null,
      timer: 8, timerNext: 'holt-lost',
    },

    'holt-lost': { text: null, resolve: 'lost' },
  },
}
