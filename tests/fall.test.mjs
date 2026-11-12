import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MU, EARTH_RADIUS as R } from '../orbit.js';
import { makeThrow, step, march, outcome, energy, circularSpeed, escapeSpeed, STEP } from '../fall.js';

const near = (a, b, t, msg) => assert(Math.abs(a - b) <= t, `${msg}: ${a} vs ${b}`);

test('velocity Verlet keeps energy steady over two surface-skimming orbits', () => {
  const r0 = R + 10000;
  let s = makeThrow(circularSpeed(r0));
  const e0 = energy(s);
  const period = 2 * Math.PI * Math.sqrt(r0 ** 3 / MU);
  const n = Math.ceil((2 * period) / STEP);
  for (let i = 0; i < n; i++) s = step(s);
  near(energy(s), e0, Math.abs(e0) * 1e-6, 'energy drift');
  near(Math.hypot(...s.position), r0, r0 * 2e-4, 'radius after two orbits');
});

test('circular-speed throw stays bound and never lands during one orbit', () => {
  const r0 = R + 10000;
  let s = makeThrow(circularSpeed(r0));
  const period = 2 * Math.PI * Math.sqrt(r0 ** 3 / MU);
  let minR = Infinity, maxR = 0;
  for (let t = 0; t < period; t += STEP) {
    s = step(s);
    const r = Math.hypot(...s.position);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    assert.equal(outcome(s), 'flying');
  }
  near(minR, r0, r0 * 2e-4, 'min radius');
  near(maxR, r0, r0 * 2e-4, 'max radius');
});

test('gentle throw lands, and a stronger throw lands farther around the curve', () => {
  const gentle = march(1500, { maxSeconds: 3000 });
  const strong = march(4500, { maxSeconds: 10000 });
  assert.equal(gentle.end, 'landed');
  assert.equal(strong.end, 'landed');
  const angle = (p) => Math.atan2(p[0], p[1]); // angle around the curve from the launch point
  const dg = angle(gentle.final.position), ds = angle(strong.final.position);
  assert(dg > 0 && ds > dg, `stronger throw should land farther: ${dg} vs ${ds}`);
  near(Math.hypot(...gentle.final.position), R, 1, 'gentle lands on the surface');
  near(Math.hypot(...strong.final.position), R, 1, 'strong lands on the surface');
});

test('escape-speed throw is flagged escaped and keeps receding', () => {
  const r0 = R + 10000;
  const run = march(escapeSpeed(r0) * 1.05, { maxSeconds: 20000 });
  assert.equal(run.end, 'escaped');
  assert(energy(run.final) > 0, 'unbound energy');
  const rs = run.samples.map((s) => Math.hypot(...s.position));
  assert(rs[rs.length - 1] > rs[0], 'receding');
});

test('no step tunnels below the surface without a landed outcome', () => {
  for (const v of [800, 2000, 3500, 5000, 6000, 7000]) {
    const run = march(v, { maxSeconds: 30000 });
    if (run.end === 'landed') {
      for (const s of run.samples) assert(Math.hypot(...s.position) >= R - 1, `v=${v} tunneled`);
    }
  }
});

test('invalid throws are refused', () => {
  for (const v of [0, -5, NaN, Infinity]) assert.throws(() => makeThrow(v));
  assert.throws(() => circularSpeed(R));
});
