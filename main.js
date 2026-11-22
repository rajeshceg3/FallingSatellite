// The Falling Satellite — hand-inked orbit journey for ages 7–10.
// Two honest models: fall.js integrates gravity for the throws; orbit.js
// provides exact circular cases for the satellite scenes. No auto-advance:
// every animation is learner-started, with step buttons as static equivalents.
import {
  EARTH_RADIUS, EARTH_OMEGA, ROTATION_PERIOD, MATCHED_RADIUS,
  CASES, at, groundPosition, circular,
} from './orbit.js';
import { march, circularSpeed } from './fall.js';
import {
  questions, transfer, teachback, createJourney, reduceJourney, STEP_COUNT,
} from './learning.js';

let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  reducedMotion = e.matches;
  stopPlayback();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (scene) { buildDock(); draw(); }
});
const $ = (id) => document.getElementById(id);
const sceneCanvas = $('scene'), groundCanvas = $('ground');
const sctx = sceneCanvas.getContext('2d'), gctx = groundCanvas.getContext('2d');

/* ---------- theme-aware palette ---------- */
let palette = {};
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  palette = {
    ink: cs.getPropertyValue('--ink').trim() || '#3d2f26',
    paper: cs.getPropertyValue('--paper').trim() || '#f7eedd',
    stage: cs.getPropertyValue('--stage').trim() || '#f1e3cc',
    clay: cs.getPropertyValue('--clay').trim() || '#ffdbac',
    coral: cs.getPropertyValue('--coral').trim() || '#e8735a',
    sky: cs.getPropertyValue('--sky').trim() || '#2c6c91',
  };
}
readPalette();
const dark = matchMedia('(prefers-color-scheme: dark)');
try { if (localStorage.getItem('fs-theme')) document.documentElement.dataset.theme = localStorage.getItem('fs-theme'); } catch {}
readPalette();
$('theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('fs-theme', next); } catch {}
  $('theme').setAttribute('aria-pressed', String(next === 'dark'));
  $('theme').setAttribute('aria-label', next === 'dark' ? 'Use light theme' : 'Use dark theme');
  readPalette();
  draw();
});

/* ---------- canvas sizing ---------- */
let SW = 1, SH = 1, GW = 1;
function fit() {
  const r = sceneCanvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  SW = r.width; SH = r.height;
  sceneCanvas.parentElement.classList.toggle("compact-scene", SH < 300);
  sceneCanvas.width = Math.round(SW * dpr); sceneCanvas.height = Math.round(SH * dpr);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = groundCanvas.getBoundingClientRect();
  GW = g.width;
  groundCanvas.width = Math.round(GW * dpr); groundCanvas.height = Math.round(GW * dpr);
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
  positionCue(zoneState(STEPS[journey.step]));
}
new ResizeObserver(fit).observe(sceneCanvas.parentElement);

/* the one cue arrow: points at the single active zone, then disappears */
function positionCue() { $('cue').hidden = true; }

/* ---------- seeded ink strokes (deterministic for stable frames) ---------- */
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function inkLine(ctx, x0, y0, x1, y1, seed, wobble = 1.6) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy), n = Math.max(2, Math.round(len / 14));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = (hash(seed + i) - 0.5) * wobble;
    const px = x0 + dx * t - (dy / (len || 1)) * off;
    const py = y0 + dy * t + (dx / (len || 1)) * off;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
}
/* watercolor depth: two low-alpha offset fills of the same color under the
   ink stroke. Same palette, no new colors (docs/TOKENS.md). */
function wash(ctx, cx, cy, r, color) {
  if (!(r > 0.5)) return; // hidden/zero-size stage: nothing honest to paint
  ctx.save();
  ctx.globalAlpha = 0.1; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx + 1.5, cy - 1.5, r + 1.5, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.055;
  ctx.beginPath(); ctx.arc(cx - 1, cy + 2, Math.max(1, r - 1), 0, 7); ctx.fill();
  ctx.restore();
}
function inkCircle(ctx, cx, cy, r, seed, wobble = 1.4, fill) {
  ctx.beginPath();
  const n = Math.max(18, Math.round(r / 4));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + (hash(seed + i * 1.7) - 0.5) * wobble;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  if (fill) { ctx.fill(); }
  ctx.stroke();
}
function hatch(ctx, cx, cy, r, seed, count = 5) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.1;
  for (let i = 0; i < count; i++) {
    const a = hash(seed + i * 3.3) * Math.PI * 2;
    const rr = r * (0.25 + 0.6 * hash(seed + i * 7.1));
    const x0 = cx + Math.cos(a) * rr, y0 = cy + Math.sin(a) * rr;
    const len = r * (0.15 + 0.2 * hash(seed + i * 5.9));
    const da = a + Math.PI / 2;
    inkLine(ctx, x0, y0, x0 + Math.cos(da) * len, y0 + Math.sin(da) * len, seed + i * 11.3, 0.8);
  }
  ctx.restore();
}

