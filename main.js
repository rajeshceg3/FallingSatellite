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
if (localStorage.getItem('fs-theme')) document.documentElement.dataset.theme = localStorage.getItem('fs-theme');
else if (dark.matches) document.documentElement.dataset.theme = 'dark';
readPalette();
$('theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('fs-theme', next);
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
function positionCue(zone) {
  const cue = $('cue');
  if (!zone || zone.active === 'done' || zone.active === 'none') { cue.hidden = true; return; }
  const target = $(zone.active === 'scene' ? 'scene-dock' : 'answers');
  const host = $('workshop');
  const tr = target.getBoundingClientRect(), hr = host.getBoundingClientRect();
  cue.hidden = false;
  cue.style.left = `${tr.left - hr.left + tr.width / 2 - 23}px`;
  cue.style.top = `${tr.top - hr.top - 62}px`;
}

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
    copy: 'A satellite is always falling toward Earth. It stays up by missing the ground. Let’s see how.',
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
    copy: 'Earth is round, so the ground curves away. Throw about 8 kilometres a second and the ball falls all the way around. Try Mightiest.',
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
    copy: 'Far enough out, one circle takes exactly one day. High above the equator, going Earth’s way, it hangs over one spot.',
    more: 'That is a geostationary orbit, a special geosynchronous one. Geosynchronous means its period matches Earth’s spin. Geostationary is the special case: circular, above the equator, going the way Earth turns — so it stays parked over one spot. That is why TV dish antennas can point at one place in the sky.',
    question: 'match', scene: 'match', ground: true },
  { id: 'tilt', title: 'Same day, different path',
    copy: 'Tilt that one-day orbit. It still circles once a day, but drifts north and south. Same day, not the same place.',
    more: 'The loop the ground point draws over one day is what ground trackers really see from a tilted one-day satellite. A tilted one-day orbit is geosynchronous, but not geostationary.',
    scene: 'tilt', ground: true },
  { id: 'transfer', title: 'One last puzzle', scene: 'transfer', ground: true, transfer: true },
];

/* ---------- one active zone at a time ----------
   Picture first, then the question, then Next. Exactly one zone is active:
   it gets the single hand-drawn cue arrow; the other is dimmed and locked
   with a short plain label. Next stays disabled, saying why in a few words,
   until the step's action is done. */
function stepNeeds(st) {
  if (st.id === 'cover') return null;
  const action = st.scene === 'drop' ? 'drop' : st.scene === 'throw' ? 'throw' : st.scene === 'orbitLow' ? 'pull' : 'time';
  return { action, question: st.transfer ? 'transfer' : st.question || null };
}
const WHY_ACT = {
  drop: 'Drop the ball first',
  throw: 'Try the throws first',
  pull: 'Show Earth’s pull first',
  time: 'Play or step the picture first',
};
function questionDone(st) {
  const n = stepNeeds(st);
  if (!n || !n.question) return true;
  return n.question === 'transfer' ? journey.transferChoice !== null : journey.answers[st.question] !== undefined;
}
function zoneState(st) {
  const n = stepNeeds(st);
  if (!n) return { active: 'none', nextEnabled: true };
  if (!journey.acted[st.id]) return { active: 'scene', nextEnabled: false, why: WHY_ACT[n.action] };
  if (!questionDone(st)) return { active: 'question', nextEnabled: false, why: 'Answer the question first' };
  return { active: 'done', nextEnabled: true };
}
function markActed() {
  const st = STEPS[journey.step];
  const n = stepNeeds(st);
  if (!n || journey.acted[st.id] || !scene) return;
  let ok = false;
  if (n.action === 'drop') ok = scene.dropped && scene.anim >= 1;
  else if (n.action === 'throw') ok = (st.need || st.throws).every((k) => scene.thrownSet && scene.thrownSet[k]);
  else if (n.action === 'pull') ok = !!scene.pull;
  else ok = scene.t > 0;
  if (ok) {
    journey = reduceJourney(journey, { type: 'acted', step: st.id });
    renderGuide();
  }
}

/* ---------- scene state ---------- */
let journey = createJourney();
let scene = null;
function makeScene(id) {
  const base = { id, playing: false, t: 0, trail: [], pull: false };
  if (id === 'drop') return { ...base, dropped: false, anim: 0 };
  if (id === 'throw') return { ...base, run: null, idx: 0, choice: null, done: '', thrownSet: {} };
  return base;
}
const ORBIT_FOR = { orbitLow: CASES.low, compare: null, spin: CASES.low, match: CASES.stationary, tilt: CASES.tiltedMatched, transfer: circular(MATCHED_RADIUS, Math.PI / 12) };

