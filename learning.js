// Journey state for The Falling Satellite. A lesson is evidence of what a
// child tried, never a score. Self-paced: Next and Back are always available.
export const questions = {
  drop: {
    title: 'What pulls the ball down?',
    choices: ["Earth pulls it. That pull is called gravity.", 'The air pushes it down.', "It's just heavy. Nothing pulls it."],
    answer: 0,
    why: [
      'Yes. Earth pulls everything toward its middle. We call that pull gravity.',
      'Air can slow a falling feather, but it does not push things down. Even with no air, things fall.',
      'Heavy is real, but the heaviness IS the pull. On the Moon the same ball feels lighter, because the Moon pulls less.',
    ],
  },
  throw: {
    title: 'If you throw the ball harder, what changes?',
    choices: ['It lands farther away.', 'It stops falling.', 'It falls straight down faster.'],
    answer: 0,
    why: [
      'Right. It still falls the whole time, but more sideways speed carries it farther before it lands.',
      'It never stops falling. Harder throws just travel farther while falling.',
      'Gravity pulls it down at the same rate whatever the sideways speed. The sideways part is what changes.',
    ],
  },
  miss: {
    title: 'The mightiest throw never lands. Why not?',
    choices: ['It keeps falling, but the ground curves away beneath it.', 'Gravity switches off up there.', 'It is going too fast to fall.'],
    answer: 0,
    why: [
      'Yes. It falls the whole way around. The ground curves away just as fast, so it keeps missing. That is an orbit.',
      "Gravity still pulls up there. It's almost as strong as down here.",
      'Fast things still fall. This ball is falling every single second. It just keeps missing the ground.',
    ],
  },
  float: {
    title: 'Astronauts float inside their space station because…',
    choices: ['they and the station are falling around Earth together.', 'there is no gravity in space.', 'the station’s engines hold them up.'],
    answer: 0,
    why: [
      'Yes. Everything inside falls together, so nothing presses them to the floor. Falling together feels like floating.',
      "Earth's pull up there is almost as strong as on the ground. The station stays up by falling sideways, not by escaping gravity.",
      'The engines are off almost all the time. The station and everyone in it are falling around Earth together.',
    ],
  },
  match: {
    title: 'One special orbit takes exactly one day, the same time as one Earth spin. If it goes the same way Earth turns, high above the equator, what happens?',
    choices: ['It stays above the same spot all day and night.', 'It zooms ahead of the ground.', 'It falls down when night comes.'],
    answer: 0,
    why: [
      'Right. It circles once while Earth spins once, at the same pace and in the same direction, so it keeps up with one spot. That is a geostationary orbit.',
      'Its one-day pace exactly matches the spin below, so it neither pulls ahead nor falls behind.',
      'Day and night make no difference to an orbit. It keeps falling around Earth, matching the spin.',
    ],
  },
};

export const transfer = {
  title: 'A new case: another satellite also takes exactly one day per circle, but its path is tilted instead of flat above the equator. Does it stay over one spot?',
  choices: [
    'No. It drifts north and south over the day, then comes back.',
    'Yes. Any one-day orbit stays over one spot.',
    'It falls, because tilted paths are unbalanced.',
  ],
  answer: 0,
  why: [
    'Exactly. Same one-day period, but the tilt carries it north and south of the equator each day. Staying over one spot needs the flat, equator-hugging path too.',
    'One day is not enough by itself. The path must also circle flat above the equator, going the way Earth turns.',
    'Tilted orbits do not fall. They keep circling. They just cannot stay parked over one spot.',
  ],
};

export const teachback = {
  prompt: 'Tell a friend in your own words: why doesn’t a satellite fall down?',
  reveal: 'One good way to say it: it IS falling, the whole time. But it moves sideways so fast that the ground curves away beneath it, so it keeps missing. And the special far satellites fall in time with Earth’s spin, so they hang over one spot.',
};

export const STEP_COUNT = 10; // 0 orient … 9 done

export function createJourney() {
  return { step: 0, answers: {}, feedbackFor: null, transferChoice: null, transferFeedback: false, taughtBack: false, acted: {} };
}

export function reduceJourney(s, a) {
  const n = { ...s, answers: { ...s.answers }, acted: { ...s.acted } };
  switch (a.type) {
    case 'reset': return createJourney();
    case 'acted': if (typeof a.step === 'string') n.acted[a.step] = true; return n;
    case 'start': if (s.step === 0) n.step = 1; return n;
    case 'next': if (s.step < STEP_COUNT - 1) { n.step++; n.feedbackFor = null; } return n;
    case 'back': if (s.step > 0) { n.step--; n.feedbackFor = null; } return n;
    case 'answer':
      if (typeof a.question === 'string' && Number.isInteger(a.choice) && questions[a.question] && a.choice >= 0 && a.choice < questions[a.question].choices.length) {
        n.answers[a.question] = a.choice; n.feedbackFor = a.question;
      }
      return n;
    case 'answerTransfer':
      if (Number.isInteger(a.choice) && a.choice >= 0 && a.choice < transfer.choices.length) { n.transferChoice = a.choice; n.transferFeedback = true; }
      return n;
    case 'teachback': n.taughtBack = true; return n;
    default: return s;
  }
}
