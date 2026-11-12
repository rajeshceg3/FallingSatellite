// Falling-bridge model: two-body inverse-square gravity in the equatorial plane.
// SI units throughout: metres, seconds, m/s. Same constants as orbit.js.
// Velocity-Verlet (kick-drift-kick) with a fixed step: symplectic, so energy
// oscillates instead of growing. This is NOT a general ephemeris: it exists to
// show "falling while moving sideways" honestly for a few throws and orbits.
import { MU, EARTH_RADIUS } from './orbit.js';

export const STEP = 0.25; // seconds of sim time per internal step

const accel = ([x, y]) => {
  const r = Math.hypot(x, y);
  if (!(r > 0)) throw new RangeError('Centre acceleration is not defined.');
  const k = -MU / r ** 3;
  return [k * x, k * y];
};

export function energy(state) {
  const v2 = state.velocity[0] ** 2 + state.velocity[1] ** 2;
  return v2 / 2 - MU / Math.hypot(...state.position);
}

// A throw starts due "north" of the centre, aimed sideways (east), from a
// pretend mountain top. speed is the honest tangential launch speed in m/s.
export function makeThrow(speed, altitude = 10000) {
  if (!Number.isFinite(speed) || speed <= 0) throw new RangeError('Throw speed must be a positive number.');
  if (!Number.isFinite(altitude) || altitude <= 0) throw new RangeError('Altitude must be above the surface.');
  const r = EARTH_RADIUS + altitude;
  return { position: [0, r], velocity: [speed, 0], time: 0 };
}

export function outcome(state) {
  const r = Math.hypot(...state.position);
  if (r <= EARTH_RADIUS) return 'landed';
  return energy(state) >= 0 ? 'escaped' : 'flying';
}

// One internal STEP of velocity Verlet. Caller decides when to stop.
export function step(state) {
  const dt = STEP;
  const a0 = accel(state.position);
  const px = state.position[0] + state.velocity[0] * dt + 0.5 * a0[0] * dt * dt;
  const py = state.position[1] + state.velocity[1] * dt + 0.5 * a0[1] * dt * dt;
  const a1 = accel([px, py]);
  return {
    position: [px, py],
    velocity: [
      state.velocity[0] + 0.5 * (a0[0] + a1[0]) * dt,
      state.velocity[1] + 0.5 * (a0[1] + a1[1]) * dt,
    ],
    time: state.time + dt,
  };
}

// March a throw until it lands, escapes, or maxSeconds pass. Returns sampled
// states (every sampleEvery internal steps) plus the final state. The final
// state is the first one at or past its outcome boundary; landing positions
// are refined linearly between the last two samples so the drawn arc ends on
// the ground, not under it.
export function march(speed, { altitude = 10000, maxSeconds = 200000, sampleEvery = 40 } = {}) {
  let s = makeThrow(speed, altitude);
  const samples = [{ ...s }];
  while (s.time < maxSeconds) {
    const prev = s;
    s = step(s);
    const end = outcome(s);
    if (end === 'landed') {
      // Refine the surface crossing between prev and s.
      const r0 = Math.hypot(...prev.position), r1 = Math.hypot(...s.position);
      const t = (r0 - EARTH_RADIUS) / (r0 - r1);
      samples.push({
        position: [prev.position[0] + (s.position[0] - prev.position[0]) * t,
                   prev.position[1] + (s.position[1] - prev.position[1]) * t],
        velocity: s.velocity,
        time: prev.time + (s.time - prev.time) * t,
      });
      return { samples, final: samples[samples.length - 1], end };
    }
    if (samples.length === 0 || (samples.length * sampleEvery * STEP) <= s.time) samples.push({ ...s });
    if (end === 'escaped' && Math.hypot(...s.position) > EARTH_RADIUS * 3) return { samples, final: s, end };
  }
  return { samples, final: s, end: outcome(s) };
}

// Circular speed at a radius: the speed at which "falling" never meets the ground.
export const circularSpeed = (r) => {
  if (!Number.isFinite(r) || r <= EARTH_RADIUS) throw new RangeError('Outside the planet only.');
  return Math.sqrt(MU / r);
};
export const escapeSpeed = (r) => Math.SQRT2 * circularSpeed(r);