/* compression: sim seconds per wall second while playing */
const RATE = { orbitLow: 260, compare: 1800, spin: 1800, match: 1800, tilt: 1800, transfer: 1800 };
const STEP_SIZES = { orbitLow: [60, 600], compare: [900, 3600], spin: [900, 3600], match: [900, 3600], tilt: [900, 3600], transfer: [900, 3600] };

/* ---------- journey rendering ---------- */
const answerEls = [];
function renderGuide() {
  const st = STEPS[journey.step];
  const zone = zoneState(st);
  $('step-title').textContent = st.title;
  const isTransfer = !!st.transfer;
  $('step-copy').textContent = isTransfer
    ? 'Here is a new tilt you have not watched before. Look, then answer.'
    : st.copy;
  // answers
  const box = $('answers');
  box.innerHTML = '';
  answerEls.length = 0;
  const q = isTransfer ? transfer : st.question ? questions[st.question] : null;
  box.classList.toggle('locked', zone.active === 'scene');
  if (q) {
    if (zone.active === 'scene') {
      const lab = document.createElement('p');
      lab.className = 'zone-label';
      lab.textContent = 'First: try the picture ↑';
      box.appendChild(lab);
    }
    q.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = c;
      if (zone.active === 'scene') b.disabled = true;
      const chosen = isTransfer ? journey.transferChoice : journey.answers[st.question];
      if (chosen === i) b.setAttribute('aria-pressed', 'true');
      if ((isTransfer ? journey.transferFeedback : journey.feedbackFor === st.question) && i === q.answer) b.classList.add('correct');
      b.addEventListener('click', () => {
        journey = reduceJourney(journey, isTransfer ? { type: 'answerTransfer', choice: i } : { type: 'answer', question: st.question, choice: i });
        renderGuide();
      });
      box.appendChild(b);
      answerEls.push(b);
    });
  }
  // feedback
  let fb = '';
  if (isTransfer && journey.transferFeedback) fb = transfer.why[journey.transferChoice];
  else if (st.question && journey.feedbackFor === st.question) fb = questions[st.question].why[journey.answers[st.question]];
  if (isTransfer && journey.transferFeedback && !journey.taughtBack) {
    const tb = document.createElement('button');
    tb.id = 'teachback';
    tb.className = 'icon-text';
    tb.textContent = 'Say it in your own words';
    tb.style.marginTop = '16px';
    tb.addEventListener('click', () => { journey = reduceJourney(journey, { type: 'teachback' }); renderGuide(); });
    box.appendChild(tb);
  }
  if (isTransfer && journey.taughtBack) fb += `\n\n${teachback.prompt} ${teachback.reveal}`;
  $('feedback').textContent = fb;
  // progress
  const prog = $('progress');
  prog.innerHTML = '';
  for (let i = 0; i < STEP_COUNT; i++) {
    const d = document.createElement('i');
    if (i === journey.step) d.className = 'active';
    prog.appendChild(d);
  }
  // next/back
  $('back').disabled = journey.step === 0;
  const next = $('next');
  next.disabled = !zone.nextEnabled;
  if (!zone.nextEnabled) next.textContent = zone.why;
  else if (journey.step === 0) next.innerHTML = 'Start learning <span aria-hidden="true">→</span>';
  else if (journey.step === STEP_COUNT - 1) next.innerHTML = 'Begin again <span aria-hidden="true">↺</span>';
  else next.innerHTML = 'Next <span aria-hidden="true">→</span>';
  if (fb) $('feedback').scrollIntoView({ block: 'nearest' });
  $('step-title').focus({ preventScroll: true });
  buildDock();
  positionCue(zone);
}

function go(type) {
  journey = reduceJourney(journey, { type });
  enterScene();
  renderGuide();
}
$('next').addEventListener('click', () => {
  if (journey.step === STEP_COUNT - 1) { journey = reduceJourney(journey, { type: 'reset' }); enterScene(); renderGuide(); }
  else go(journey.step === 0 ? 'start' : 'next');
});
$('back').addEventListener('click', () => go('back'));
$('reset').addEventListener('click', () => { journey = reduceJourney(journey, { type: 'reset' }); enterScene(); renderGuide(); });

