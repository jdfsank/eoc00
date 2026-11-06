import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {readEndingDetails} from './helpers/ending-reading.mjs';
import { chromium } from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as original from '../tests/fixtures/legacy-simulation.js';
import * as before from '../tests/fixtures/pre-branch-access-simulation.js';

// Only genuine engine-generated saves enter the application, through its visible
// settings file input. Browser evaluate calls are read-only. Explicit version
// fixtures and the invalid-version fixture change that one field outside the app.
const out = 'playtest-output';
const diagnosticOnly = process.argv.includes('--diagnose-map-navigation');
const failureControlsOnly = process.argv.includes('--test-request-failure-handling');
await fs.mkdir(out, { recursive: true });
const report = {
  failureHandling: 'Every requestfailed is fatal, including net::ERR_ABORTED and blob URLs. Passive navigation/canvas observations never exempt a failure. Negative controls concern telemetry only, not application state.',
  scope: 'Real Chromium at390×844 and320×568/200% text. Settings-file imports, genuine original/pre-fix/mixed pending and settled saves, real preview/lock/submit/annual/ending/source/refresh operations. No application-state edits, force clicks, hidden control activation or illegal AVG navigation. Screenshots are element or viewport captures below8192px. Not real-device certification.',
  checks: [], errors: [], screenshots: [], imageReadiness: [], canvasReadiness: [], requestFailures: [],
};
const check = (name, ok, detail) => { report.checks.push({ name, passed: !!ok, ...(detail ? { detail } : {}) }); assert.ok(ok, name); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const branch = s => s.institutions.find(i => i.kind === 'branch' && i.cellId === 'F6');
const station = s => s.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
const mechanics = s => Object.fromEntries(['cells', 'institutions', 'events', 'flags', 'snapshots', 'actors', 'promises', 'committedWindows', 'year', 'phase', 'drafts'].map(k => [k, s[k]]));
function pastUnchanged(s, past) {
  return same(s.history.slice(0, past.history.length), past.history)
    && Object.entries(past.snapshots).every(([year, snapshot]) => same(s.snapshots[year], snapshot))
    && past.events.filter(e => e.status !== 'pending').every(e => same(s.events.find(v => v.id === e.id), e));
}
function lock(api, s, id, cell = 'D4') {
  const a = api.getActions(s, cell, 'protagonist').find(a => a.id === id);
  assert.ok(a, `${id} is actually available at${s.year}`);
  if (api.usesTradeoffs?.(s)) for (const evidence of a.requireEvidence) {
    if (!api.getInvestigation(s, 'protagonist', cell).evidence.includes(evidence)) api.investigate(s, 'protagonist', cell, evidence);
  }
  api.lockTask(s, 'protagonist', cell, id, a.requireEvidence);
}
function submit(api, s) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function advance(api, s, year) {
  while (s.year < year) { if (s.phase === 'planning') submit(api, s); api.advanceYear(s); }
  return s;
}
function sourceAt(api, year) {
  const s = api.createRun(1); lock(api, s, 'build_merchant'); submit(api, s); return advance(api, s, year);
}
function atTwenty({ build = 'build_merchant', ten = null, seed = 1 } = {}) {
  const s = sim.createRun(seed);
  if (build) lock(sim, s, build); submit(sim, s); sim.advanceToNextWindow(s);
  if (ten) lock(sim, s, ten); submit(sim, s); sim.advanceToNextWindow(s);
  return s;
}
async function runtimeHash() {
  const files = [];
  async function walk(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const file = `${dir}/${entry.name}`; if (entry.isDirectory()) await walk(file); else if (entry.isFile()) files.push(file); } }
  await walk('src'); await walk('public/assets'); files.push('index.html');
  const hash = createHash('sha256');
  for (const file of files.sort()) { hash.update(file); hash.update(await fs.readFile(file)); }
  return { sha256: hash.digest('hex'), files: files.length };
}
const hashBefore = await runtimeHash();
let server, browser, page;
const navigation = [], requests = new WeakMap();
// Request failures have no exemptions. Navigation, canvas, document and image
// observations are diagnostics only and can never remove a browser failure.
function keepRequestFailure(failure, failures, errors) {
  failures.push(failure);
  errors.push({ type: 'request-failure', ...failure });
}
function verifyStrictFailureHandling() {
  const asset = 'http://127.0.0.1:4214/assets/props/river_station_fee.png';
  const base = { url: asset, error: 'net::ERR_ABORTED', documentId: 'new-document', startedAt: 1000, failedAt: 1200 };
  const cases = [
    ['different document and a previous destruction boundary', { ...base, boundary: { documentId: 'old-document', kind: 'pagehide', at: 990 }, completedAt: 800 }],
    ['same document but a boundary before this request', { ...base, boundary: { documentId: 'new-document', kind: 'canvas-detached', at: 990 }, completedAt: 1300 }],
    ['only a success from before the failed request', { ...base, boundary: { documentId: 'new-document', kind: 'pagehide', at: 1100 }, completedAt: 800 }],
    ['200 response headers followed by aborted body', { ...base, responseStatus: 200, responseAt: 1050, requestFinished: false }],
    ['blob URL with no independently completed load', { ...base, url: 'blob:http://127.0.0.1:4214/unverified-blob' }],
    ['a click intent without actual destruction', { ...base, boundary: { documentId: 'new-document', kind: 'click', action: 'settings', at: 1100 } }],
    ['a later success without subsequent rendering readiness', { ...base, completedAt: 1300, readyAt: 1150 }],
  ];
  for (const [name, failure] of cases) {
    const failures = [], errors = [];
    keepRequestFailure(failure, failures, errors);
    check(`Request-failure negative control: ${name} remains fatal`, failures.length === 1 && errors.length === 1 && errors[0].type === 'request-failure' && same(failures[0], failure) && errors[0].error === failure.error && errors[0].url === failure.url);
  }
}
async function settleWorld() {
  if (await page.locator('#board').count()) {
    // Phaser creates the scene only after its loader settles. Observe pixels
    // actually drawn on this canvas, not a stale document networkidle event.
    await page.waitForFunction(() => {
      const c = document.querySelector('#board canvas'); if (!c?.width || !c.height) return false;
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    report.canvasReadiness.push(await page.locator('#board canvas').evaluate(c => ({ at: Date.now(), screen: window.afterwave.ui.screen, year: window.afterwave.state.year, width: c.width, height: c.height, drawn: true })));
  }
}
const click = async a => { await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page); await settleWorld(); if(a==='ending')await readEndingDetails(page); };
const readState = () => page.evaluate(() => structuredClone(window.afterwave.state));
const stateBytes = () => page.evaluate(() => JSON.stringify(window.afterwave.state));
const savedBytes = () => page.evaluate(() => localStorage.getItem('afterwave.save.v1'));
const world = async () => { await click('home'); await page.locator('.selection-card').waitFor(); };
async function select(cell) { await world(); await click('list'); await page.locator(`[data-action="select"][data-cell="${cell}"]`).click(); await page.locator('.selection-card').waitFor(); await settleWorld(); }
async function importState(s, name) {
  await click('settings');
  await page.locator('#import-save').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ state: s })) });
  await page.locator('.toast').waitFor(); const text = await page.locator('.toast').innerText();
  await page.locator('.toast').waitFor({ state: 'detached' });
  check(`${name}: accepted settings import retains exact world bytes`, text.startsWith('已导入') && await stateBytes() === JSON.stringify(s));
  check(`${name}: autosave retains exact imported state bytes`, JSON.stringify(JSON.parse(await savedBytes()).state) === JSON.stringify(s));
}
async function openPolicy(selector = '.branch-policy') {
  const panel = page.locator(selector).first();
  if (!await panel.evaluate(el => el.open)) await panel.locator('summary').click();
  return panel.innerText();
}
async function width(label) {
  check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
}
async function visibleImages(label) {
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
  const images = await page.locator('main img').evaluateAll(els => els.map(img => ({ src: img.getAttribute('src'), width: img.naturalWidth, height: img.naturalHeight })));
  report.imageReadiness.push({ label, at: Date.now(), images });
}
async function snap(name, selector) {
  await visibleImages(name);
  await page.evaluate(() => document.fonts.ready);
  const path = `${out}/round14-${name}.png`;
  const target = selector ? page.locator(selector).first() : null;
  const box = target ? await target.boundingBox() : null;
  const element = box && box.height > 0 && box.height < 8192;
  if (element) await target.screenshot({ path }); else await page.screenshot({ path, fullPage: false });
  const bytes = await fs.readFile(path); const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.ok(height < 8192, 'capture must stay below8192px');
  report.screenshots.push({ path, kind: element ? 'element' : 'viewport', selector: selector || null, width, height });
}
async function preview(id, { keyboard = false } = {}) {
  await select('D4');
  check(`${id}: actual world entry permits this planning visit`, await page.locator('[data-primary-action]').getAttribute('data-action') === 'avg');
  await page.locator('[data-primary-action]').click();
  const choose = page.locator(`[data-action="choose"][data-id="${id}"]`);
  if (keyboard) { await choose.focus(); await page.keyboard.press('Enter'); } else await choose.click();
  await page.locator('.contract').waitFor();
}
async function keyboardActivate(locator, label) {
  await locator.focus();
  check(`${label}: keyboard target is focused, visible and unobscured`, await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return document.activeElement === el && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && (top === el || el.contains(top));
  }));
  await page.keyboard.press('Enter');
}
async function uiLock(id) {
  const s = await readState(), action = sim.getActions(s, 'D4', 'protagonist').find(a => a.id === id);
  assert.ok(action, `legal UI action ${id}`);
  await select('D4'); await page.locator('[data-primary-action]').click(); await visibleImages(`actual ${id} scene`);
  for (const id of action.requireEvidence) {
    const entry = page.locator(`[data-evidence-id="${id}"]`);
    const collect = entry.locator('[data-action="evidence"]');
    if (await collect.count()) { if (!await entry.evaluate(el => el.open)) await entry.locator('summary').click(); await collect.click(); }
  }
  await page.locator(`[data-action="choose"][data-id="${id}"]`).click();
  await click('confirm'); await click('lock');
}
async function uiToNext() { await click('commit'); await click('skip'); await world(); }
function linche() { return page.locator('.character-epilogue > article').filter({ has: page.locator('span.eyebrow', { hasText: /^林澈$/ }) }); }
async function ending() { await world(); check('Ended world routes to real ending control', await page.locator('[data-primary-action]').getAttribute('data-action') === 'ending'); await page.locator('[data-primary-action]').click(); await visibleImages('actual40 ending'); await readEndingDetails(page); }
async function readSources(label, { keyboard = false } = {}) {
  const raw = await stateBytes();
  const ids = await linche().locator('[data-action="trace"]').evaluateAll(els => els.map(el => el.dataset.id));
  const s = JSON.parse(raw);
  check(`${label}: every coda source is a unique actual history record`, ids.length > 0 && new Set(ids).size === ids.length && ids.every(id => s.history.filter(h => h.id === id).length === 1));
  for (const [index, id] of ids.entries()) {
    const target = linche().locator(`[data-action="trace"][data-id="${id}"]`);
    if (keyboard && index === ids.length - 1) await keyboardActivate(target, `${label} last personal source`); else await target.click();
    check(`${label}: source${index + 1} reaches its actual record without rewriting history`, await page.evaluate(() => window.afterwave.ui.traceId) === id && await page.locator('.causal-chain .event-card').count() > 0 && (await page.locator('.causal-chain').innerText()).includes(s.history.find(h => h.id === id).text) && await stateBytes() === raw);
    await ending();
  }
  return ids;
}
async function finishRoute(s, actionId, label) {
  await importState(s, label);
  const expected = structuredClone(s); lock(sim, expected, actionId); submit(sim, expected); sim.advanceYear(expected);
  await uiLock(actionId); await click('commit'); await click('step');
  check(`${label}: actual year21 settlement matches engine clone`, same(await readState(), expected));
  check(`${label}: original histories and snapshots survive actual year21`, pastUnchanged(await readState(), s));
  await click('skip'); sim.advanceToNextWindow(expected);
  await world(); await click('window'); await page.locator('[data-action="pass"][data-actor="protagonist"]').click(); await click('commit'); await click('skip');
  submit(sim, expected); sim.advanceToNextWindow(expected);
  check(`${label}: actual year40 state matches complete engine clone`, same(await readState(), expected));
  await click('ending');
  check(`${label}: Linche was never recruited into the actor list`, !(await readState()).actors.some(a => a.id === 'linche'));
  await width(`${label}390`);
  return { state: expected, text: await linche().innerText() };
}
try {
  verifyStrictFailureHandling();
  if (!failureControlsOnly) {
  server = await createServer({ server: { host: '127.0.0.1', port: 4214, strictPort: true } }); await server.listen();
  browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(`page:${e.message}`));
  page.on('console', m => { if (m.type() === 'error' || /\[vite\].*(hot updated|page reload)/.test(m.text())) report.errors.push(`console:${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/assets/') && r.status() >= 400) report.errors.push(`asset:${r.status()} ${r.url()}`); });
  page.on('request', r => requests.set(r, { observedRequestAt: Date.now(), resourceType: r.resourceType() }));
  page.on('requestfailed', r => keepRequestFailure({ ...requests.get(r), observedFailureAt: Date.now(), error: r.failure()?.errorText, url: r.url() }, report.requestFailures, report.errors));
  // Passive capture records the real UI event before the application handles
  // it. It neither changes app state/DOM nor triggers an application action.
  await page.exposeBinding('branchCaretakerNavigation', (_source, entry) => navigation.push(entry));
  await page.addInitScript(() => {
    const documentId = String(performance.timeOrigin), ids = new WeakMap(); let nextCanvas = 1;
    const identify = c => { if (!ids.has(c)) ids.set(c, nextCanvas++); return { id: ids.get(c), connected: c.isConnected }; };
    const capture = (kind, action, detail = {}) => window.branchCaretakerNavigation({ kind, action, at: Date.now(), documentId, screen: window.afterwave?.ui.screen, year: window.afterwave?.state.year, boardPresent: !!document.querySelector('#board canvas'), ...detail });
    const canvases = nodes => [...nodes].flatMap(node => node.nodeType !== 1 ? [] : node.matches('canvas') ? [node] : [...node.querySelectorAll('canvas')]);
    new MutationObserver(records => {
      const removed = [...new Set(records.flatMap(r => canvases(r.removedNodes)))].map(identify);
      const added = [...new Set(records.flatMap(r => canvases(r.addedNodes)))].map(identify);
      // A canvas moved out and back during one render remains connected. Only
      // a genuinely detached old canvas is a destruction/replacement boundary.
      if (removed.some(c => !c.connected)) capture('canvas-detached', 'old-canvas-removed', { removed, added });
      if (added.length) capture('canvas-attached', 'current-canvas-attached', { added });
    }).observe(document, { childList: true, subtree: true });
    document.addEventListener('click', event => { const el = event.target.closest('[data-action]'); if (el) capture('click', el.dataset.action); }, true);
    document.addEventListener('change', event => { if (event.target.id === 'import-save') capture('import', 'settings-file-input'); }, true);
    window.addEventListener('pagehide', () => capture('pagehide', 'reload'));
  });
  await page.goto('http://127.0.0.1:4214'); await page.locator('.selection-card').waitFor(); await settleWorld();
  check('New UI run explicitly pins source-branch-v1', (await readState()).branchAccessRulesVersion === 'source-branch-v1');
  await click('settings');
  check('Settings always exposes the explicit future branch policy', await page.locator('.branch-policy').count() === 1 && (await openPolicy()).includes('本局已明确保存独立分站准入版本'));

  if (diagnosticOnly) {
    for (let pass = 0; pass < 2; pass++) {
      await importState(sourceAt(original, 11), `diagnostic-old-pending11-${pass}`);
      await select('F6'); await page.reload(); await page.locator('.selection-card').waitFor(); await settleWorld();
      await click('settings'); await world(); await click('list'); await world();
    }
    await importState(original.createRun(1), 'diagnostic-original0');
    await page.locator('[data-primary-action]').click(); await visibleImages('diagnostic legal AVG');
    await world();
  } else {
  const pendingCases = [
    { label: 'original-pending11', source: sourceAt(original, 11), original: true, open: true },
    { label: 'before-pending11', source: sourceAt(before, 11), original: false, open: false },
    { label: 'original-explicit-source11', source: { ...sourceAt(original, 11), branchAccessRulesVersion: 'source-branch-v1' }, original: true, open: false },
    { label: 'before-explicit-public11', source: { ...sourceAt(before, 11), branchAccessRulesVersion: 'public-branch-v1' }, original: false, open: true },
  ];
  for (const c of pendingCases) {
    await importState(c.source, c.label); await select('F6');
    const text = await page.locator('.pending-branch-policy').innerText();
    check(`${c.label}: pending future label is conditional, not a built institution`, !branch(await readState()) && text.includes('第12年仍运转') && text.includes('未来条件说明，不是已经兑现') && text.includes(c.open ? '公开服务，不设缴费门槛' : '沿用商会收费准入'));
    if (!Object.hasOwn(c.source, 'branchAccessRulesVersion')) {
      const policy = await openPolicy('.selection-card > .branch-policy');
      check(`${c.label}: missing tag is a future default, never producer identification`, policy.includes('兼容默认') && policy.includes('不是对曾用引擎的鉴别') && policy.includes('不是完整回滚'));
    }
    check(`${c.label}: pending reading is byte-for-byte read-only`, await stateBytes() === JSON.stringify(c.source));
    await width(`${c.label}390`);
    if (c.label === 'original-pending11') await snap('original-pending-public-390', '.pending-branch-policy');
    await page.locator('[data-primary-action]').click(); await click('step');
    const expected = structuredClone(c.source); sim.advanceYear(expected);
    const independent = structuredClone(c.source); (c.original ? original : before).advanceYear(independent);
    const actual = await readState();
    check(`${c.label}: actual12 branch uses intended policy and unchanged source`, actual.year === 12 && branch(actual).open === c.open && branch(actual).sourceActionId === branch(expected).sourceActionId);
    check(`${c.label}: complete next-year state matches current engine clone`, same(actual, expected));
    check(`${c.label}: next-year cells/snapshots match real historical engine`, same(actual.cells, independent.cells) && same(actual.snapshots, independent.snapshots));
    if (!Object.hasOwn(c.source, 'branchAccessRulesVersion')) check(`${c.label}: full mechanics match its actual original engine`, same(mechanics(actual), mechanics(independent)));
    check(`${c.label}: earlier records and contracts remain byte-identical`, pastUnchanged(actual, c.source));
    await world(); await page.reload(); await page.locator('.selection-card').waitFor(); await settleWorld();
    check(`${c.label}: refresh preserves exact settled state and independent tag presence`, await stateBytes() === JSON.stringify(actual) && Object.hasOwn(await readState(), 'branchAccessRulesVersion') === Object.hasOwn(c.source, 'branchAccessRulesVersion'));
  }

  const mixed = sourceAt(original, 6); advance(before, mixed, 12);
  assert.equal(mixed.crisisRulesVersion, undefined); assert.equal(branch(mixed).open, false);
  await importState(mixed, 'mixed-original-identity-paid12'); await select('F6');
  const mixedPolicy = await openPolicy('.selection-card > .branch-policy');
  check('Mixed save explains public future without rewriting its already-paid branch', mixedPolicy.includes('公开分站规则') && mixedPolicy.includes('已存准入') && (await page.locator('.institution-status').innerText()).includes('收费门槛') && branch(await readState()).open === false);
  await snap('mixed-paid-future-public-390', '.selection-card');
  const oldBranch = structuredClone(branch(mixed)); await page.locator('[data-primary-action]').click(); await click('step');
  check('Mixed save remains paid after actual next-year settlement with past untouched', same(branch(await readState()), oldBranch) && pastUnchanged(await readState(), mixed));
  await world(); const mixedAfter = await stateBytes(); await page.reload(); await page.locator('.selection-card').waitFor(); await settleWorld();
  check('Mixed save stays byte-identical through refresh', await stateBytes() === mixedAfter);
  await click('settings'); const preserved = await stateBytes(), autosave = await savedBytes();
  const invalid = JSON.parse(preserved); invalid.branchAccessRulesVersion = 'unknown-branch-v99';
  await page.locator('#import-save').setInputFiles({ name: 'invalid-branch-version.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ state: invalid })) });
  await page.locator('.toast').waitFor();
  check('Invalid independent branch version rejects before touching current state or autosave bytes', (await page.locator('.toast').innerText()).includes('分站准入规则版本非法') && await stateBytes() === preserved && await savedBytes() === autosave);
  await page.locator('.toast').waitFor({ state: 'detached' });

  for (const c of [{ label: 'original0', s: original.createRun(1), large: false }, { label: 'coverage-explicit-public0', s: { ...sim.createRun(1), branchAccessRulesVersion: 'public-branch-v1' }, large: true }]) {
    await page.setViewportSize(c.large ? { width: 320, height: 568 } : { width: 390, height: 844 });
    await importState(c.s, c.label);
    if (c.large) { await click('settings'); await click('text-size'); check('Actual settings toggles200% text at320×568', await page.evaluate(() => getComputedStyle(document.documentElement).fontSize === '32px')); }
    const raw = await stateBytes(); await preview('build_merchant', { keyboard: c.large });
    const note = await page.locator('.building-contract').innerText();
    check(`${c.label}: free contract distinguishes paid D4 from conditional public F6`, note.includes('商会测站从第2年启用起就有缴费门槛') && note.includes('同源F6分站公开服务') && note.includes('不是已经兑现'));
    check(`${c.label}: free preview does not mutate world or establish future branch`, await stateBytes() === raw && !branch(await readState()));
    if (c.large) check('Explicit public policy with coverage keeps station0.45 and branch1', note.includes('D4测站覆盖系数为0.45') && note.includes('F6覆盖系数为1'));
    await width(`${c.label}preview`);
    if (!c.large) await snap('old-merchant-public-branch-contract-390', '.building-contract');
    if (c.large) await keyboardActivate(page.locator('[data-action="confirm"]'), '320/200% confirm'); else await click('confirm');
    if (c.large) await keyboardActivate(page.locator('[data-action="lock"]'), '320/200% lock'); else await click('lock');
    if (c.large) await keyboardActivate(page.locator('[data-task-contract-details] > summary').first(), '320/200% read locked contract');
    check(`${c.label}: locked whole-window repeats identical future contract`, await page.locator('.task-card .building-contract').innerText() === note);
    check(`${c.label}: locking does not pay or create institutions`, same((await readState()).cells, c.s.cells) && same((await readState()).institutions, c.s.institutions));
    await width(`${c.label}locked`);
    if (c.large) { await page.locator('[data-action="commit"]').focus(); await snap('public-branch-keyboard-submit-320-text200'); await keyboardActivate(page.locator('[data-action="commit"]'), '320/200% submit'); } else await click('commit');
    const expected = structuredClone(c.s); lock(before, expected, 'build_merchant'); submit(before, expected);
    check(`${c.label}: submitted raw contracts exactly match pre-fix engine, without display text rewriting`, same(await readState(), expected));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await importState(sim.createRun(12), 'actual-joint0');
  await uiLock('build_joint'); await uiToNext();
  check('Actual joint route reaches10 with successful public station', (await readState()).year === 10 && station(await readState()).open === true);
  await uiLock('renew_charter'); await click('commit'); await click('step');
  check('Actual renewal11 preserves Linche as an unrecruited caretaker', (await readState()).history.some(h => h.id === 'resolved:event:action:10:protagonist:D4:renew_charter') && !(await readState()).actors.some(a => a.id === 'linche'));
  await click('skip'); const naturalTwenty = await readState();
  const stayed = await finishRoute(naturalTwenty, 'present_archive', 'renewed-respected');
  check('Unrecruited Linche coda retains11 agreement and actual40 public service without lifetime employment', stayed.text.includes('第11年的章程') && stayed.text.includes('没有期限的劳动承诺') && stayed.text.includes('第40年，河港测站仍在运转，基本预警向不缴费家庭开放') && stayed.text.includes('不证明林澈此刻仍在值班'));
  await snap('linche-stayed-public-390', '.character-epilogue > article:first-of-type');
  await readSources('renewed-respected');
  const stopped = await finishRoute(naturalTwenty, 'relocate_teacher', 'renewed-relocated');
  check('Unrecruited Linche coda distinguishes stopped40 from staying public', stopped.text !== stayed.text && stopped.text.includes('第40年，河港测站已没有有效运转') && stopped.text.includes('第11年留下带教的约定仍留在原页'));
  check('Shutdown names21 protagonist contract consequence and unknown maintenance process', stopped.text.includes('第21年由主角执行的迁任合同的制度后果') && stopped.text.includes('具体维护中断过程没有记载') && !stopped.text.includes('林澈入局时留下'));
  await snap('linche-relocated-stopped-390', '.character-epilogue > article:first-of-type');
  const stoppedSources = await readSources('renewed-relocated');
  check('Stopped coda links actual11 renewal and21 relocation records', stoppedSources.includes('resolved:event:action:10:protagonist:D4:renew_charter') && stoppedSources.includes('resolved:event:action:20:protagonist:D4:relocate_teacher'));

  const fee20 = atTwenty(); assert.ok(fee20.history.find(h => h.id === 'charter-lapsed'));
  const repaired = await finishRoute(fee20, 'free_warning', 'paid-fee16-free21');
  check('Later free warning preserves real16 fee gap without assigning permanent personal maintenance', repaired.text.includes('第2年启用的商会测站原本就有收费门槛') && repaired.text.includes('第21年的免费预警协议另行补足') && repaired.text.includes('第16年的经费缺口仍留在原页') && repaired.text.includes('这不是林澈个人重新上岗的证明'));
  check('Fee16 raw source survives actual repair and ending', same(repaired.state.history.find(h => h.id === 'charter-lapsed'), fee20.history.find(h => h.id === 'charter-lapsed')));
  await readSources('paid-fee16-free21');
  const rebuilt = await finishRoute(atTwenty({ seed: 12, build: null, ten: 'restore_archive' }), 'relocate_teacher', 'anonymous-rebuilt-relocated');
  check('Rebuilt station remains anonymous, not a fabricated Sulan or Linche appointment', rebuilt.text.includes('新的维护小组，没有给这组人署上林澈或苏岚的姓名') && !rebuilt.text.includes('林澈愿意带教') && !rebuilt.text.includes('苏岚同意接班'));
  await readSources('anonymous-rebuilt-relocated');

  await page.setViewportSize({ width: 320, height: 568 }); await importState(stopped.state, 'stopped-ending320');
  await click('settings'); await click('text-size'); await ending();
  check('Final ending uses actual200% text setting', await page.evaluate(() => getComputedStyle(document.documentElement).fontSize === '32px'));
  await width('Linche ending320/200%');
  await readSources('stopped320/200%', { keyboard: true });
  const archiveControl = page.locator('.ending > .button-row > [data-action="archive"]');
  await archiveControl.focus(); await snap('linche-end-controls-320-text200');
  await keyboardActivate(archiveControl, '320/200% ending archive control');
  check('Keyboard ending control reaches archive without changing40 history', await page.locator('.archive-grid').count() === 1 && await stateBytes() === JSON.stringify(stopped.state));
  await ending(); const finalRaw = await stateBytes(); await page.reload(); await page.locator('.character-epilogue').waitFor(); await readEndingDetails(page);
  check('Refresh preserves exact ending, coda and actual200% setting', await stateBytes() === finalRaw && (await linche().innerText()) === stopped.text && await page.evaluate(() => getComputedStyle(document.documentElement).fontSize === '32px'));
  await width('Refreshed ending320/200%');
  }
  // Every requestfailed was recorded as an error at observation time. No
  // navigation, successful response or ready canvas can change that verdict.
  check('Current world canvases actually drew after asset loading', report.canvasReadiness.length > 0 && report.canvasReadiness.every(r => r.drawn && r.width > 0 && r.height > 0));
  report.canvasBoundaries = navigation.filter(n => n.kind.startsWith('canvas-'));
  check('Every visible scene/ending image completed and decoded at actual reading time', report.imageReadiness.some(r => r.images.length > 0) && report.imageReadiness.every(r => r.images.every(i => i.width > 0 && i.height > 0)));
  check('No page, console, requestfailed, HTTP asset or HMR errors', report.errors.length === 0, report.errors);
  }
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  if (page) await snap('branch-caretaker-failure').catch(() => {});
} finally {
  report.runtimeHash = { before: hashBefore, after: await runtimeHash() };
  try { check('Runtime and assets stayed frozen during complete browser run', same(report.runtimeHash.before, report.runtimeHash.after)); } catch (error) { report.failure ??= { message: error.message }; process.exitCode = 1; }
  report.counts = { passed: report.checks.filter(c => c.passed).length, failed: report.checks.filter(c => !c.passed).length, screenshots: report.screenshots.length, errors: report.errors.length, requestFailures: report.requestFailures.length, imageReadiness: report.imageReadiness.length, canvasReadiness: report.canvasReadiness.length };
  await fs.writeFile(`${out}/round14-branch-caretaker-${failureControlsOnly ? 'failure-handling-controls' : diagnosticOnly ? 'navigation-diagnostics' : 'results'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close(); if (server) await server.close();
}
