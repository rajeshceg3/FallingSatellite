# Falling Satellite hide-not-ready delta

Private delta from released bbc0a9794ccb0085049a60d2c884ad4443f2f257. Six runtime files matched https://fallingsatellite.pages.dev/ byte for byte before editing, recorded in LIVE-BASE.json. Complete history recovered from r2 bundle. No push or deployment.

Before a learner chooses an answer, the primary is omitted with visibility:hidden, inert and aria-hidden while retaining its slot. Selecting an answer restores Check my answer without submitting or moving focus. No focus shortcut. Returning to a previously chosen answer keeps Check my answer available. Reset is omitted at the untouched cover and appears after progress. Pressed controls retain their target geometry. The running primary remains actionable because it explicitly finishes the current segment and shows its result.

No model, palette, lesson copy, questions, answer feedback, running timing or scene geometry changed. The old Choose an answer label remains internal, not painted or exposed while unavailable. Existing Back, Reset confirmation, Replay and About behavior retained.

Checks:
- Eighteen model/journey/physics tests pass.
- Four complete walks:320 Light reduced,390 Light normal,1280 Dark reduced,1440 Dark reduced.136 phases, zero layout issues, page errors or external requests. Every unanswered question primary is omitted, selection does not submit and Check my answer submits only after selection. Reset confirmation/cancel/confirm and Back pass at journey end.
- Thirty-two focused cover/question/choice/feedback states at320x480,390x844,844x390,1440x900 in Light/Dark. All visible header and journey controls in bounds, >=44px, left/center/right hit tests pass. Hidden primary excluded from eight Tab presses, selection restores it without changing its rectangle, answered Back restores available primary.
- Eight existing utility/keyboard/radio retry/storage/refit/Replay/About cases pass.
- Actual320x480question and selected-answer Light/Dark pixels, plus landscape cover inspected. Clear fixed primary slot; no do-this-first control and no target shift. Header tools all reachable. No additional corner CSS fix needed.

Chromium viewport emulation, not physical phones/Safari. No new full contrast, screen-reader or sustained-performance certification. tests/browser.cjs now accepts CASE and checks omitted primary rather than clicking an unavailable prerequisite. Source hashes in LIVE-BASE are the pre-edit baseline; final hashes in manifest accompany the packet.

Self-review bounded delta: overall phone/desktop8.5, flow8.7, omission8.8, keyboard/recovery8.6, stable geometry8.6, hierarchy8.5, model preservation8.7, palette preservation8.5, privacy9.0. Independent gate required.

Reproduce: npm test; node tests/hide.cjs; node tests/sequential-robust.cjs; CASE=390-light OUT=/downloads/falling-hide-flow390 node tests/browser.cjs. Chrome /usr/bin/google-chrome, Playwright from parent installation.