/* ---------- scene dock ---------- */
function dockButton(label, action, opts = {}) {
  const b = document.createElement('button');
  b.textContent = label;
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  if (opts.aria) b.setAttribute('aria-label', opts.aria);
  b.addEventListener('click', () => { action(); draw(); });
  return b;
}
function finishDock(dock) {
  const zone = zoneState(STEPS[journey.step]);
  dock.classList.toggle('locked', zone.active === 'question');
  if (zone.active === 'question') {
    for (const b of dock.querySelectorAll('button')) b.disabled = true;
    const lab = document.createElement('div');
    lab.className = 'dock-label';
    lab.textContent = 'Answer below to go on ↓';
    dock.appendChild(lab);
  }
}
function buildDock() {
  const dock = $('scene-dock');
  dock.innerHTML = '';
  const st = STEPS[journey.step];
  if (!scene) return;
  if (scene.id === 'drop') {
    dock.appendChild(dockButton(scene.dropped ? 'Drop again' : 'Drop the ball', () => {
      scene.dropped = true; scene.anim = reducedMotion ? 1 : 0.0001;
      if (!reducedMotion) { scene.playing = true; lastWall = null; if (!rafId) rafId = requestAnimationFrame(tick); }
    }));
    finishDock(dock);
    return;
  }
  if (scene.id === 'throw') {
    for (const key of st.throws) {
      dock.appendChild(dockButton(THROWS[key].label, () => launchThrow(key), { pressed: scene.choice === key, aria: `${THROWS[key].label} throw` }));
    }
    finishDock(dock);
    return;
  }
  const sid = scene.id;
  if (!RATE[sid]) return;
  dock.appendChild(dockButton(scene.playing ? 'Pause' : 'Play', () => {
    if (scene.playing) stopPlayback(); else startPlayback();
    buildDock();
  }, { aria: scene.playing ? 'Pause the motion' : 'Play the motion' }));
  const [s1, s2] = STEP_SIZES[sid];
  dock.appendChild(dockButton(`+${s1 >= 3600 ? '1 h' : s1 >= 900 ? '15 min' : s1 >= 600 ? '10 min' : '1 min'}`, () => advance(s1)));
  dock.appendChild(dockButton(`+${s2 >= 3600 ? '1 h' : '10 min'}`, () => advance(s2)));
  if (sid === 'orbitLow') {
    dock.appendChild(dockButton('Show Earth’s pull', () => { scene.pull = !scene.pull; buildDock(); }, { pressed: scene.pull }));
  }
  dock.appendChild(dockButton('↺ Start over', () => { const keep = scene.pull; scene = makeScene(scene.id); scene.pull = keep; buildDock(); }, { aria: 'Reset this scene' }));
  finishDock(dock);
}
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
function inkText(ctx, str, x, y, size = 14, color) {
  ctx.save();
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color || palette.ink;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/* layout marks: bounding boxes of drawn text/art, for the no-overlap gate */
const layoutMarks = {};
function markReset() { for (const key in layoutMarks) delete layoutMarks[key]; }
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
  ctx.save();
  ctx.globalAlpha = 0.92;
  lines.forEach((s, i) => { inkText(ctx, s, 16, 26 + i * 20, 14); noteText('timeLines', s, 16, 26 + i * 20, 14); });
  ctx.restore();
}

/* ---------- drawing: scenes ---------- */
function draw() {
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
  const holdY = gy - SH * 0.42;
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
  sctx.fillStyle = palette.coral; sctx.strokeStyle = palette.ink; sctx.lineWidth = 2;
  sctx.beginPath(); sctx.arc(cx, by, 11, 0, 7); sctx.fill(); sctx.stroke();
  if (scene.dropped && scene.anim >= 1) {
    // landed thud marks
    inkLine(sctx, cx - 20, gy - 2, cx - 30, gy - 12, 21, 0.6);
    inkLine(sctx, cx + 20, gy - 2, cx + 30, gy - 12, 22, 0.6);
    inkText(sctx, 'Down it comes. Everything falls.', cx - SW * 0.3, gy + 34, 15);
  } else if (!scene.dropped) {
    inkText(sctx, 'Held high. Let go…', cx - SW * 0.3, gy + 34, 15);
  }
}

