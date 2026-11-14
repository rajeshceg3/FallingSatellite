# Science-lane motion & visual tokens v1.0 (extracted from Falling Satellite, Nov 14 2026)
Shared across the science lane (applied to all 11 apps during the polish rollout; handed to K01/K02 via the fleet agent).

## Palette (paper-craft, unchanged)
ink #3d2f26 | paper #f7eedd | stage #f1e3cc | clay #ffdbac | coral #e8735a | sky #2c6c91
Dark theme pairs defined per-app in styles.css [data-theme="dark"].

## Easing
- --spring: cubic-bezier(0.34, 1.56, 0.64, 1)  // small joys: chip select, check pop, landing pulse
- --out:    cubic-bezier(0.23, 1, 0.32, 1)     // exits, fades, disabled transitions
- Gravity scenes ease IN (accelerating), never spring - physics honesty.

## Durations
- 120ms button press / 180ms color exits / 300-450ms one-shot pulses / 600ms check draw-on
- Ambient idle loops: NONE (motion guide). Motion is learner-started; reduced-motion gets static equivalents.

## Watercolor depth (the lane's depth trick)
Under every filled disk: 2 low-alpha offset fills of the same color (a 0.10, then a 0.055), offset (+1.5,-1.5) and (-1,+2), radius +1.5/-1. Strokes stay ink on top. Same palette, no new colors, no gradients.

## Strokes
- Earth/large disks 2.2 | bodies 1.8-2 | trails 1.6 fading to 0.15 alpha | labels 600 weight system-ui.

## Labels
Message row y~30, caption row cy+78; art never enters either; right-column labels right-aligned by measureText; layout-mark gates assert no overlaps at 320/390/desktop/landscape.

## Learning-flow gate (standing rule, user Nov 14 2026)
Every learning app, before ship, checked against the Feynman first-principles pattern:
1. Start from one simple thing (a ball, a shadow, a clock hand) - no jargon, destination never stated up front.
2. The learner causes it: each step's key event is learner-triggered, never auto-played or narrated.
3. Name the idea only AFTER they feel it: terms (gravity, orbit, friction) first appear in feedback or Read-more AFTER the action. A question hook up front is fine; the answer never precedes the doing.
Audit every step's title, copy and question text for pre-told outcomes. The destination is discovered, not announced.
