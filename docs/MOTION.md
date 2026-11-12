# Motion adoption note (motion design guide v1.0, build gate)

Animated surfaces and purpose:

1. Drop fall (step 1) - essential teaching (falling). Learner-started (Drop
   button). Reduced motion: instant landed state.
2. Throw reveal (steps 2-3) - essential teaching (sideways + falling). Play
   reveals the integrated path linearly (55 samples/s, no easing). Reduced
   motion: full path drawn immediately; Play replays in discrete snaps.
3. Orbit playback (steps 4-8, transfer) - essential teaching. Learner-started
   Play/Pause; sim time advances linearly at a fixed rate per scene; +step
   buttons give the static equivalent. Reduced motion: Play advances discrete
   snaps (~2/s); step buttons unchanged.
4. Answer feedback color - decorative feedback, color only, no motion.
5. No camera movement, no inertia, no idle render loop: frames render only
   while a learner-started playback is active.

Gate state: shared deterministic state (scene.t drives space view, ground
panel, counters and readouts); manual navigation interrupts playback (entering
a scene stops it); Back/Reset/begin-again verified; OS reduced motion honored
at load and on live change; keyboard/tap only (no drag gestures); evidence in
tests/browser.cjs and docs/frames. Desktop mouse and 390px Chromium tested;
no physical-phone or child-learning validation claimed.

## Gate additions (Nov 12, user rules via main)
- Calm main view: scene + one-line idea + Next/Back only. No "read more" or "scroll for more" cues in the main path; extra explanation lives behind the quiet info icon (About > About this step).
- One active zone at a time: picture first, then question, then Next. The active zone gets one hand-drawn cue arrow that disappears once acted on; the other zone is dimmed/locked with a short plain label; Next stays disabled, saying why in a few words, until the step's action is done; after the answer, feedback shows what changed. Gate: browser checks assert exactly one active zone and locked states at 390px (see tests/browser.cjs "gate:" checks).