function drawThrow() {
  const availH = SH - 120; // leave the dock its own space
  const cx = SW / 2, cy = availH / 2 + 8;
  const k = (Math.min(SW, availH) * 0.48) / (EARTH_RADIUS * 1.06);
  const re = EARTH_RADIUS * k;
  drawEarthDisk(sctx, cx, cy, re, 3, false, 0);
  // pretend mountain at the top
  const mx = cx, my = cy - re - (LAUNCH_ALT * k);
  sctx.strokeStyle = palette.ink; sctx.lineWidth = 2;
  inkLine(sctx, mx - 10, cy - re + 3, mx, my, 31, 0.8);
  inkLine(sctx, mx, my, mx + 10, cy - re + 3, 32, 0.8);
  sctx.save(); sctx.font = '600 12px system-ui, sans-serif';
  const mLabel = 'a pretend 400 km mountain, above the air';
  const mw = sctx.measureText(mLabel).width;
  sctx.restore();
  sctx.save(); sctx.font = '600 12px system-ui, sans-serif'; sctx.textAlign = 'center'; sctx.fillStyle = palette.ink;
  const lx = Math.min(Math.max(mx, mw / 2 + 8), SW - mw / 2 - 8), ly = Math.max(my - 8, 16);
  sctx.fillText(mLabel, lx, ly);
  sctx.restore();
  noteText('mountainLabel', mLabel, lx, ly, 12, 'center');
  inkText(sctx, 'not to scale', 16, availH + 8, 12);
  noteText('caption', 'not to scale', 16, availH + 8, 12);
  const run = scene.run;
  if (!run) {
    inkText(sctx, 'Pick a throw strength.', 16, availH + 28, 14);
    noteText('status', 'Pick a throw strength.', 16, availH + 28, 14);
    return;
  }
  // reveal path up to idx
  const upto = Math.min(scene.idx, run.samples.length - 1);
  sctx.strokeStyle = palette.ink; sctx.lineWidth = 2; sctx.globalAlpha = 0.85;
  sctx.beginPath();
  for (let i = 0; i <= upto; i++) {
    const s = run.samples[i];
    const x = cx + s.position[0] * k, y = cy - s.position[1] * k;
    i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
  }
  sctx.stroke(); sctx.globalAlpha = 1;
  const cur = run.samples[upto];
  const bx = cx + cur.position[0] * k, by = cy - cur.position[1] * k;
  sctx.fillStyle = palette.coral; sctx.strokeStyle = palette.ink; sctx.lineWidth = 1.8;
  sctx.beginPath(); sctx.arc(bx, by, 7, 0, 7); sctx.fill(); sctx.stroke();
  // zoom bubble: the same real throw, magnified, when the arc is tiny at world scale
  const span = run.samples.reduce((m, s) => Math.max(m, Math.abs(Math.atan2(s.position[0], s.position[1]))), 0);
  if (span < 0.3) {
    const bw = Math.min(SW * 0.52, 240), bh = bw * 0.62;
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
    inkText(sctx, 'zoomed in, same throw', bx + 10, by2 + 15, 11);
    sctx.restore();
  }
  const finished = upto >= run.samples.length - 1;
  let msg;
  if (!finished) msg = `${(THROWS[scene.choice].speed / 1000).toFixed(1)} km every second…  ${fmtDur(cur.time)}`;
  else if (run.end === 'landed') {
    const ang = Math.atan2(run.final.position[0], run.final.position[1]);
    msg = `Landed about ${fmtKm(EARTH_RADIUS * Math.abs(ang))} away, after ${fmtDur(run.final.time)}.`;
    inkLine(sctx, bx - 14, by - 2, bx - 22, by - 12, 41, 0.6);
    inkLine(sctx, bx + 14, by - 2, bx + 22, by - 12, 42, 0.6);
  } else msg = 'It came all the way around — still falling, still missing the ground.';
  inkText(sctx, msg, 16, availH + 28, 14);
  noteText('status', msg, 16, availH + 28, 14);
}

