// Quick smoke: load the app at 390px and desktop, click through every step,
// capture frames, report page errors. Real Chromium via system Chrome.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const base = process.env.BASE_URL || 'http://127.0.0.1:8796';
  const out = process.env.OUT || 'docs/frames/local';
  fs.mkdirSync(out, { recursive: true });
  const viewports = JSON.parse(process.env.VIEWPORTS || '[[390,844],[1320,900]]');
  const motion = process.env.MOTION || 'reduce';
  for (const [w, h] of viewports) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: motion });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(base);
    await p.waitForFunction(() => document.querySelector('#step-title').textContent.length > 3);
    const ev = () => p.evaluate(async () => (await import('./main.js')).journeyEvidence());
    const s0 = await ev();
    assert.equal(s0.step, 0); assert.equal(s0.playing, false);
    await p.screenshot({ path: `${out}/0-cover-${w}.png` });
    // walk through every step
    for (let i = 1; i <= 9; i++) {
      await p.locator('#next').click();
      await p.waitForFunction((n) => document.querySelector('#step-title').textContent.length > 3);
      const e = await ev();
      assert.equal(e.step, i, `step ${i}`);
      await p.screenshot({ path: `${out}/${i}-${e.stepId}-${w}.png` });
    }
    // back to start via Back buttons
    for (let i = 0; i < 9; i++) await p.locator('#back').click();
    const eBack = await ev();
    assert.equal(eBack.step, 0);
    assert.deepEqual(errors, [], `page errors at ${w}: ${errors.join(' | ')}`);
    console.log(`viewport ${w}x${h}: 10 steps walked, back-walked, no page errors`);
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
