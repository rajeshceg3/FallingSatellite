# One stable action, one current task

Falling Satellite pilot. This is a controller change, not a replacement for meaningful learner input.

## Contract

- A single persistent primary button owns forward progression in the same bottom slot.
- Action labels name what happens next, rather than explaining a lock.
- Scenes never advance to a question automatically.
- A scene action runs a coherent demonstration. During playback the same button can finish at its result. There is no comprehension timer.
- Orbit playback retains the original linear 1800x simulation pace. A day takes about 48 seconds naturally; finishing it early is always available.
- A question is a separate view. Radio choices select an answer; they do not submit or advance. The main button checks it. Arrow keys work.
- Feedback is its own view. Back restores the previous moment and the learner can revise an answer.
- The new-case question precedes the new-case animation.
- Replay is a quiet secondary action. Reset requires confirmation. Finish returns to the existing Atlas.
- Keep 44px targets and 14px type. Remove redundant captions before shrinking text. No external runtime assets or network requests.
- Respect OS reduced motion and denied storage. Theme changes still work without storage.

## State route

Cover → action → running → result → question → feedback → next chapter.
The two throw strengths are demonstrated in order. Scene-only chapters omit question and feedback. The final unfamiliar orbit is predicted first, then demonstrated, followed by a spoken explain-back prompt, an example explanation, and the return to the map.

The small Back action restores snapshots of the journey, local phase and scene, so it reverses moments rather than jumping whole chapters. Answer selection remains independent from the forward action. See the result stops the active animation before rendering the settled frame.

## Verification

`npm test` runs the existing 18 physics and journey unit tests.
`npm run test:browser` runs eight complete phase walks in real Chromium across 320×568, 390×844, 1280×800 and 1440×900 in both modes. The 390 Light run lets the drop and throws settle naturally; long orbit segments use the available See the result action. Other matrix runs use OS reduced motion. Each walk audits targets, type, viewport fit, browser errors and non-local requests. Ground-view checkpoints also check the settled satellite drawing and sample its entire trajectory against the inset, with a 4px separation floor. Short scenes use an 80px inset; the orbit scale and center fit the full satellite envelope below it. The smallest sampled separation in the review-fix matrix was 5.77px at 320px. A checkpoint count is not a tap count.

`node tests/sequential-robust.cjs` checks keyboard input, arrow-key selection, wrong-answer retry, Back/replay, reset cancellation and confirmation, blocked storage, live reduced-motion changes and viewport refit. A separate natural-motion check was also run for a complete day-long comparison at the inherited rate, with no question auto-advance.

The unchanged analytic orbit and integrated-throw models remain the source of the drawings. App-specific rollout remains necessary: another app may need direct manipulation rather than this exact action sequence. Geography and immersive worlds must not acquire quizzes.

## Evidence boundary

Staged disclosure, meaningful segmentation and recognizable controls have research and standards support. No participant study establishes this exact interface as uniquely best. Test learner hesitation, wrong-control taps and explain-back quality before making that claim. No child usability or retention study was performed for this pilot.
