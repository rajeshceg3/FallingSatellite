// Spherical two-body circular model. SI units: metres, seconds, radians.
// IERS chapter 1: TT-compatible GM, equatorial radius used as spherical boundary.
export const MU=3.986004415e14,EARTH_RADIUS=6378136.6,EARTH_OMEGA=7.292115e-5;
export const ROTATION_PERIOD=2*Math.PI/EARTH_OMEGA;
export const periodAt=r=>{if(!Number.isFinite(r)||r<=EARTH_RADIUS)throw new RangeError('Circular case must be outside the spherical Earth.');return 2*Math.PI*Math.sqrt(r**3/MU);};
export const MATCHED_RADIUS=Math.cbrt(MU/EARTH_OMEGA**2);
export function circular(radius,inclination=0,phase=0){periodAt(radius);if(![inclination,phase].every(Number.isFinite))throw new RangeError('Angles must be finite radians.');return Object.freeze({radius,inclination,phase,omega:Math.sqrt(MU/radius**3),period:periodAt(radius)});}
export const CASES=Object.freeze({low:circular(EARTH_RADIUS+400000),stationary:circular(MATCHED_RADIUS),tiltedMatched:circular(MATCHED_RADIUS,Math.PI/6)});
export function at(orbit,seconds){if(!Number.isFinite(seconds))throw new RangeError('Time must be finite seconds.');const q=orbit.phase+seconds*orbit.omega,c=Math.cos(q),s=Math.sin(q),ci=Math.cos(orbit.inclination),si=Math.sin(orbit.inclination),r=orbit.radius,w=orbit.omega;return {position:[r*c,r*s*ci,r*s*si],velocity:[-r*w*s,r*w*c*ci,r*w*c*si]};}
export function groundPosition(orbit,seconds){const{position:[x,y,z]}=at(orbit,seconds),a=seconds*EARTH_OMEGA,c=Math.cos(a),s=Math.sin(a);return [c*x+s*y,-s*x+c*y,z];}
export function acceleration(position){const r=Math.hypot(...position);if(!(r>0))throw new RangeError('Centre acceleration is not defined.');return position.map(x=>-MU*x/r**3);}
export function specificEnergy({position,velocity}){return velocity.reduce((s,x)=>s+x*x,0)/2-MU/Math.hypot(...position);}
export function status(state){const r=Math.hypot(...state.position);if(r<=EARTH_RADIUS)return 'collision';return specificEnergy(state)>=0?'unbound':'bound';}
