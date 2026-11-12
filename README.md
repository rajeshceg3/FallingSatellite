# The Falling Satellite

A hand-inked, self-paced journey about orbits for ages 7 to 10: why a satellite
is always falling, how it keeps missing the ground, and the special one-day
orbit that keeps up with Earth's spin (geosynchronous, and the geostationary
special case).

Generic, public, faceless: no names, no profiles, no analytics, no location.

## Run

Static files, no build step. Serve the folder and open `index.html`:

```
python3 -m http.server 8796
```

## Verify

```
npm install
npm test            # syntax + model and journey tests (node --test)
npm run test:browser  # real-Chromium walk-through, frames in docs/frames/local
```

## Models (honest scope)

- `fall.js`: velocity-Verlet integration of two-body inverse-square gravity for
  the thrown-ball bridge. SI units. Landing/escape are detected, never faked.
- `orbit.js`: exact circular two-body cases (low, equatorial period-matched,
  tilted period-matched). Constants from IERS conventions chapter 1
  (GM = 3.986004415e14, equatorial radius 6378136.6 m, nominal spin rate
  7.292115e-5 rad/s). No atmosphere, oblateness, Moon/Sun or station-keeping.
- Drawings are not to scale; speeds and times are real. One "day" here is one
  Earth rotation (~23 h 56 min), not a clock day.

## Sources

- https://kids.esa.int/different_orbits/
- https://www.esa.int/Science_Exploration/Space_Science/Spacecraft_orbits
- https://science.nasa.gov/learn/basics-of-space-flight/chapter5-1/
- https://iers-conventions.obspm.fr/content/chapter1/icc1.pdf
