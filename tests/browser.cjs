// Real-Chromium QA for The Falling Satellite. System Chrome, not a physical
// phone. Walks every step with wrong/right/retry, scene playback, stepping,
// reset, reduced-motion and dark theme, and saves frames as evidence.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.BASE_URL || 'http://127.0.0.1:8796';
const out = process.env.OUT || 'docs/frames/local';
const results = [];
const note = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'ok' : 'FAIL'} - ${name}${extra ? ' — ' + extra : ''}`); if (!ok) process.exitCode = 1; };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

  async function newPage(w, h, motion) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: motion });
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); });
    await p.goto(base);
    await p.waitForFunction(() => document.querySelector('#step-title').textContent.includes('Falling'));
    return p;
  }
  const ev = (p) => p.evaluate(async () => (await import('./main.js')).journeyEvidence());

  /* ---- main pass: 390px, no-preference motion ---- */
  {
    const p = await newPage(390, 844, 'no-preference');
    let e = await ev(p);
    note('cover starts paused', e.playing === false && e.step === 0);
    await p.screenshot({ path: `${out}/01-cover-390.png` });

    await p.locator('#next').click();
    e = await ev(p);
    note('step 1 drop: Drop button present', e.dock.some((d) => d.includes('Drop')));
    await p.locator('#scene-dock button').first().click();
    await p.waitForTimeout(1400);
    await p.screenshot({ path: `${out}/02-drop-landed-390.png` });
    // wrong answer then right answer (retry)
    const ans = p.locator('#answers button');
    note('step 1 has 3 choices', (await ans.count()) === 3);
    await ans.nth(1).click();
    e = await ev(p);
    note('wrong answer gives honest feedback', e.feedback.length > 30 && !e.feedback.startsWith('Yes'));
    await ans.nth(0).click();
    e = await ev(p);
    note('retry right answer acknowledged', e.feedback.startsWith('Yes'));
    await p.screenshot({ path: `${out}/03-drop-answered-390.png` });

    await p.locator('#next').click();
    await p.locator('#scene-dock button', { hasText: 'Gentle' }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/04-throw-gentle-flying-390.png` });
    await p.waitForFunction(() => document.querySelector('#scene').getAttribute('aria-label').length > 10);
    await p.waitForTimeout(9000);
    e = await ev(p);
    note('gentle throw finishes paused', e.playing === false);
    await p.screenshot({ path: `${out}/05-throw-gentle-landed-390.png` });
    await p.locator('#scene-dock button', { hasText: 'Strong' }).click();
    await p.waitForTimeout(12000);
    await p.screenshot({ path: `${out}/06-throw-strong-landed-390.png` });

    await p.locator('#next').click();
    await p.locator('#scene-dock button', { hasText: 'Mightiest' }).click();
    await p.waitForTimeout(11000);
    await p.screenshot({ path: `${out}/07-mightiest-orbit-390.png` });
    // answer the bridge question
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('miss feedback explains falling-missing', e.feedback.includes('ground curves away'));

    await p.locator('#next').click(); // float
    await p.locator('#scene-dock button', { hasText: 'pull' }).click();
    await p.locator('#scene-dock button', { hasText: 'Play' }).click();
    await p.waitForTimeout(2500);
    e = await ev(p);
    const t1 = e.sceneT;
    note('orbitLow playing advances sim time', t1 > 0, `t=${Math.round(t1)}s`);
    await p.locator('#scene-dock button', { hasText: 'Pause' }).click();
    e = await ev(p);
    note('pause stops playback', e.playing === false);
    await p.screenshot({ path: `${out}/08-float-pull-390.png` });

    await p.locator('#next').click(); // compare
    await p.locator('#scene-dock button', { hasText: 'Play' }).click();
    await p.waitForTimeout(3000);
    await p.locator('#scene-dock button', { hasText: 'Pause' }).click();
    await p.screenshot({ path: `${out}/09-compare-390.png` });
    e = await ev(p);
    note('compare advances a long day fast', e.sceneT > 1000);

    await p.locator('#next').click(); // spin (ground panel appears)
    e = await ev(p);
    note('ground panel shown on spin', e.groundShown === true);
    for (let i = 0; i < 12; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    e = await ev(p);
    note('stepping 12 h grows ground trail', e.trail > 10, `trail=${e.trail}`);
    await p.screenshot({ path: `${out}/10-spin-ground-390.png` });

    await p.locator('#next').click(); // match
    for (let i = 0; i < 8; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/11-match-ground-390.png` });
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('match question answered', 'match' in e.answers);

    await p.locator('#next').click(); // tilt
    for (let i = 0; i < 24; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/12-tilt-ground-390.png` });
    e = await ev(p);
    note('tilt trail covers a day', e.trail > 40, `trail=${e.trail}`);

    await p.locator('#next').click(); // transfer
    await p.locator('#answers button').nth(1).click(); // wrong on purpose
    e = await ev(p);
    note('transfer wrong answer gets its own feedback', e.feedback.includes('One day is not enough'));
    await p.locator('#answers button').nth(0).click();
    e = await ev(p);
    note('transfer right answer explains tilt drift', e.feedback.includes('north and south'));
    await p.locator('#teachback').click();
    e = await ev(p);
    note('teachback reveals model answer', e.feedback.includes('IS falling'));
    await p.screenshot({ path: `${out}/13-transfer-done-390.png` });
    await p.locator('#next').click(); // begin again
    e = await ev(p);
    note('begin again resets the journey', e.step === 0 && Object.keys(e.answers).length === 0);

    note('no page errors (390 main pass)', p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  /* ---- reduced motion pass ---- */
  {
    const p = await newPage(390, 844, 'reduce');
    let e = await ev(p);
    await p.locator('#next').click();
    await p.locator('#scene-dock button').first().click(); // drop: instant under reduce
    await p.screenshot({ path: `${out}/20-drop-reduced-390.png` });
    for (let i = 0; i < 5; i++) await p.locator('#next').click();
    e = await ev(p); // spin
    await p.locator('#scene-dock button', { hasText: 'Play' }).click();
    await p.waitForTimeout(2200);
    e = await ev(p);
    note('reduced-motion Play snaps forward discretely', e.sceneT >= 900, `t=${e.sceneT}`);
    await p.locator('#scene-dock button', { hasText: 'Pause' }).click();
    await p.screenshot({ path: `${out}/21-spin-reduced-390.png` });
    note('no page errors (reduced pass)', p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  /* ---- size matrix ---- */
  for (const [w, h, tag] of [[320, 568, '320'], [844, 390, 'landscape'], [1320, 900, 'desktop']]) {
    const p = await newPage(w, h, 'reduce');
    await p.locator('#next').click();
    await p.locator('#next').click();
    await p.locator('#scene-dock button', { hasText: 'Gentle' }).click();
    await p.screenshot({ path: `${out}/30-throw-${tag}.png` });
    for (let i = 0; i < 5; i++) await p.locator('#next').click();
    for (let i = 0; i < 6; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/31-match-${tag}.png` });
    note(`no page errors (${tag})`, p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  /* ---- dark theme ---- */
  {
    const p = await newPage(390, 844, 'reduce');
    await p.locator('#theme').click();
    await p.locator('#next').click();
    await p.screenshot({ path: `${out}/40-drop-dark-390.png` });
    for (let i = 0; i < 6; i++) await p.locator('#next').click();
    for (let i = 0; i < 6; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/41-match-dark-390.png` });
    note('no page errors (dark)', p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  /* ---- about dialog ---- */
  {
    const p = await newPage(390, 844, 'reduce');
    await p.locator('#about-open').click();
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/50-about-390.png` });
    const visible = await p.locator('#about').evaluate((d) => d.open);
    note('about dialog opens on demand', visible === true);
    await p.locator('#about-close').click();
    note('no page errors (about)', p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  await b.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
