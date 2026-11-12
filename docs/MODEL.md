# W01 source and model preparation, November 12 2026

No UI or deployment. This model is not yet a build-ready lesson.

## Units and method

All positions/radii: metres. Time: seconds. Angles: radians. Velocities: m/s.
Circular two-body analytic positions and velocities, not a numerical integrator.
No time-step accumulation and no energy-growth claim. The manual UI will ask
for an explicit time sample; tests sample every 60 seconds over ten nominal
Earth rotations. A spherical Earth is used with the equatorial radius as its
boundary. No atmosphere, oblateness, Moon/Sun, station-keeping or precession.

Fixed prequalified cases: circular low orbit, circular equatorial prograde
period-matched orbit, and circular tilted period-matched orbit. Same period
means matching angular rate, not equal linear speed. Rotating-frame positions
come from the same orbit state, not an independently animated ground trace.

Constants directly checked in IERS chapter1: GM=3.986004415e14 m^3/s^2
(TT-compatible), radius6378136.6m, nominal Earth angular rate7.292115e-5rad/s.
Rotation period is computed, not forced to a 24-hour solar day. This is a nominal
educational model, not a precise ephemeris or exact live Earth rotation model.

Energy status distinguishes present collision, bound and unbound states.
It is NOT a general trajectory propagator and a bound state is not a promise
it will avoid future collision. Collision/escape need honest visual treatments
before teaching acceptance; they are not simulated by these circular cases.

## Sources read directly

- https://kids.esa.int/different_orbits/
  Mission orbit choices; approximate entry-level geostationary explanation.
- https://www.esa.int/Science_Exploration/Space_Science/Spacecraft_orbits
  Circular equatorial stationary case versus sky motion. Its phrase same speed
  is too loose: lesson will say angular period, not equal linear speed.
- https://science.nasa.gov/learn/basics-of-space-flight/chapter5-1/
  Period about23h56m4s, circular equatorial special case, inclination/prograde.
- https://iers-conventions.obspm.fr/content/chapter1/icc1.pdf
  Numerical standards and TT/TCG convention distinction. Uses older published
  standards as explicit fixed approximations, not a claim of latest measurement.

## Remaining

A gravity/fall/sideways/curved-ground bridge before orbit vocabulary; manual
space view and ground-position trace; tilted-case fresh transfer; full UI,
reset/camera/input, all-view pixels and final source/privacy/deployment QA.
No personalized child data, analytics or location access. Generic faceless free
Cloudflare only under approved route. No source repo or hosting created yet.