function drawOrbitSet(st) {
  const sid = scene.id;
  const availH = SH - 92;
  const gPad = st.ground ? 0.82 : 1; // ground steps make room for the inset
  const cx = st.ground ? SW * 0.47 : SW / 2, cy = availH / 2 + 6;
  const fitR = sid === 'orbitLow' || sid === 'spin' ? EARTH_RADIUS * 2.6 : MATCHED_RADIUS * 1.12;
  const k = (Math.min(SW, availH) * 0.47 * gPad) / fitR;
  drawEarthDisk(sctx, cx, cy, EARTH_RADIUS * k, 5, sid === 'spin' || sid === 'match', scene.t);
  const drawOne = (o, color, seed, label) => {
    sctx.strokeStyle = palette.ink; sctx.globalAlpha = 0.5; sctx.lineWidth = 1.4;
    sctx.beginPath();
    const N = 110;
    for (let i = 0; i <= N; i++) {
      const p = project(at(o, (i / N) * o.period).position, k, cx, cy);
      noteRect('orbitPath', p[0], p[1], p[0], p[1]);
      i ? sctx.lineTo(...p) : sctx.moveTo(...p);
    }
    sctx.stroke(); sctx.globalAlpha = 1;
    const p = project(at(o, scene.t % o.period).position, k, cx, cy);
    drawSatellite(sctx, p[0], p[1], seed, 1);
    noteRect('orbitPath', p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8);
    return p;
  };
  if (sid === 'compare') {
    drawOne(CASES.low, palette.coral, 100);
    drawOne(CASES.stationary, palette.coral, 200);
    const nLow = Math.floor(scene.t / CASES.low.period);
    const nFar = Math.floor(scene.t / CASES.stationary.period);
    drawTime(sctx, [
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
  inkText(gctx, 'home', cx + R - 34, cy + 5, 11);
  // trail + current ground point
  if (scene.trail.length > 1) {
    gctx.strokeStyle = palette.coral; gctx.lineWidth = 1.6; gctx.globalAlpha = 0.8;
    gctx.beginPath();
    scene.trail.forEach((pt, i) => {
      const rr = ((Math.PI / 2 - pt.lat) / (Math.PI / 2)) * R;
      const x = cx + Math.cos(pt.lon) * rr, y = cy - Math.sin(pt.lon) * rr;
      i ? gctx.lineTo(x, y) : gctx.moveTo(x, y);
    });
    gctx.stroke(); gctx.globalAlpha = 1;
  }
  const cur = scene.trail[scene.trail.length - 1];
  if (cur) {
    const rr = ((Math.PI / 2 - cur.lat) / (Math.PI / 2)) * R;
    const x = cx + Math.cos(cur.lon) * rr, y = cy - Math.sin(cur.lon) * rr;
    gctx.fillStyle = palette.coral;
    gctx.beginPath(); gctx.arc(x, y, 4, 0, 7); gctx.fill();
  }
  if (scene.trail.length <= 1 && scene.t === 0) {
    gctx.save(); gctx.globalAlpha = 0.75;
    inkText(gctx, 'press Play', cx - 30, cy - 4, 11);
    inkText(gctx, 'to watch a day pass', cx - 52, cy + 12, 11);
    gctx.restore();
  } else if (scene.trail.length > 1) {
    const lats = scene.trail.map((p) => p.lat), lons = scene.trail.map((p) => p.lon);
    const spread = Math.max(...lats) - Math.min(...lats) + Math.max(...lons) - Math.min(...lons);
    if (spread < 0.002 && scene.t > 3600) {
      gctx.save(); gctx.globalAlpha = 0.85;
      inkText(gctx, 'still over home', cx - 46, cy + R * 0.55, 11.5, palette.coral);
      gctx.restore();
    }
  }
  inkText(gctx, 'riding with Earth', 10, w - 12, 11);
}

/* ---------- animation: on-demand loop, no idle rendering ----------
   Continuous playback is learner-started Play only. Under OS reduced motion
   there is no smooth motion: Play advances in discrete snaps (about 4 per
   second), and the step buttons remain as the fully static equivalent.
   Sim time always advances linearly: wall dt x fixed rate, no easing. */
let lastWall = null, rafId = null, snapTimer = null;
function loopActive() {
  if (!scene || !scene.playing) return false;
  if (scene.id === 'drop') return scene.dropped && scene.anim < 1;
  if (scene.id === 'throw') return !!scene.run && (scene.choice === 'mightiest' || scene.idx < scene.run.samples.length - 1);
  return !!RATE[scene.id];
}
function tick(now) {
  rafId = null;
  if (!scene || !scene.playing || reducedMotion) return;
  if (lastWall === null) lastWall = now;
  const dt = Math.min(0.1, (now - lastWall) / 1000);
  lastWall = now;
  if (scene.id === 'drop') {
    if (scene.dropped && scene.anim < 1) scene.anim = Math.min(1, scene.anim + dt / 1.1);
  } else if (scene.id === 'throw') {
    if (scene.run) {
      const last = scene.run.samples.length - 1;
      scene.idx = Math.min(last, scene.idx + Math.max(1, Math.round(dt * 55)));
      if (scene.idx >= last) {
        scene.thrownSet[scene.choice] = true;
        if (scene.choice === 'mightiest') scene.idx = 0; // keep orbiting
      }
    }
  } else if (RATE[scene.id]) {
    const before = scene.t;
    scene.t += RATE[scene.id] * dt;
    if (Math.floor(scene.t / 60) !== Math.floor(before / 60)) recordTrail();
  }
  draw();
  if (loopActive()) rafId = requestAnimationFrame(tick);
  else { scene.playing = false; buildDock(); }
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
    nextText: $('next').textContent,
    cue: $('cue').hidden ? null : z.active,
    answersLocked: $('answers').classList.contains('locked'),
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
