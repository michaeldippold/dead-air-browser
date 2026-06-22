// Danny — Joyce Park (last name unknown)
// A child on a landline. Parents went to get grandma and haven't come back.
// Trigger: zombies reach Joyce Park.
// Arc: he followed his dad's instructions to the letter. He's scared but not panicking.
//      Player can keep him in place, send him to Mrs. Kowalski down the hall, or ignore him.
//      Ignoring him is the worst outcome. Sending him to the neighbor is the best.
//      The no-answer path is designed to be haunting — he goes quiet methodically.

export default {
  id:          'danny',
  name:        'Unknown — Child',
  callerRole:  'civilian',
  callerItems: [],
  district:    'northgate',
  trigger:     { type: 'zombie-presence', district: 'northgate' },
  once:        true,

  nodes: {

    0: {
      text: "Hello? Is this the emergency number? My dad said to call this if something happened. There are people outside and they look sick. My mom and dad went to get my grandma and they haven't come back. I locked the door like my dad said.",
      choices: [
        { label: 'You did exactly right. Stay locked in.',  next: 'danny-stay'     },
        { label: 'Is there a neighbor you can go to?',      next: 'danny-neighbor' },
      ],
      timer: 10, timerNext: 'danny-no-answer',
    },

    'danny-stay': {
      text: "Okay. I have cereal and I know where the flashlight is. Can you find my dad? His name is David Reyes. He has a blue car.",
      choices: null,
      timer: 15, timerNext: 'danny-update',
    },

    'danny-neighbor': {
      text: "There's Mrs. Kowalski down the hall but my dad said not to bother her. Should I knock? He said don't open the door for anyone.",
      choices: [
        { label: 'Your dad gave good advice. Stay put for now.', next: 'danny-stay'      },
        { label: 'Mrs. Kowalski is the exception. Go knock.',    next: 'danny-kowalski' },
      ],
      timer: 8, timerNext: 'danny-stay',
    },

    'danny-kowalski': {
      text: "She let me in. She has soup on. She doesn't have a phone but I brought mine. She keeps saying everything is going to be alright and I think she actually believes it. Thank you.",
      choices: null,
      resolve: 'waiting',
    },

    'danny-update': {
      text: "Hello? It's been a really long time now. The lights across the street went out. I ate the cereal. I'm going to keep the radio on low. Did anyone find my dad?",
      choices: [
        { label: "We're looking. You're safe where you are.", next: 'danny-reassure' },
        { label: 'Stay quiet. Keep the lights off.',          next: 'danny-dark'    },
      ],
      timer: 10, timerNext: 'danny-quiet',
    },

    'danny-reassure': {
      text: "Okay. I'll wait. I'm going to leave the window open a little so I can hear if his car comes back.",
      choices: null,
      resolve: 'waiting',
    },

    'danny-dark': {
      text: "Okay. I turned off the lights. It's really dark. ...Okay.",
      choices: null,
      resolve: 'waiting',
    },

    'danny-quiet': {
      text: "...okay.",
      choices: null,
      resolve: 'waiting',
    },

    // ── Ignored path ──────────────────────────────────────────────────────────

    'danny-no-answer': {
      text: "Hello? Is anyone — okay. I'll just wait.",
      choices: null,
      timer: 20, timerNext: 'danny-no-answer-final',
    },

    'danny-no-answer-final': {
      text: "...someone's at the front door. They're knocking but it doesn't sound like my dad. I put the chair against it like in the movies. I'm going to stay quiet now.",
      choices: null,
      timer: 6, timerNext: 'danny-no-answer-lost',
    },

    'danny-no-answer-lost': { text: null, resolve: 'lost' },
  },
}
