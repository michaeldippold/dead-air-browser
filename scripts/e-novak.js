// E. Novak — Good Samaritan Hospital
// Pharmacist sheltering in the hospital dispensary during the outbreak.
// Trigger: zombies reach Good Samaritan Hospital.
// Arc: she calls for help. Player can keep her in place or tell her to run.
//      Running is fast and probably fatal. Staying is slow, detailed, and ends with
//      her attempting to move at dawn. Pure call-and-response, no auto-resolution for
//      not answering (see design.md, Content System).

export default {
  id:          'e-novak',
  name:        'E. Novak',
  callerRole:  'civilian',
  callerItems: [],
  district:    'memorial',
  trigger:     { type: 'zombie-presence', district: 'memorial' },
  once:        true,

  nodes: {

    // ── Opening call ──────────────────────────────────────────────────────────

    0: {
      text: "This is Elaine Novak. I'm a pharmacist — I'm locked inside the dispensary at Good Samaritan Hospital. Whatever is happening out there started on my block maybe two hours ago. I have medication here. Is anyone coordinating a response?",
      choices: [
        { label: 'Stay put. We have the situation.',  next: 'stay-ack' },
        { label: 'Get out now — use a back exit.',    next: 'run'      },
      ],
    },

    // ── Stay path ─────────────────────────────────────────────────────────────

    'stay-ack': {
      text: "Copy. I'll stay. I can see the parking lot from the back window. Maybe four or five of them down there. They aren't moving right. I'm going to stop looking now.",
      choices: null,
      timer: 10, timerNext: 'stay-update-1',
    },

    'stay-update-1': {
      text: "Update: more of them outside now. The building across the street went dark an hour ago. Someone tried the exterior door — they stopped eventually. I found a radio in the break room. One channel had someone reading names. A lot of names. I turned it off. Any news?",
      choices: [
        { label: 'Stay away from windows. You are doing the right thing.', next: 'stay-comfort'   },
        { label: 'Is the loading bay exit still clear?',                    next: 'run-from-stay' },
      ],
      timer: 12, timerNext: 'stay-update-1-silent',
    },

    'stay-update-1-silent': {
      text: "...still here. I don't need updates. I just wanted someone to know.",
      choices: null,
      timer: 15, timerNext: 'stay-update-2',
    },

    'stay-comfort': {
      text: "Okay. I moved the pharmacy cart against the back door. It's not much. Found crackers in the vending machine. The hardest part is not knowing how long.",
      choices: null,
      timer: 15, timerNext: 'stay-update-2',
    },

    'stay-update-2': {
      text: "It's dark now. There's a candle in a second-floor window across the parking lot. A family — man, woman, small child I think. We've been watching each other for an hour. I held up a piece of paper that said STAY. She nodded. Best conversation I've had all day.",
      choices: [
        { label: "You're not alone in this.",             next: 'stay-night-warm'     },
        { label: 'Good. Keep your lights off your side.', next: 'stay-night-cautious' },
      ],
      timer: 12, timerNext: 'stay-update-2-silent',
    },

    'stay-update-2-silent': {
      text: "I know you're busy. I'll stop calling unless something changes.",
      choices: null,
      timer: 20, timerNext: 'stay-dawn',
    },

    'stay-night-warm': {
      text: "...no. I guess I'm not. Thank you for that.",
      choices: null,
      timer: 20, timerNext: 'stay-dawn',
    },

    'stay-night-cautious': {
      text: "Right. Of course. I turned off the exit sign above my door. Feels wrong but I understand.",
      choices: null,
      timer: 20, timerNext: 'stay-dawn',
    },

    'stay-dawn': {
      text: "It went quiet around 3am and stayed that way. I'm going to try to move at first light — parking structure two blocks north, go floor by floor. If you don't hear from me again... Room B2, refrigerated cabinet. The antibiotics. For whoever gets here after.",
      choices: null,
      resolve: 'waiting',
    },

    // ── Run paths ─────────────────────────────────────────────────────────────

    'run': {
      text: "Okay. There's a side door through the loading bay. If you don't hear from me — there's a Theresa Novak in Joyland. My sister. Tell her I tried.",
      choices: null,
      timer: 6, timerNext: 'run-lost',
    },

    'run-from-stay': {
      text: "...you're right. I've stayed long enough. Loading bay's still clear as far as I can see. I'm going.",
      choices: null,
      timer: 6, timerNext: 'run-lost',
    },

    'run-lost': { text: null, resolve: 'lost' },
  },
}
