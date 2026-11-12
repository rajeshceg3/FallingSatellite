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
  const overlaps = (a, b, gap = 0) => !!a && !!b && a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
  const noOverlap = (a, b, gap = 2) => !overlaps(a, b, gap);
  // complete the current step: act on the picture first, then answer, so Next unlocks
  async function completeStep(p) {
    let e = await ev(p);
    if (e.zone === 'scene') {
      if (e.stepId === 'drop') await p.locator('#scene-dock button').first().click();
      else if (e.stepId === 'throw') {
        await p.locator('#scene-dock button', { hasText: 'Gentle' }).click();
        await p.locator('#scene-dock button', { hasText: 'Strong' }).click();
      } else if (e.stepId === 'miss') await p.locator('#scene-dock button', { hasText: 'Mightiest' }).click();
      else if (e.stepId === 'float') await p.locator('#scene-dock button', { hasText: 'pull' }).click();
      else await p.locator('#scene-dock button', { hasText: '+1 h' }).first().click();
      await p.waitForFunction(async (sid) => (await import('./main.js')).journeyEvidence().acted[sid] === true, e.stepId, { timeout: 20000 });
      e = await ev(p);
    }
    if (e.zone === 'question') {
      await p.locator('#answers button').first().click();
      e = await ev(p);
    }
    return e;
  }

  /* ---- main pass: 390px, no-preference motion ---- */
  {
    const p = await newPage(390, 844, 'no-preference');
    let e = await ev(p);
    note('cover starts paused', e.playing === false && e.step === 0);
    await p.screenshot({ path: `${out}/01-cover-390.png` });

    await p.locator('#next').click();
    e = await ev(p);
    note('step 1 drop: Drop button present', e.dock.some((d) => d.includes('Drop')));
    note('gate: one active zone, question locked first', e.zone === 'scene' && e.answersLocked && !e.dockLocked && e.nextDisabled && e.cue === 'scene' && e.nextText.includes('Drop'));
    await p.locator('#scene-dock button').first().click();
    await p.waitForTimeout(1400);
    e = await ev(p);
    note('gate: acting moves the one cue to the question', e.zone === 'question' && e.dockLocked && !e.answersLocked && e.nextDisabled && e.cue === 'question' && e.nextText.includes('Answer'));
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
    note('gate: answered step unlocks Next, cue gone', e.zone === 'done' && !e.nextDisabled && e.cue === null && !e.answersLocked && !e.dockLocked);
    await p.screenshot({ path: `${out}/03-drop-answered-390.png` });

    await p.locator('#next').click();
    e = await ev(p);
    note('gate: throw step starts locked on the picture', e.zone === 'scene' && e.answersLocked && e.nextDisabled);
    await p.locator('#scene-dock button', { hasText: 'Gentle' }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/04-throw-gentle-flying-390.png` });
    await p.waitForFunction(() => document.querySelector('#scene').getAttribute('aria-label').length > 10);
    await p.waitForTimeout(9000);
    e = await ev(p);
    note('gentle throw finishes paused', e.playing === false);
    note('gate: one throw alone does not unlock yet', e.zone === 'scene' && e.nextDisabled);
    await p.screenshot({ path: `${out}/05-throw-gentle-landed-390.png` });
    await p.locator('#scene-dock button', { hasText: 'Strong' }).click();
    await p.waitForTimeout(12000);
    e = await ev(p);
    note('gate: both throws unlock the question', e.zone === 'question' && e.dockLocked);
    await p.screenshot({ path: `${out}/06-throw-strong-landed-390.png` });
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('gate: throw answered, Next unlocked', e.zone === 'done' && !e.nextDisabled);

    await p.locator('#next').click();
    await p.locator('#scene-dock button', { hasText: 'Mightiest' }).click();
    await p.waitForFunction(async () => (await import('./main.js')).journeyEvidence().zone === 'question', { timeout: 30000 });
    await p.screenshot({ path: `${out}/07-mightiest-orbit-390.png` });
    {
      const { layout } = await ev(p);
      note('gate: mountain label clear of status line', noOverlap(layout.mountainLabel, layout.status));
      note('gate: mountain label clear of zoom bubble', noOverlap(layout.mountainLabel, layout.zoomBubble));
      note('gate: status line clear of caption', noOverlap(layout.status, layout.caption));
    }
    // answer the bridge question
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('miss feedback explains falling-missing', e.feedback.includes('ground curves away'));

    await p.locator('#next').click(); // float
    await p.locator('#scene-dock button', { hasText: 'pull' }).click();
    e = await ev(p);
    note('gate: showing the pull moves to the question', e.zone === 'question');
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('gate: float answered after showing the pull', e.zone === 'done' && !e.nextDisabled);
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
    await p.locator('#scene-dock button', { hasText: '+1 h' }).first().click();
    e = await ev(p);
    note('gate: watching unlocks the match question', e.zone === 'question');
    await p.locator('#answers button').first().click();
    e = await ev(p);
    note('match question answered', 'match' in e.answers);
    for (let i = 0; i < 7; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/11-match-ground-390.png` });
    {
      const { layout, inset } = await ev(p);
      note('gate: ground inset clear of orbit art (match)', noOverlap(layout.orbitPath, inset));
    }

    await p.locator('#next').click(); // tilt
    for (let i = 0; i < 24; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/12-tilt-ground-390.png` });
    e = await ev(p);
    note('tilt trail covers a day', e.trail > 40, `trail=${e.trail}`);

    await p.locator('#next').click(); // transfer
    e = await ev(p);
    note('gate: transfer locks the question until you look', e.zone === 'scene' && e.answersLocked && e.nextDisabled && e.cue === 'scene');
    await p.screenshot({ path: `${out}/13a-transfer-entry-390.png` });
    {
      const { layout, inset } = await ev(p);
      note('gate: ground inset clear of orbit art (transfer)', noOverlap(layout.orbitPath, inset));
    }
    await p.locator('#scene-dock button', { hasText: '+1 h' }).first().click();
    e = await ev(p);
    note('gate: looking unlocks the transfer question', e.zone === 'question' && e.cue === 'question');
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
    e = await completeStep(p); // drop: instant under reduce
    await p.screenshot({ path: `${out}/20-drop-reduced-390.png` });
    for (let i = 0; i < 5; i++) { await p.locator('#next').click(); e = await completeStep(p); }
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
    await p.locator('#next').click(); // drop
    await completeStep(p);
    await p.locator('#next').click(); // throw
    await p.locator('#scene-dock button', { hasText: 'Gentle' }).click();
    await p.screenshot({ path: `${out}/30-throw-${tag}.png` });
    {
      const { layout } = await ev(p);
      note(`gate: throw texts and bubble separated (${tag})`, noOverlap(layout.mountainLabel, layout.status) && noOverlap(layout.mountainLabel, layout.zoomBubble) && noOverlap(layout.status, layout.caption));
    }
    await completeStep(p); // strong + answer
    for (let i = 0; i < 5; i++) { await p.locator('#next').click(); await completeStep(p); }
    for (let i = 0; i < 6; i++) await p.locator('#scene-dock button', { hasText: '+1 h' }).click();
    await p.screenshot({ path: `${out}/31-match-${tag}.png` });
    {
      const { layout, inset } = await ev(p);
      note(`gate: ground inset clear of orbit art (${tag})`, noOverlap(layout.orbitPath, inset));
    }
    note(`no page errors (${tag})`, p.errors.length === 0, p.errors.join(' | '));
    await p.close();
  }

  /* ---- dark theme ---- */
  {
    const p = await newPage(390, 844, 'reduce');
    await p.locator('#theme').click();
    await p.locator('#next').click(); // drop
    await p.screenshot({ path: `${out}/40-drop-dark-390.png` });
    await completeStep(p);
    for (let i = 0; i < 6; i++) { await p.locator('#next').click(); await completeStep(p); }
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