/* ---------- formatting ---------- */
function fmtDur(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} min`;
}
const fmtKm = (m) => `${Math.round(m / 1000).toLocaleString('en-IN')} km`;

/* ---------- journey steps ---------- */
const ELEV = 0.35; // viewing elevation for 3D orbit scenes
const project = (p, k, cx, cy) => [cx + p[0] * k, cy - (p[2] * Math.cos(ELEV) + p[1] * Math.sin(ELEV)) * k];

const LAUNCH_ALT = 400000; // a pretend 400 km mountain, above the air
const THROWS = {
  gentle: { speed: 1500, label: 'Gentle' },
  strong: { speed: 4500, label: 'Strong' },
  mightiest: { speed: circularSpeed(EARTH_RADIUS + LAUNCH_ALT), label: 'Mightiest' },
};

const STEPS = [
  { id: 'cover', title: 'The Falling Satellite',
    copy: 'Maps, weather warnings, TV from far away - they all ride on satellites flying overhead. Nothing holds a satellite up. So why doesn’t it fall down? Start with a ball and find out.',
    scene: 'cover' },
  { id: 'drop', title: 'Everything falls',
    copy: 'Hold a ball high, then tap Drop. Down it comes. Everything falls — even high up where satellites fly.',
    more: 'Earth’s pull reaches far beyond the sky. The Moon is falling toward Earth too. It stays up the same way a satellite does — by moving sideways while it falls.',
    question: 'drop', scene: 'drop' },
  { id: 'throw', title: 'Throw it sideways',
    copy: 'Throw sideways instead. The ball still falls the whole time, but it travels while falling. Try Gentle and Strong.',
    more: 'The sideways speed and the falling are separate. Gravity keeps pulling down at the same rate no matter how fast the ball moves sideways.',
    question: 'throw', scene: 'throw', throws: ['gentle', 'strong'], need: ['gentle', 'strong'] },
  { id: 'miss', title: 'Throw hard enough to miss the ground',
    copy: 'Earth is round, so the ground curves away. Can a ball fall so far it never lands? Try Mightiest.',
    more: 'Thrown at about 8 kilometres every second, the ball falls as fast as the ground curves away beneath it, so it keeps missing — that is an orbit. We are pretending there is no air to slow the ball, and no mountains in the way. Real rockets first climb above the air, then turn sideways to reach orbit speed. Throw harder still — past about 11 kilometres a second — and the ball escapes Earth forever. This app keeps the three honest throws.',
    question: 'miss', scene: 'throw', throws: ['gentle', 'strong', 'mightiest'], need: ['mightiest'] },
  { id: 'float', title: 'There IS gravity up here',
    copy: 'Up here, Earth’s pull is nearly as strong as on the ground. Tap Show Earth’s pull. So why do astronauts float?',
    more: 'This satellite circles close above Earth, where the pull is about nine-tenths of the pull on the ground. Astronauts float because they and their station are falling around Earth together: nothing presses them to the floor, the same way riders float in a falling lift. “Weightless” never means “no gravity”.',
    question: 'float', scene: 'orbitLow' },
  { id: 'compare', title: 'Close is quick, far is slow',
    copy: 'The near satellite circles in an hour and a half. The far one needs a whole day. Play one day and count.',
    more: 'Farther out, Earth’s pull is weaker, so a slower sideways speed is enough to keep missing the ground. Slow and far means each circle takes longer.',
    scene: 'compare' },
  { id: 'spin', title: 'Meanwhile, Earth spins',
    copy: 'Earth turns once a day. Watch the home flag — and the small panel that rides along with the spin.',
    more: 'The panel shows the spot on the ground directly under the satellite, riding along with the spinning Earth. The near satellite sweeps over place after place, circling about 16 times while Earth spins once.',
    scene: 'spin', ground: true },
  { id: 'match', title: 'The orbit that keeps up',
    copy: 'Far enough out, one circle takes exactly one day. Put one high above the equator, going Earth’s way, and watch a full day.',
    more: 'That is a geostationary orbit, a special geosynchronous one. Geosynchronous means its period matches Earth’s spin. Geostationary is the special case: circular, above the equator, going the way Earth turns — so it stays parked over one spot. That is why TV dish antennas can point at one place in the sky.',
    question: 'match', scene: 'match', ground: true },
  { id: 'tilt', title: 'Same day, different path',
    copy: 'Tilt that one-day orbit. It still circles once a day, but drifts north and south. Same day, not the same place.',
    more: 'The loop the ground point draws over one day is what ground trackers really see from a tilted one-day satellite. A tilted one-day orbit is geosynchronous, but not geostationary.',
    scene: 'tilt', ground: true },
  { id: 'transfer', title: 'One last puzzle', scene: 'transfer', ground: true, transfer: true },
];

/* One stable control. The scene never advances the lesson. */
function zoneState() { return {active: flow.phase, nextEnabled: true}; }
function markActed() {}

/* ---------- scene state ---------- */
let lastRenderedStep = -1;
let flow = {phase: "cover", action: 0, choice: null};
const history = [];
let segmentStart = null;
let runToken = 0;
let journey = createJourney();
let scene = null;
function makeScene(id) {
  const base = { id, playing: false, t: 0, trail: [], pull: false };
  if (id === 'drop') return { ...base, dropped: false, anim: 0, pulse: 1 };
  if (id === 'throw') return { ...base, run: null, idx: 0, choice: null, done: '', thrownSet: {} };
  return base;
}
const ORBIT_FOR = { orbitLow: CASES.low, compare: null, spin: CASES.low, match: CASES.stationary, tilt: CASES.tiltedMatched, transfer: circular(MATCHED_RADIUS, Math.PI / 12) };

/* compression: sim seconds per wall second while playing */
const RATE = { orbitLow: 260, compare: 1800, spin: 1800, match: 1800, tilt: 1800, transfer: 1800 };
const STEP_SIZES = { orbitLow: [60, 600], compare: [900, 3600], spin: [900, 3600], match: [900, 3600], tilt: [900, 3600], transfer: [900, 3600] };

/* ---------- one-control journey ---------- */
const LESSON = {
  drop: { actions: ['Drop the ball'], before: ['You let go of a ball. Where will it go?'], results: ['It fell straight down. Something pulled it toward the ground.'] },
  throw: { actions: ['Throw gently', 'Throw harder'], before: ['What changes when the ball moves sideways?', 'Same ball. Same height. More sideways speed.'], results: ['A sideways throw still falls. Now compare a stronger throw.', 'The stronger throw travels farther, but still falls.'] },
  miss: { actions: ['Try an orbital throw'], before: ['The ground curves away. What if the ball moves sideways fast enough?'], results: ['The ball keeps falling. The round ground curves away just as fast.'] },
  float: { actions: ["Reveal Earth's pull"], before: ['The station is high above the ground. Has gravity disappeared?'], results: ['Earth still pulls the station inward. Everything inside falls with it.'] },
  compare: { actions: ['Compare one day'], before: ['A near satellite and a far satellite. Which takes longer to circle?'], results: ['The near satellite circles about sixteen times while the far one circles once.'] },
  spin: { actions: ['Turn Earth one day'], before: ['Earth turns too. Follow the blue home flag.'], results: ['Earth spins once. The near satellite passes many different places.'] },
  match: { actions: ['Match one day'], before: ['Give the far satellite one circle per Earth spin, above the equator.'], results: ['One circle. One spin. Same direction. The satellite stays over home.'] },
  tilt: { actions: ['Tilt the orbit'], before: ['Keep the one-day time, but tilt the orbit. What changes?'], results: ['The ground trace wanders north and south. A one-day orbit alone is not enough.'] },
};
function remember() {
  history.push({ journey: structuredClone(journey), flow: structuredClone(flow), scene: structuredClone(scene) });
}
function setPhase(phase) { flow.phase = phase; renderGuide(); }
function questionFor(st) { return st.transfer ? transfer : questions[st.question]; }
function resetAll() {
  stopPlayback(); runToken++; history.length = 0;
  journey = createJourney(); flow = {phase: 'cover', action: 0, choice: null};
  enterScene(); renderGuide();
}
function nextChapter() {
  if (journey.step === STEP_COUNT - 1) { setPhase('teachback'); return; }
  journey = reduceJourney(journey, {type: journey.step === 0 ? 'start' : 'next'});
  flow = {phase: journey.step === STEP_COUNT - 1 ? 'question' : 'action', action: 0, choice: null};
  enterScene(); renderGuide();
}
function resultOf(st) {
  if (st.transfer) return transfer.why[flow.choice];
  return LESSON[st.id]?.results[flow.action] || '';
}
function renderGuide() {
  const st = STEPS[journey.step], phase = flow.phase, config = LESSON[st.id];
  const q = questionFor(st);
  const question = phase === 'question';
  const reading = ['question','feedback','teachback','explain','done'].includes(phase);
  document.body.dataset.phase = phase;
  document.body.classList.toggle('question-moment', reading);
  document.body.classList.remove('peek-scene');
  $('peek').hidden = true;
  $('step-title').textContent = question ? (st.transfer ? 'One more orbit' : st.title)
    : phase === 'teachback' ? 'Make it yours'
    : phase === 'explain' ? 'Always falling. Always missing.'
    : phase === 'done' ? 'A new way to see the sky' : st.title;
  let copy = phase === 'cover' ? 'Toss a ball. It comes down. A satellite is falling too. So why does it never reach the ground?'
    : question ? q.title
    : phase === 'feedback' ? (st.transfer ? transfer.why[flow.choice] : q.why[flow.choice])
    : phase === 'teachback' ? 'A friend asks: “Why doesn’t a satellite fall down?” Explain it in your own words.'
    : phase === 'explain' ? 'It IS falling. It moves sideways so fast that the ground curves away beneath it. An orbit is a fall that keeps missing.'
    : phase === 'done' ? 'You followed a ball all the way to an orbit. Look up. Every satellite is doing the same thing.'
    : phase === 'result' ? resultOf(st) : config?.before[flow.action] || '';
  if (st.transfer && question) copy = 'A new satellite takes one day per orbit, but its path is tilted. Will it stay over the same spot?';
  $('step-copy').textContent = copy;
  $('feedback').textContent = '';
  const box = $('answers'); box.replaceChildren();
  if (question) {
    box.setAttribute('role','radiogroup'); box.setAttribute('aria-label', q.title);
    q.choices.forEach((text, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role','radio');
      button.setAttribute('aria-checked', String(flow.choice === i));
      button.textContent = text;
      button.addEventListener('click', () => {
        flow.choice = i;
        box.querySelectorAll('button').forEach((b,j) => b.setAttribute('aria-checked',String(i === j)));
        $('next').textContent = 'Check my answer →';
        $('next').setAttribute('aria-label','Check my answer');
      });
      button.addEventListener('keydown', (event) => {
        if (!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const offset = ['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1;
        const j = (i + offset + q.choices.length) % q.choices.length;
        const target = box.children[j]; target.click(); target.focus();
      });
      box.appendChild(button);
    });
  } else { box.removeAttribute('role'); box.removeAttribute('aria-label'); }
  const labels = {
    cover:'Start with a ball', action:config?.actions[flow.action], running:'See the result',
    result: st.transfer ? 'Explain it back' : config && flow.action < config.actions.length - 1 ? config.actions[flow.action + 1] : q ? 'Think it through' : 'Next discovery',
    question: flow.choice === null ? 'Choose an answer' : 'Check my answer',
    feedback: st.transfer ? 'Test that prediction' : 'Next discovery',
    teachback:'See one explanation', explain:'Finish the journey', done:'Back to the map',
  };
  const next = $('next'); next.hidden = false; next.disabled = false;
  next.textContent = (labels[phase] || 'Next discovery') + ' →';
  next.setAttribute('aria-label', labels[phase] || 'Next discovery');
  $('back').hidden = !history.length; $('back').disabled = !history.length;
  $('progress').replaceChildren();
  for (let i=0;i<STEP_COUNT;i++) { const dot=document.createElement('i'); if(i===journey.step)dot.className='active'; $('progress').appendChild(dot); }
  $('progress').setAttribute('aria-label', `Chapter ${journey.step + 1} of ${STEP_COUNT}`);
  $('scene-dock').replaceChildren();
  const replay = $('replay'); replay.hidden = phase !== 'result';
  $('step-title').focus({preventScroll:true});
  if (stageDirty && !reading) fit();
  draw();
}
function finishSegment() {
  stopPlayback(); runToken++;
  const st = STEPS[journey.step];
  if (scene.id === 'drop') { scene.dropped=true; scene.anim=1; scene.pulse=1; }
  else if (scene.id === 'throw') { scene.idx=scene.run.samples.length-1; scene.thrownSet[scene.choice]=true; }
  else {
    scene.t = scene.id === 'orbitLow' ? 600 : ROTATION_PERIOD;
    scene.trail = [];
    const total = scene.t; scene.t = 0;
    for(let i=0;i<=240;i++){scene.t=total*i/240;recordTrail();}
  }
  journey.acted[st.id] = true;
  setPhase('result');
}
function beginSegment() {
  const st = STEPS[journey.step];
  stopPlayback(); runToken++; flow.phase='running';
  scene = makeScene(st.scene); primeTrail();
  if(scene.id==='drop') { scene.dropped=true; scene.anim=0.0001; scene.pulse=0; }
  else if(scene.id==='throw') {
    const key = st.id==='miss' ? 'mightiest' : flow.action===0 ? 'gentle' : 'strong';
    const th=THROWS[key];
    scene.run=march(th.speed,{altitude:LAUNCH_ALT,maxSeconds:key==='mightiest'?2.2*(2*Math.PI*Math.sqrt((EARTH_RADIUS+LAUNCH_ALT)**3/3.986004415e14)):30000});
    scene.choice=key; scene.idx=0;
  } else { scene.pull = scene.id==='orbitLow'; }
  renderGuide();
  if (reducedMotion) { finishSegment(); return; }
  segmentStart=null;scene.playing=true;lastWall=null;
  if(!rafId)rafId=requestAnimationFrame(tick);
}
$('next').addEventListener('click', () => {
  const st=STEPS[journey.step], phase=flow.phase, config=LESSON[st.id];
  if(phase==='question' && flow.choice===null) {
    const first=$('answers').querySelector('button'); first?.focus();
    $('answers').classList.remove('nudge'); void $('answers').offsetWidth; $('answers').classList.add('nudge'); return;
  }
  if(phase==='running'){finishSegment();return;}
  if(phase==='done'){location.assign('https://wonder-atlas.pages.dev/');return;}
  remember();
  if(phase==='cover'){nextChapter();return;}
  if(phase==='action'){beginSegment();return;}
  if(phase==='result') {
    if(st.transfer){setPhase('teachback');return;}
    if(flow.action<config.actions.length-1){flow.action++;beginSegment();return;}
    if(questionFor(st)){setPhase('question');return;}
    nextChapter();return;
  }
  if(phase==='question'){
    journey=reduceJourney(journey,st.transfer?{type:'answerTransfer',choice:flow.choice}:{type:'answer',question:st.question,choice:flow.choice});
    setPhase('feedback');return;
  }
  if(phase==='feedback'){if(st.transfer)beginSegment();else nextChapter();return;}
  if(phase==='teachback'){setPhase('explain');return;}
  if(phase==='explain'){setPhase('done');}
});
$('back').addEventListener('click', () => {
  if(!history.length)return; stopPlayback();runToken++;
  const previous=history.pop();journey=previous.journey;flow=previous.flow;scene=previous.scene;scene.playing=false;
  if(flow.phase==='running')flow.phase='action'; renderGuide();fit();
});
$('replay').addEventListener('click', () => {remember();beginSegment();});
$('reset').addEventListener('click', () => $('reset-confirm').showModal());
$('reset-cancel').addEventListener('click', () => $('reset-confirm').close());
$('reset-yes').addEventListener('click', () => {$('reset-confirm').close();resetAll();});
function buildDock() { $('scene-dock').replaceChildren(); }

function launchThrow(key) {
  const th = THROWS[key];
  const isOrbit = key === 'mightiest';
  const run = march(th.speed, { altitude: LAUNCH_ALT, maxSeconds: isOrbit ? 2.2 * (2 * Math.PI * Math.sqrt((EARTH_RADIUS + LAUNCH_ALT) ** 3 / 3.986004415e14)) : 30000 });
  scene.run = run; scene.choice = key; scene.idx = reducedMotion ? run.samples.length - 1 : 0;
  if (reducedMotion) scene.thrownSet[key] = true;
  scene.done = '';
  if (!reducedMotion) startPlayback();
  buildDock();
}
function advance(ds) {
  const sub = Math.max(1, Math.ceil(ds / 300)); // at least one trail point per 5 sim-minutes
  for (let i = 0; i < sub; i++) {
    scene.t += ds / sub;
    recordTrail();
  }
  draw();
}

/* ---------- trails ---------- */
function orbitOf(sid) { return ORBIT_FOR[sid]; }
function recordTrail() {
  const st = STEPS[journey.step];
  if (!st.ground || !scene) return;
  const o = orbitOf(scene.id);
  const g = groundPosition(o, scene.t);
  const r = Math.hypot(...g);
  const lat = Math.asin(g[2] / r);
  const lon = Math.atan2(g[1], g[0]);
  scene.trail.push({ lat, lon, t: scene.t });
  while (scene.trail.length > 1200) scene.trail.shift();
  while (scene.trail.length && scene.trail[0].t < scene.t - ROTATION_PERIOD * 1.2) scene.trail.shift();
}

/* ---------- drawing: shared bits ---------- */
/* caption that shrinks to fit the stage width and stays centered */
function inkTextFit(ctx, str, y, size = 15) {
  ctx.save();
  while (size > 9) { ctx.font = `600 ${size}px system-ui, sans-serif`; if (ctx.measureText(str).width <= SW - 24) break; size -= 1; }
  const w = ctx.measureText(str).width;
  ctx.restore();
  inkText(ctx, str, Math.max(12, (SW - w) / 2), y, size);
}
function inkText(ctx, str, x, y, size = 14, color) {
  ctx.save();
  size = Math.max(14, size);
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color || palette.ink;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/* layout marks: bounding boxes of drawn text/art, for the no-overlap gate */
const layoutMarks = {};
let orbitInsetClearance = null;
function markReset() { for (const key in layoutMarks) delete layoutMarks[key]; orbitInsetClearance = null; }
function noteRect(name, x0, y0, x1, y1) {
  const cur = layoutMarks[name];
  layoutMarks[name] = cur
    ? { x0: Math.min(cur.x0, x0), y0: Math.min(cur.y0, y0), x1: Math.max(cur.x1, x1), y1: Math.max(cur.y1, y1) }
    : { x0, y0, x1, y1 };
}
function noteText(name, str, x, y, size, align = 'left') {
  sctx.save();
  sctx.font = `600 ${size}px system-ui, sans-serif`;
  const w = sctx.measureText(str).width;
  sctx.restore();
  const x0 = align === 'center' ? x - w / 2 : x;
  noteRect(name, x0, y - size, x0 + w, y + size * 0.3);
}
function drawSatellite(ctx, x, y, seed, scale = 1) {
  ctx.save();
  ctx.globalAlpha = 0.16; ctx.fillStyle = palette.coral;
  ctx.beginPath(); ctx.arc(x, y, 9 * scale, 0, 7); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1.8;
  inkCircle(ctx, x, y, 6 * scale, seed, 0.9, false);
  ctx.fillStyle = palette.coral;
  ctx.beginPath(); ctx.arc(x, y, 2.6 * scale, 0, 7); ctx.fill();
  inkLine(ctx, x - 13 * scale, y, x - 7 * scale, y, seed + 1, 0.6);
  inkLine(ctx, x + 7 * scale, y, x + 13 * scale, y, seed + 2, 0.6);
  ctx.restore();
}
function drawEarthDisk(ctx, cx, cy, r, seed, withHome, t) {
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.fillStyle = palette.clay;
  ctx.lineWidth = 2.2;
  wash(ctx, cx, cy, r, palette.clay);
  inkCircle(ctx, cx, cy, r, seed, 2.2, true);
  hatch(ctx, cx, cy, r, seed + 40, 6);
  if (withHome) {
    const a = t * EARTH_OMEGA;
    const hx = cx + Math.cos(a) * r, hy = cy - Math.sin(a) * r * Math.sin(ELEV);
    ctx.fillStyle = palette.sky;
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(3, r * 0.05), 0, 7); ctx.fill();
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.2; ctx.stroke();
    inkLine(ctx, hx, hy, hx, hy - 9, seed + 51, 0.4);
    inkLine(ctx, hx, hy - 9, hx + 6, hy - 7, seed + 52, 0.4);
  }
  ctx.restore();
}
function drawTime(ctx, lines) {
  ctx.save();ctx.font='600 14px system-ui, sans-serif';let y=26;
  const max=SW - (STEPS[journey.step].ground ? 142 : 32);
  for(const text of lines){
    let line='';
    for(const word of text.split(' ')){
      if(line && ctx.measureText(line+' '+word).width>max){inkText(ctx,line,16,y,14);noteText('timeLines',line,16,y,14);y+=19;line=word;}
      else line+=(line?' ':'')+word;
    }
    if(line){inkText(ctx,line,16,y,14);noteText('timeLines',line,16,y,14);y+=19;}
  }
  ctx.restore();
}

/* ---------- drawing: scenes ---------- */
let stageDirty = false;
function draw() {
  if (getComputedStyle($('model-stage')).display === 'none') { stageDirty = true; return; }
  stageDirty = false;
  const st = STEPS[journey.step];
  sctx.clearRect(0, 0, SW, SH);
  markReset();
  if (!scene) return;
  sceneCanvas.setAttribute('aria-label', sceneLabel(st));
  const id = scene.id;
  sceneCanvas.dataset.sceneId = id;
  groundCanvas.hidden = !st.ground;
  if (id === 'cover') drawCover();
  else if (id === 'drop') drawDrop();
  else if (id === 'throw') drawThrow();
  else drawOrbitSet(st);
  if (st.ground) drawGround();
  markActed();
}
function sceneLabel(st) {
  const base = {
    cover: 'Hand-inked Earth with one satellite circling it.',
    drop: 'A ball held above the ground beside a cliff. It falls when dropped.',
    throw: 'A round Earth with a tall mountain. Thrown balls arc from the mountain top.',
    orbitLow: 'A satellite circling close above Earth.',
    compare: 'Two satellites circling Earth, one near and quick, one far and slow.',
    spin: 'A near satellite circling while Earth spins beneath it.',
    match: 'A far satellite circling once a day, keeping up with Earth’s spin.',
    tilt: 'A tilted one-day orbit, drifting north and south.',
    transfer: 'A new tilted one-day orbit to puzzle over.',
  }[scene.id] || st.title;
  return `${base} Drawing, not to scale.`;
}

function drawCover() {
  const cx = SW / 2, cy = SH / 2;
  const k = (Math.min(SW, SH) * 0.42) / (EARTH_RADIUS * 2.6);
  drawEarthDisk(sctx, cx, cy, EARTH_RADIUS * k, 7, false, 0);
  // one quiet schematic ring + satellite, static
  const o = circular(EARTH_RADIUS * 1.7);
  sctx.strokeStyle = palette.ink;
  sctx.globalAlpha = 0.55; sctx.lineWidth = 1.4;
  sctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const p = project(at(o, (i / 90) * o.period).position, k, cx, cy);
    i ? sctx.lineTo(...p) : sctx.moveTo(...p);
  }
  sctx.stroke();
  sctx.globalAlpha = 1;
  const p = project(at(o, o.period * 0.18).position, k, cx, cy);
  drawSatellite(sctx, p[0], p[1], 900, 1);
}

function drawDrop() {
  const cx = SW / 2, cy = (SH - 80) / 2;
  // ground line + cliff
  sctx.strokeStyle = palette.ink; sctx.lineWidth = 2.2;
  const gy = cy + (SH - 80) * 0.26;
  inkLine(sctx, cx - SW * 0.32, gy, cx + SW * 0.32, gy, 11, 2.2);
  hatch(sctx, cx, gy + 30, 60, 77, 4);
  const holdY = (SH < 260 && matchMedia('(max-width: 760px)').matches) ? Math.max(gy - SH * 0.42, 24) : gy - SH * 0.42;
  let by = holdY;
  if (scene.dropped) {
    const a = scene.anim; // 0..1
    by = holdY + (gy - 14 - holdY) * a * a; // accelerating fall
    if (a < 1) {
      // fall trail
      sctx.save(); sctx.globalAlpha = 0.35; sctx.setLineDash([3, 7]);
      sctx.beginPath(); sctx.moveTo(cx, holdY); sctx.lineTo(cx, by); sctx.stroke(); sctx.restore();
    }
  }
  wash(sctx, cx, by, 11, palette.coral);
  sctx.fillStyle = palette.coral; sctx.strokeStyle = palette.ink; sctx.lineWidth = 2;
  sctx.beginPath(); sctx.arc(cx, by, 11, 0, 7); sctx.fill(); sctx.stroke();
  if (scene.dropped && scene.anim >= 1) {
    // landed thud marks + one calm pulse ring (skipped under reduced motion)
    if (scene.pulse < 1) {
      const pr = 12 + scene.pulse * 22;
      sctx.save(); sctx.globalAlpha = (1 - scene.pulse) * 0.45;
      sctx.strokeStyle = palette.ink; sctx.lineWidth = 2 * (1 - scene.pulse) + 0.5;
      sctx.beginPath(); sctx.arc(cx, gy - 14, pr, 0, 7); sctx.stroke(); sctx.restore();
    }
    inkLine(sctx, cx - 20, gy - 2, cx - 30, gy - 12, 21, 0.6);
    inkLine(sctx, cx + 20, gy - 2, cx + 30, gy - 12, 22, 0.6);
  }

}

function dockH() { const d = $('scene-dock'); return d ? d.offsetHeight + 12 : 0; }
function drawThrow() {
  const availH = Math.max(64, SH - 28); // dock (measured) plus three caption rows get their own space
  const cx = SW / 2, cy = availH / 2 + 8;
  const k = (Math.min(SW, availH) * 0.48) / (EARTH_RADIUS * 1.06);
  const re = EARTH_RADIUS * k;
  drawEarthDisk(sctx, cx, cy, re, 3, false, 0);
  // pretend mountain at the top
  const mx = cx, my = cy - re - (LAUNCH_ALT * k);
  sctx.strokeStyle = palette.ink; sctx.lineWidth = 2;
  inkLine(sctx, mx - 10, cy - re + 3, mx, my, 31, 0.8);
  inkLine(sctx, mx, my, mx + 10, cy - re + 3, 32, 0.8);
  const run = scene.run;
  if (!run) return;
  // reveal path up to idx, older ink fading like a pencil line
  const upto = Math.min(scene.idx, run.samples.length - 1);
  sctx.strokeStyle = palette.ink; sctx.lineWidth = 2;
  [0.15, 0.35, 0.85].forEach((alpha, pi) => {
    const a0 = Math.floor((upto * pi) / 3), a1 = Math.max(a0 + 1, Math.floor((upto * (pi + 1)) / 3));
    sctx.globalAlpha = alpha;
    sctx.beginPath();
    for (let i = a0; i <= Math.min(a1, upto); i++) {
      const s = run.samples[i];
      const x = cx + s.position[0] * k, y = cy - s.position[1] * k;
      i === a0 ? sctx.moveTo(x, y) : sctx.lineTo(x, y);
    }
    sctx.stroke();
  });
  sctx.globalAlpha = 1;
  sctx.stroke(); sctx.globalAlpha = 1;
  const cur = run.samples[upto];
  const bx = cx + cur.position[0] * k, by = cy - cur.position[1] * k;
  wash(sctx, bx, by, 7, palette.coral);
  sctx.fillStyle = palette.coral; sctx.strokeStyle = palette.ink; sctx.lineWidth = 1.8;
  sctx.beginPath(); sctx.arc(bx, by, 7, 0, 7); sctx.fill(); sctx.stroke();
  // zoom bubble: the same real throw, magnified, when the arc is tiny at world scale
  const span = run.samples.reduce((m, s) => Math.max(m, Math.abs(Math.atan2(s.position[0], s.position[1]))), 0);
  if (span < 0.3) {
    const bw = Math.min(SW * 0.52, 240, (availH - 38 - 8) / 0.62), bh = bw * 0.62;
    const bx = 14, by2 = 38;
    noteRect('zoomBubble', bx, by2, bx + bw, by2 + bh);
    sctx.save();
    sctx.fillStyle = palette.paper; sctx.strokeStyle = palette.ink; sctx.lineWidth = 1.6;
    sctx.beginPath(); sctx.roundRect(bx, by2, bw, bh, 14); sctx.fill(); sctx.stroke();
    sctx.beginPath(); sctx.roundRect(bx, by2, bw, bh, 14); sctx.clip();
    // world region: from launch point to landing, fit into the bubble
    const launch = run.samples[0].position;
    const xs = run.samples.slice(0, Math.max(upto, 1) + 1).map((s) => s.position[0]);
    const maxX = Math.max(...xs, 1);
    const zk = (bw * 0.82) / Math.max(maxX, 1);
    const z0x = bx + bw * 0.08, z0y = by2 + bh * 0.62;
    // ground surface inside the region (real curvature)
    sctx.strokeStyle = palette.ink; sctx.lineWidth = 1.8;
    sctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const wx = (i / 40) * (bw * 0.9) / zk;
      const wy = Math.sqrt(Math.max(EARTH_RADIUS ** 2 - wx ** 2, 0));
      const px = z0x + wx * zk, py = z0y - (wy - launch[1]) * zk;
      i ? sctx.lineTo(px, py) : sctx.moveTo(px, py);
    }
    sctx.stroke();
    // thrown path, same world coords
    sctx.strokeStyle = palette.coral; sctx.lineWidth = 1.8;
    sctx.beginPath();
    for (let i = 0; i <= upto; i++) {
      const s = run.samples[i];
      const px = z0x + s.position[0] * zk, py = z0y - (s.position[1] - launch[1]) * zk;
      i ? sctx.lineTo(px, py) : sctx.moveTo(px, py);
    }
    sctx.stroke();
    inkText(sctx, 'zoomed in', bx + 10, by2 + 19, 14);
    sctx.restore();
  }
}

function drawOrbitSet(st) {
  const sid = scene.id;
  const shortPhone = SH < 260 && matchMedia('(max-width: 760px)').matches;
  const topPad = (sid === 'compare' && shortPhone) ? 40 : 0;
  const availH = Math.max(72, SH - dockH() - 12 - topPad);
  const gPad = st.ground ? (shortPhone ? 0.85 : SW < 340 ? 0.62 : 0.82) : 1; // ground steps make room for the inset
  const cx = st.ground ? SW * 0.45 : SW / 2;
  let cy = topPad + availH / 2 + 6;
  const gr = st.ground ? groundCanvas.getBoundingClientRect() : null;
  const sr = sceneCanvas.getBoundingClientRect();
  const inset = gr ? {x0:gr.left-sr.left,y0:gr.top-sr.top,x1:gr.right-sr.left,y1:gr.bottom-sr.top} : null;
  const fitR = sid === 'orbitLow' || sid === 'spin' ? EARTH_RADIUS * 2.6 : MATCHED_RADIUS * 1.12;
  let k = (Math.min(SW, availH) * (shortPhone ? 0.5 : 0.47) * gPad) / fitR;
  if (inset) {
    // Fit the whole satellite sweep below the inset, including its glyph.
    // A current-frame-only check misses a satellite that crosses behind it.
    const orbit = orbitOf(sid);
    const amplitude = orbit.radius * k * Math.abs(Math.sin(orbit.inclination + ELEV));
    const maximum = Math.max(1, (SH - inset.y1 - 28) / 2);
    if (amplitude > maximum) k *= maximum / amplitude;
    const fitted = orbit.radius * k * Math.abs(Math.sin(orbit.inclination + ELEV));
    cy = Math.min(SH - 14 - fitted, Math.max(cy, inset.y1 + 14 + fitted));
  }
  drawEarthDisk(sctx, cx, cy, EARTH_RADIUS * k, 5, sid === 'spin' || sid === 'match', scene.t);
  const drawOne = (o, color, seed, label) => {
    sctx.strokeStyle = palette.ink; sctx.globalAlpha = 0.5; sctx.lineWidth = 1.4;
    sctx.beginPath();
    const N = 110;
    for (let i = 0; i <= N; i++) {
      const p = project(at(o, (i / N) * o.period).position, k, cx, cy);
      noteRect('orbitPath', p[0], p[1], p[0], p[1]);
      if(inset) {
        const gap=Math.max(inset.x0-(p[0]+15),(p[0]-15)-inset.x1,inset.y0-(p[1]+10),(p[1]-10)-inset.y1);
        orbitInsetClearance=Math.min(orbitInsetClearance ?? Infinity,gap);
      }
      i ? sctx.lineTo(...p) : sctx.moveTo(...p);
    }
    sctx.stroke(); sctx.globalAlpha = 1;
    const p = project(at(o, scene.t % o.period).position, k, cx, cy);
    drawSatellite(sctx, p[0], p[1], seed, 1);
    noteRect('satellite', p[0] - 15, p[1] - 10, p[0] + 15, p[1] + 10);
    noteRect('orbitPath', p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8);
    return p;
  };
  if (sid === 'compare') {
    drawOne(CASES.low, palette.coral, 100);
    drawOne(CASES.stationary, palette.coral, 200);
    const nLow = Math.floor((scene.t + 0.001) / CASES.low.period);
    const nFar = Math.floor((scene.t + 0.001) / CASES.stationary.period);
    if (shortPhone) {
      drawTime(sctx, [
        `Time: ${fmtDur(scene.t)}`,
        `Near: ${nLow} (${fmtDur(CASES.low.period)} each)  Far: ${nFar} (${fmtDur(CASES.stationary.period)} each)`,
      ]);
    } else drawTime(sctx, [
      `Time: ${fmtDur(scene.t)}`,
      `Near satellite: ${nLow} circle${nLow === 1 ? '' : 's'} (one takes ~${fmtDur(CASES.low.period)})`,
      `Far satellite: ${nFar} circle${nFar === 1 ? '' : 's'} (one takes ~${fmtDur(CASES.stationary.period)})`,
    ]);
    return;
  }
  const o = orbitOf(sid);
  const p = drawOne(o, palette.coral, 300);
  drawTime(sctx, [`Time: ${fmtDur(scene.t)}`]);
  if (sid === 'orbitLow' && scene.pull) {
    // gravity arrow from satellite toward Earth, plus honest strength note
    const dx = cx - p[0], dy = cy - p[1];
    const len = Math.hypot(dx, dy);
    const ax = p[0] + (dx / len) * Math.min(54, len * 0.4), ay = p[1] + (dy / len) * Math.min(54, len * 0.4);
    sctx.strokeStyle = palette.sky; sctx.lineWidth = 2.6;
    inkLine(sctx, p[0], p[1], ax, ay, 500, 0.8);
    const ah = Math.atan2(dy, dx);
    inkLine(sctx, ax, ay, ax - 9 * Math.cos(ah - 0.45), ay - 9 * Math.sin(ah - 0.45), 501, 0.4);
    inkLine(sctx, ax, ay, ax - 9 * Math.cos(ah + 0.45), ay - 9 * Math.sin(ah + 0.45), 502, 0.4);
    drawTime(sctx, [`Time: ${fmtDur(scene.t)}`, 'Earth’s pull up here: about 9/10 of the pull on the ground.']);
  }
}

function drawGround() {
  const rect = groundCanvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (Math.abs(rect.width * dpr - groundCanvas.width) > 2) {
    groundCanvas.width = Math.round(rect.width * dpr);
    groundCanvas.height = Math.round(rect.width * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const w = rect.width, cx = w / 2, cy = w / 2, R = w * 0.4;
  gctx.clearRect(0, 0, w, w);
  gctx.strokeStyle = palette.ink; gctx.fillStyle = palette.paper; gctx.lineWidth = 1.8;
  wash(gctx, cx, cy, R, palette.clay);
  inkCircle(gctx, cx, cy, R, 61, 1.2, true);
  // latitude rings: 30° and 60° (radius = (90-lat)/90 * R)
  gctx.save(); gctx.globalAlpha = 0.4; gctx.setLineDash([3, 5]); gctx.lineWidth = 1;
  for (const lat of [30, 60]) {
    gctx.beginPath(); gctx.arc(cx, cy, ((90 - lat) / 90) * R, 0, 7); gctx.stroke();
  }
  gctx.restore();
  // home spot fixed on the rim (we ride along with the spin)
  gctx.fillStyle = palette.sky;
  gctx.beginPath(); gctx.arc(cx + R, cy, 4.5, 0, 7); gctx.fill();
  gctx.strokeStyle = palette.ink; gctx.lineWidth = 1.2; gctx.stroke();
  inkText(gctx, 'home', Math.max(4, Math.min(cx + R - 40, w - 42)), cy - 12, 14);
  const tiny = w < 80;
  // trail + current ground point
  // trail + current ground point, older ink fading
  if (scene.trail.length > 1) {
    gctx.strokeStyle = palette.coral; gctx.lineWidth = 1.6;
    const pts = scene.trail.map((pt) => {
      const rr = ((Math.PI / 2 - pt.lat) / (Math.PI / 2)) * R;
      return [cx + Math.cos(pt.lon) * rr, cy - Math.sin(pt.lon) * rr];
    });
    [0.15, 0.35, 0.8].forEach((alpha, pi) => {
      const a0 = Math.floor((pts.length * pi) / 3), a1 = Math.max(a0 + 1, Math.floor((pts.length * (pi + 1)) / 3));
      gctx.globalAlpha = alpha;
      gctx.beginPath();
      pts.slice(a0, a1 + 1).forEach(([x, y], i) => (i ? gctx.lineTo(x, y) : gctx.moveTo(x, y)));
      gctx.stroke();
    });
    gctx.globalAlpha = 1;
  }
  const cur = scene.trail[scene.trail.length - 1];
  if (cur) {
    const rr = ((Math.PI / 2 - cur.lat) / (Math.PI / 2)) * R;
    const x = cx + Math.cos(cur.lon) * rr, y = cy - Math.sin(cur.lon) * rr;
    gctx.fillStyle = palette.coral;
    gctx.beginPath(); gctx.arc(x, y, 4, 0, 7); gctx.fill();
  }

}

/* ---------- animation: on-demand loop, no idle rendering ----------
   Continuous playback is learner-started Play only. Under OS reduced motion
   there is no smooth motion: Play advances in discrete snaps (about 4 per
   second), and the step buttons remain as the fully static equivalent.
   Sim time always advances linearly: wall dt x fixed rate, no easing. */
let lastWall = null, rafId = null, snapTimer = null;
function loopActive() {
  if (!scene || !scene.playing) return false;
  if (scene.id === 'drop') return scene.dropped && (scene.anim < 1 || scene.pulse < 1);
  if (scene.id === 'throw') return !!scene.run && (scene.choice === 'mightiest' || scene.idx < scene.run.samples.length - 1);
  return !!RATE[scene.id];
}
function tick(now) {
  rafId = null;
  if (!scene?.playing || reducedMotion || flow.phase !== 'running') return;
  if(segmentStart===null)segmentStart=now;
  const duration=scene.id==='drop'?1550:scene.id==='throw'?3600:scene.id==='orbitLow'?2400:ROTATION_PERIOD / 1800 * 1000;
  const progress=Math.min(1,(now-segmentStart)/duration);
  if(scene.id==='drop'){scene.anim=Math.min(1,progress/0.72);scene.pulse=Math.max(0,(progress-0.72)/0.28);}
  else if(scene.id==='throw')scene.idx=Math.floor(progress*(scene.run.samples.length-1));
  else {
    const target=scene.id==='orbitLow'?600:ROTATION_PERIOD;
    scene.t=target*progress;recordTrail();
  }
  draw();
  if(progress>=1)finishSegment();else rafId=requestAnimationFrame(tick);
}
function snapAdvance() {
  if (!scene || !scene.playing) return;
  if (scene.id === 'throw') {
    if (scene.run) {
      const last = scene.run.samples.length - 1;
      scene.idx = Math.min(last, scene.idx + 28);
      if (scene.idx >= last) {
        scene.thrownSet[scene.choice] = true;
        if (scene.choice === 'mightiest') scene.idx = 0;
        else stopPlayback();
      }
    }
  } else if (scene.id === 'drop') {
    scene.anim = 1; stopPlayback();
  } else if (RATE[scene.id]) {
    scene.t += STEP_SIZES[scene.id][0] * 2;
    recordTrail();
  }
  draw();
}
function startPlayback() {
  scene.playing = true;
  if (reducedMotion) { if (!snapTimer) snapTimer = setInterval(snapAdvance, 500); }
  else { lastWall = null; if (!rafId) rafId = requestAnimationFrame(tick); }
}
function stopPlayback() {
  if (scene) scene.playing = false;
  if (snapTimer) { clearInterval(snapTimer); snapTimer = null; }
}

/* seed trails while stepping so the ground panel draws immediately */
function primeTrail() {
  const st = STEPS[journey.step];
  if (!st.ground || !scene) return;
  scene.trail = [];
  recordTrail();
}

function enterScene() {
  stopPlayback();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  const st = STEPS[journey.step];
  scene = makeScene(st.scene);
  if (st.ground) { groundCanvas.hidden = false; primeTrail(); }
  buildDock();
  draw();
}

/* ---------- about dialog ---------- */
$('about-open').addEventListener('click', () => {
  const more = STEPS[journey.step].more;
  $('about-step').hidden = !more;
  if (more) $('about-step-more').textContent = more;
  $('about').showModal();
});
$('about-close').addEventListener('click', () => $('about').close());

/* ---------- test evidence ---------- */
export function journeyEvidence() {
  const z = zoneState(STEPS[journey.step]);
  return {
    orbitInsetClearance,
    phase: flow.phase, action: flow.action, choice: flow.choice, historyDepth: history.length,
    step: journey.step,
    stepId: STEPS[journey.step].id,
    playing: !!(scene && scene.playing),
    groundShown: !groundCanvas.hidden,
    dock: [...$('scene-dock').children].map((b) => b.textContent),
    answers: { ...journey.answers },
    acted: { ...journey.acted },
    zone: z.active,
    nextEnabled: z.nextEnabled,
    nextDisabled: $('next').disabled,
    nextHidden: $('next').hidden,
    nextText: $('next').textContent,
    cue: $('cue').hidden ? null : z.active,
    answersLocked: $('answers').classList.contains('locked'),
    answersAbsent: $('answers').children.length === 0,
    questionMoment: document.body.classList.contains('question-moment'),
    peekVisible: !$('peek').hidden,
    stageHidden: getComputedStyle($('model-stage')).display === 'none',
    dockLocked: $('scene-dock').classList.contains('locked'),
    transferChoice: journey.transferChoice,
    feedback: $('feedback').textContent,
    layout: { ...layoutMarks },
    inset: (() => {
      if (groundCanvas.hidden) return null;
      const a = sceneCanvas.getBoundingClientRect(), b = groundCanvas.getBoundingClientRect();
      return { x0: b.left - a.left, y0: b.top - a.top, x1: b.right - a.left, y1: b.bottom - a.top };
    })(),
    sceneT: scene ? scene.t : null,
    trail: scene ? scene.trail.length : 0,
    nextDisabled: $('next').disabled,
  };
}

/* ---------- go ---------- */
enterScene();
renderGuide();
fit();


