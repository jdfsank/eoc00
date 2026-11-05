import { chromium } from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'playtest-output';
await fs.mkdir(out, { recursive: true });
const report = { scope: 'Headless Chromium viewport, pointer and keyboard regression checks; not physical-device or screen-reader certification.', checks: [], viewports: [], camera: {}, errors: [] };
const server = await createServer({ server: { host: '127.0.0.1', port: 4175, strictPort: true } });
await server.listen();
let browser, page;
const check = (name, passed, detail) => {
  report.checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
  assert.ok(passed, name);
};
const click = async action => page.locator(`[data-action="${action}"]`).first().click();
const world = () => page.evaluate(() => JSON.stringify(window.afterwave.state));
async function view() {
  // A mounted canvas can still be in Phaser's asynchronous asset loader. A
  // fixed delay (or a cached mapView from before remount) is not readiness.
  // Require actual nonempty canvas pixels and the same finite camera/size on
  // three samples spanning at least 100ms. Do not wait for expected coordinates:
  // a stable but incorrect camera must still fail the assertions below.
  const sample = await page.evaluate(async () => {
    const started = performance.now();
    let previous = null, previousCanvas = null, stableSince = 0, matches = 0, lastSample = 0, pendingSamples = 0, last = null;
    while (performance.now() - started < 5000) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now();
      if (now - lastSample < 50) continue;
      lastSample = now;
      const canvas = document.querySelector('canvas'), result = window.afterwave.mapView;
      const camera = typeof result === 'function' ? result() : result;
      const finite = camera && typeof camera.focus === 'boolean' && ['centerX', 'centerY', 'zoom'].every(k => Number.isFinite(camera[k])) && camera.zoom > 0;
      let rendered = false;
      if (canvas?.isConnected && canvas.width > 0 && canvas.height > 0) {
        const rgba = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; rgba && i < rgba.length; i += 4) if (rgba[i]) { rendered = true; break; }
      }
      last = { view: camera, width: canvas?.width ?? null, height: canvas?.height ?? null, rendered };
      if (!finite || !rendered) { previous = null; previousCanvas = null; matches = 0; pendingSamples++; continue; }
      const key = JSON.stringify(last);
      if (canvas === previousCanvas && key === previous) matches++;
      else { previous = key; previousCanvas = canvas; stableSince = now; matches = 1; }
      if (matches >= 3 && now - stableSince >= 100) return { ...last, waitedMs: Math.round(now - started), stableMs: Math.round(now - stableSince), samples: matches, pendingSamples };
    }
    throw Error(`Map camera did not reach a rendered, finite, stable state within 5s: ${JSON.stringify(last)}`);
  });
  (report.cameraReadiness ??= []).push(sample);
  return sample.view;
}
const settled = async () => { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.waitForTimeout(100); };
const snap = name => page.screenshot({ path: `${out}/interaction-${name}.png`, fullPage: true });
const sameView = (a, b) => a.focus === b.focus && Math.abs(a.centerX - b.centerX) <= 1 && Math.abs(a.centerY - b.centerY) <= 1 && Math.abs(a.zoom - b.zoom) < .001;
const sameCenter = (a, b) => a.focus === b.focus && Math.abs(a.centerX - b.centerX) <= 1 && Math.abs(a.centerY - b.centerY) <= 1;
async function newPage(width, height) {
  // Reuse a context: the packaged single-process Chromium can exit when its
  // last isolated context closes. Clear only this test origin between cases.
  if (!page) {
    page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('interaction-reset')) { localStorage.clear(); sessionStorage.removeItem('interaction-reset'); }
      const fixture = sessionStorage.getItem('interaction-fixture');
      if (fixture) { localStorage.setItem('afterwave.save.v1', fixture); sessionStorage.removeItem('interaction-fixture'); }
    });
  } else {
    await page.evaluate(() => sessionStorage.setItem('interaction-reset', '1'));
    await page.setViewportSize({ width, height });
  }
  await page.goto('http://127.0.0.1:4175');
  await page.locator('canvas').waitFor();
  await settled();
}
async function primaryMetrics(label) {
  const metrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-primary-action]')];
    const el = buttons[0], rect = el?.getBoundingClientRect();
    const bounds = rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
    const visible = !!rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    const samples = rect ? [[.15, .25], [.5, .5], [.85, .75]].map(([x, y]) => {
      const top = document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y);
      return !!top && (top === el || el.contains(top));
    }) : [];
    return { viewport: { width: innerWidth, height: innerHeight }, scrollY, scrollWidth: document.documentElement.scrollWidth,
      primaryCount: buttons.length, bounds, visible, unobscured: samples.length === 3 && samples.every(Boolean),
      rootFontSize: getComputedStyle(document.documentElement).fontSize, primaryFontSize: el ? getComputedStyle(el).fontSize : null, bigText: window.afterwave.ui.bigText };
  });
  report.viewports.push({ label, ...metrics });
  check(`${label}: exactly one primary world action`, metrics.primaryCount === 1, metrics);
  check(`${label}: primary fully visible and unobscured without scrolling`, metrics.scrollY === 0 && metrics.visible && metrics.unobscured, metrics);
  check(`${label}: no horizontal overflow`, metrics.scrollWidth <= metrics.viewport.width, metrics);
  if (metrics.bigText) check(`${label}: primary text is full 200% size`, metrics.primaryFontSize === '32px', metrics);
  await snap(label);
}
try {
  browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
  for (const [width, height] of [[320,568], [360,800], [390,844], [430,932]]) {
    await newPage(width, height);
    await primaryMetrics(`${width}x${height}`);
    const before = await world();
    await page.locator('[data-primary-action]').click();
    check(`${width}x${height}: primary opens legal AVG`, await page.evaluate(() => window.afterwave.ui.screen === 'avg'));
    check(`${width}x${height}: screen transition focuses its heading`, await page.evaluate(() => document.activeElement === document.querySelector('main h1')));
    check(`${width}x${height}: opening AVG does not mutate world`, before === await world());
  }
  await newPage(320, 568);
  const beforeLargeText = await world();
  await click('settings'); await click('text-size'); await click('home'); await settled();
  check('320x568: 200% text mode enabled', await page.evaluate(() => window.afterwave.ui.bigText && document.documentElement.classList.contains('large-text')));
  await primaryMetrics('320x568-text200');
  check('Text-size and navigation do not mutate world', beforeLargeText === await world());

  // Generate a legal two-actor year20 state with the actual simulation, then load through normal startup.
  await newPage(390, 844);
  await page.evaluate(async () => {
    const sim = await import('/src/simulation.js');
    const state = sim.createRun(12), evidence = Object.keys(sim.EVIDENCE);
    for (const action of ['build_joint', 'recruit_successor']) {
      for (const id of sim.getActions(state, 'D4').find(a => a.id === action).requireEvidence) sim.investigate(state, 'protagonist', 'D4', id);
      sim.lockTask(state, 'protagonist', 'D4', action, evidence);
      sim.commitWindow(state); sim.advanceToNextWindow(state);
    }
    sessionStorage.setItem('interaction-fixture', JSON.stringify({ state }));
  });
  await page.reload(); await page.locator('canvas').waitFor(); await settled();
  const beforeMap = await world();
  await click('focus'); await settled();
  const focused = await view();
  check('Map hook exposes focused camera coordinates', focused?.focus === true && ['centerX','centerY','zoom'].every(k => Number.isFinite(focused[k])), focused);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas, 'Canvas has pointer target bounds');
  const start = { x: canvas.x + canvas.width * .5, y: canvas.y + canvas.height * .5 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + Math.min(60, canvas.width * .2), start.y + 35, { steps: 12 });
  await page.mouse.up(); await settled();
  const dragged = await view();
  report.camera = { focused, dragged, pointer: { start, deltaX: Math.min(60, canvas.width * .2), deltaY: 35 } };
  check('Actual pointer drag changes focused world center', Math.hypot(dragged.centerX - focused.centerX, dragged.centerY - focused.centerY) > 5, report.camera);
  await page.evaluate(() => { window.__interactionCanvas = document.querySelector('canvas'); });
  await page.locator('[data-action="layer"][data-layer="economy"]').click(); await settled();
  const afterChannel = await view(); report.camera.afterChannel = afterChannel;
  check('Channel rerender preserves dragged camera', sameView(dragged, afterChannel));
  check('Channel rerender preserves canvas instance', await page.evaluate(() => window.__interactionCanvas === document.querySelector('canvas')));
  await page.locator('[data-action="actor"][data-actor="linche"]').click(); await settled();
  const afterActor = await view(); report.camera.afterActor = afterActor;
  check('Actor rerender preserves dragged camera', sameView(dragged, afterActor));
  check('Actor rerender preserves canvas instance', await page.evaluate(() => window.__interactionCanvas === document.querySelector('canvas')));
  await page.locator('[data-primary-action]').click(); await click('home'); await settled();
  const afterReturn = await view(); report.camera.afterReturn = afterReturn;
  check('AVG round trip preserves dragged camera', sameView(dragged, afterReturn));
  // Off-world screens intentionally release Phaser; compare the restored viewpoint,
  // then track the newly mounted canvas for resize identity.
  await page.evaluate(() => { window.__interactionCanvas = document.querySelector('canvas'); });
  await page.setViewportSize({ width: 430, height: 932 }); await settled();
  const afterResize = await view(); report.camera.afterResize = afterResize;
  check('Resize preserves world center while allowing fit zoom adjustment', sameCenter(dragged, afterResize));
  check('Resize preserves canvas instance', await page.evaluate(() => window.__interactionCanvas === document.querySelector('canvas')));
  await snap('camera-retained');
  // Exercise real remount/loading races in every ordinary run, not only on a
  // slow CI runner. Zero is available for the normal-speed comparison run.
  const assetDelay = Number(process.env.AFTERWAVE_INTERACTION_ASSET_DELAY_MS ?? 180);
  assert.ok(Number.isFinite(assetDelay) && assetDelay >= 0, 'Asset delay must be nonnegative milliseconds');
  report.assetDelay = { milliseconds: assetDelay, requests: 0 };
  if (assetDelay) await page.route('**/assets/props/*.png', async route => {
    report.assetDelay.requests++;
    await new Promise(resolve => setTimeout(resolve, assetDelay));
    await route.continue();
  });
  await click('list');
  await page.locator('[data-action="select"][data-cell="E4"]').click(); await settled();
  const selectedView = await view(); report.camera.afterExplicitE4 = selectedView;
  check('Explicit coordinate selection recenters focused camera to E4', selectedView.focus === true && Math.abs(selectedView.centerX - 320) <= 1 && Math.abs(selectedView.centerY - 152) <= 1, selectedView);
  check('Explicit E4 selection replaces old pan without changing simulation', !sameCenter(dragged, selectedView) && beforeMap === await world());
  // Locating an event from the world sidebar keeps the existing map instance.
  // It must recenter after the map receives the new selected cell, not before.
  await click('list'); await page.locator('[data-action="select"][data-cell="A1"]').click(); await settled();
  const beforeRecentLocate = await view(); report.camera.beforeRecentLocate = beforeRecentLocate;
  if (assetDelay) await page.unroute('**/assets/props/*.png');
  check('Recent-event regression starts focused on A1', await page.evaluate(() => window.afterwave.ui.selected === 'A1') && beforeRecentLocate.focus === true && Math.abs(beforeRecentLocate.centerX - 288) <= 1 && Math.abs(beforeRecentLocate.centerY - 40) <= 1, beforeRecentLocate);
  await page.evaluate(() => { window.__interactionCanvas = document.querySelector('canvas'); });
  await page.locator('.world-side [data-action="locate"][data-cell="D4"]').click(); await settled();
  const afterRecentLocate = await view(); report.camera.afterRecentLocate = afterRecentLocate;
  check('World recent-event D4 location updates selection and camera together', await page.evaluate(() => window.afterwave.ui.selected === 'D4') && afterRecentLocate.focus === true && Math.abs(afterRecentLocate.centerX - 288) <= 1 && Math.abs(afterRecentLocate.centerY - 136) <= 1, afterRecentLocate);
  check('Recent-event location reuses canvas and leaves simulation unchanged', await page.evaluate(() => window.__interactionCanvas === document.querySelector('canvas')) && beforeMap === await world());
  await snap('recent-event-locate-d4');
  const fullmap = page.locator('[data-action="fullmap"]');
  if (await fullmap.count()) await fullmap.first().click(); else await click('focus');
  await settled();
  const reset = await view(); report.camera.reset = reset;
  check('Explicit full-map command resets focus and camera center', reset.focus === false && Math.abs(reset.centerX - 288) < 1 && Math.abs(reset.centerY - 173) < 1, reset);
  check('Map navigation, channel, actor, resize and reset leave world unchanged', beforeMap === await world());

  await newPage(390, 844);
  const beforeEvidence = await page.evaluate(() => { const s=structuredClone(window.afterwave.state); delete s.investigations; return JSON.stringify(s); });
  await page.locator('[data-primary-action]').click();
  const first = page.locator('[data-evidence-id="independent_flood_records"]');
  const summary = first.locator(':scope > summary');
  await summary.focus(); await page.keyboard.press('Enter');
  const investigate = first.locator('[data-action="evidence"]');
  await investigate.waitFor({ state: 'visible' });
  await page.keyboard.press('Tab');
  check('Keyboard Tab from evidence summary reaches investigation control', await investigate.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter'); await settled();
  check('Keyboard investigation restores focus to its summary', await summary.evaluate(el => el === document.activeElement));
  const session = () => page.evaluate(() => window.afterwave.ui.sessions['0:protagonist:D4']);
  const investigated = await session();
  check('Keyboard investigation consumes exactly one opportunity', investigated.budget === 2 && investigated.evidence.length === 1 && investigated.evidence[0] === 'independent_flood_records', investigated);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  check('Repeated summary toggles do not spend investigation budget', JSON.stringify(await session()) === JSON.stringify(investigated));
  await page.keyboard.press('Tab');
  check('Tab continues to next evidence summary after investigation', await page.evaluate(() => document.activeElement?.matches('[data-evidence-id="unfunded_maintenance"] > summary')));
  await snap('evidence-keyboard');
  await click('home'); await page.locator('[data-primary-action]').click();
  check('Investigation budget survives leaving and returning', JSON.stringify(await session()) === JSON.stringify(investigated));
  check('Investigation persists planning records without changing world outcomes', beforeEvidence === await page.evaluate(() => { const s=structuredClone(window.afterwave.state); delete s.investigations; return JSON.stringify(s); }) && await page.evaluate(() => window.afterwave.state.investigations['0:protagonist'].length === 1));
  // The one primary action must reflect legal actions and the simulation phase.
  await newPage(390, 844);
  const beforeA1 = await world();
  await click('list'); await page.locator('[data-action="select"][data-cell="A1"]').click();
  check('Non-intervenable A1 offers history rather than AVG', await page.locator('[data-primary-action]').count() === 1 && await page.locator('[data-primary-action]').getAttribute('data-action') === 'cell-history');
  await page.locator('[data-primary-action]').click();
  check('A1 primary opens selected-region history', await page.evaluate(() => window.afterwave.ui.screen === 'archive' && window.afterwave.ui.cellHistory === true && window.afterwave.ui.selected === 'A1'));
  check('A1 selection and history leave world unchanged', beforeA1 === await world());
  await snap('a1-history');
  for (const phase of ['playback', 'ended']) {
    await page.evaluate(async phase => {
      const sim = await import('/src/simulation.js'), state = sim.createRun(12);
      if (phase === 'playback') {
        sim.passTask(state, 'protagonist'); sim.commitWindow(state);
        for (let year = 0; year < 5; year++) sim.advanceYear(state);
      } else {
        for (let window = 0; window < 4; window++) {
          for (const actor of sim.getActors(state)) sim.passTask(state, actor.id);
          sim.commitWindow(state); sim.advanceToNextWindow(state);
        }
      }
      sessionStorage.setItem('interaction-fixture', JSON.stringify({ state }));
    }, phase);
    await page.reload(); await page.locator('canvas').waitFor(); await settled();
    const beforePrimary = await world();
    const year = await page.evaluate(() => window.afterwave.state.year);
    const action = phase === 'playback' ? 'playback' : 'ending';
    check(`${phase} world primary has the correct destination`, await page.locator('[data-primary-action]').count() === 1 && await page.locator('[data-primary-action]').getAttribute('data-action') === action);
    await page.locator('[data-primary-action]').click();
    check(`${phase} primary opens ${action}, not AVG`, await page.evaluate(action => window.afterwave.ui.screen === action, action));
    check(`${phase} primary does not advance year or mutate world`, beforePrimary === await world() && year === await page.evaluate(() => window.afterwave.state.year));
    await snap(`primary-${phase}`);
  }
  check('No browser runtime errors', report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
  if (page && !page.isClosed()) await snap('failure').catch(() => {});
} finally {
  await fs.writeFile(`${out}/interaction-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  await server.close();
}
