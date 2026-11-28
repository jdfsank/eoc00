import {readDecisionDetails} from './helpers/decision-reading.mjs';
import { chromium } from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as prior from '../tests/fixtures/pre-future-check-simulation.js';
import { getRelocationDestination } from '../src/relocation-history.js';

// Run only after the owner explicitly freezes runtime/assets. Browser evaluate
// reads application state; every application action uses a visible UI control.
// Fixtures are produced by real annual simulation, never by assigning a year.
// The only synthetic inputs are separately labelled unknown-version and missing
// source boundaries, used to test rejection/truthful unknown presentation.
const out = process.env.AW_OUTPUT || 'playtest-output', ID = 'establish_future_check';
await fs.mkdir(out, { recursive: true });
const report = {
  scope: 'Round15 independent Chromium integration: future B4 checks and E4 relocation destination. Native engine saves imported through visible settings; true annual31/33/34/40 transitions;390×844 and320×568 with200% UI text and keyboard. No forced actions, injected state, illegal AVG, fabricated years, physical-device certification or old-history migration.',
  failureHandling: 'All requestfailed events are fatal, including aborted and blob requests. Readiness waits observe actual canvas pixels, complete decoded images and fonts; there are no failure exemptions or arbitrary sleeps.',
  baseline: '7fd0ee703d9339f7c2ef68c63f38819c221b8d27 / tests/fixtures/pre-future-check-simulation.js',
  checks: [], errors: [], screenshots: [], readiness: [], requestFailures: [], boundaries: [], fixtureEntries: [], keyboardTargets: [], focusNegativeControls: [],
};
const check = (name, ok, detail) => { report.checks.push({ name, passed: !!ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const future = s => s.events.find(e => e.actionId === ID);
const currentCheck = s => s.institutions.find(i => i.sourceEventId === future(s)?.id);
const historical = s => ({ crisis: s.flags.crisis, history: s.history.filter(h => h.year <= 30), events: s.events.filter(e => e.year <= 30), snapshots: Object.fromEntries(Object.entries(s.snapshots).filter(([year]) => +year <= 30)) });
// Preserve the exact previously existing records by identity/prefix. Legitimate
// new year30 action records must not be mistaken for rewritten earlier facts.
const pastUnchanged = (s, past) => same(s.flags.crisis, past.crisis)
  && same(s.history.slice(0, past.history.length), past.history)
  && past.events.every(e => same(s.events.find(item => item.id === e.id), e))
  && Object.entries(past.snapshots).every(([year, snapshot]) => same(s.snapshots[year], snapshot));
function choose(api, s, actor, cell, id, extra = []) {
  const action = api.getActions(s, cell, actor).find(a => a.id === id); assert.ok(action, `Native action ${s.year}/${actor}/${cell}/${id}`);
  for (const evidence of [...action.requireEvidence, ...extra]) if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
  api.lockTask(s, actor, cell, id);
}
function submit(api, s, tasks = []) {
  for (const task of tasks) choose(api, s, ...task);
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s); return s;
}
function decade(api, s, tasks = []) { submit(api, s, tasks); api.advanceToNextWindow(s); return s; }
function at30({ staff = true, review = false, preserve = false } = {}, api = sim) {
  const s = api.createRun(0);
  decade(api, s, preserve ? [['protagonist', 'B4', 'preserve_records']] : []);
  decade(api, s, [['protagonist', 'D4', preserve ? 'recruit_successor' : 'recruit_volunteer']]);
  decade(api, s, [['protagonist', 'B4', review ? 'independent_review' : 'local_veto', review ? [] : ['evacuation_routes']], ...(staff ? [['linche', 'E4', 'train_network']] : [])]);
  return s;
}
function at20(api = sim) { const s = api.createRun(12); decade(api, s); decade(api, s); return s; }
function relocated(api = sim) { return decade(api, at20(api), [['protagonist', 'D4', 'relocate_teacher']]); }
function until(api, s, year) { while (s.year < year) api.advanceYear(s); return s; }
function auditFixtureEntries() {
  const rows = [];
  const add = (label, s, cell, actor = 'protagonist', plannedNavigation = 'avg') => rows.push({ label, s: structuredClone(s), cell, actor, plannedNavigation });
  const seed = sim.createRun(0); add('natural0 pass via window', seed, 'D4', 'protagonist', 'window');
  const ten = decade(sim, structuredClone(seed)); add('natural10 recruit', ten, 'D4');
  const twenty = decade(sim, structuredClone(ten), [['protagonist', 'D4', 'recruit_volunteer']]); add('natural20 veto', twenty, 'B4'); add('natural20 training', twenty, 'E4', 'linche');
  const thirty = at30();
  for (const [label, cell, actor] of [['natural30/new-check', 'B4', 'linche'], ['natural30/withdraw/shared', 'D4', 'protagonist'], ['actor-evidence', 'B4', 'protagonist'], ['foreign-evidence', 'E4', 'linche'], ['narrow-future30', 'B4', 'linche']]) add(label, thirty, cell, actor);
  const emptyStaff = at30({ staff: false }); add('cancel30/new-check', emptyStaff, 'B4', 'linche'); add('cancel30/withdraw', emptyStaff, 'D4'); add('same-round31/training', emptyStaff, 'E4');
  add('real-pre-future-veto30', at30({}, prior), 'B4', 'linche', 'primary-history');
  const oldReview = at30({ review: true }, prior); add('real-pre-future-failed-review30', oldReview, 'B4', 'linche'); add('old-recovery/withdraw', oldReview, 'D4');
  const existing = sim.createRun(0); decade(sim, existing, [['protagonist', 'B4', 'preserve_records']]); decade(sim, existing); decade(sim, existing); add('genuine-existing-check30', existing, 'B4', 'protagonist', 'avg');
  add('current-genuine-failure30', at30({ review: true }), 'B4', 'linche');
  const relocation20 = at20(); add('relocation20 action', relocation20, 'D4'); choose(sim, relocation20, 'protagonist', 'D4', 'relocate_teacher'); add('locked-destination20', relocation20, 'E4', 'protagonist', 'archive'); submit(sim, relocation20); add('pending-destination20', relocation20, 'E4', 'protagonist', 'archive'); sim.advanceYear(relocation20); add('settled-destination21', relocation20, 'E4', 'protagonist', 'archive');
  const relocation30 = relocated(); add('destination30/narrow', relocation30, 'E4');
  for (const action of ['fund_school', 'train_network']) { const s = sim.createRun(12); decade(sim, s); decade(sim, s, action === 'fund_school' ? [['protagonist', 'E4', action]] : []); if (action === 'train_network') decade(sim, s, [['protagonist', 'E4', action]]); add(`anonymous-${action}`, s, 'E4'); }
  const companion = sim.createRun(12); decade(sim, companion, [['protagonist', 'D4', 'build_joint']]); decade(sim, companion, [['protagonist', 'D4', 'recruit_successor']]); decade(sim, companion, [['protagonist', 'D4', 'relocate_teacher'], ['linche', 'E4', 'train_network']]); add('separate-companion30', companion, 'E4');
  const missing = relocated(); missing.history = missing.history.filter(h => h.id !== 'resolved:event:action:20:protagonist:D4:relocate_teacher'); add('missing-destination-source-boundary', missing, 'E4');
  const annual = at30(); submit(sim, annual, [['linche', 'B4', ID], ['protagonist', 'D4', 'withdraw']]);
  for (const year of [30, 31, 32, 33, 34, 40]) { until(sim, annual, year); add(`future-native${year}`, structuredClone(annual), 'B4', 'linche', year === 40 ? 'ending' : 'playback'); }
  for (const { label, s, cell, actor, plannedNavigation } of rows) {
    const actions = sim.getActions(s, cell, actor).map(a => a.id), primaryAction = s.phase === 'playback' ? 'playback' : s.phase === 'ended' ? 'ending' : actions.length ? 'avg' : 'cell-history';
    report.fixtureEntries.push({ label, year: s.year, phase: s.phase, seed: s.seed, actorId: actor, cellId: cell, actions, primaryAction, plannedNavigation });
    assert.ok(plannedNavigation !== 'avg' || primaryAction === 'avg', `${label}: preflight rejects illegal AVG`);
    assert.ok(plannedNavigation !== 'primary-history' || primaryAction === 'cell-history', `${label}: preflight confirms read-only primary`);
    assert.ok(!['playback', 'ending'].includes(plannedNavigation) || plannedNavigation === primaryAction, `${label}: preflight confirms actual phase`);
  }
  check('All fixture entry routes pass explicit year/actor/cell/action preflight before browser launch', report.fixtureEntries.length === rows.length, report.fixtureEntries);
}
async function runtimeHash() {
  const files = []; async function walk(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const path = `${dir}/${entry.name}`; if (entry.isDirectory()) await walk(path); else if (entry.isFile()) files.push(path); } }
  await walk('src'); await walk('public/assets'); files.push('index.html'); const hash = createHash('sha256');
  for (const file of files.sort()) { hash.update(file); hash.update(await fs.readFile(file)); }
  return { sha256: hash.digest('hex'), files: files.length };
}
let server, browser, page;
const hashBefore = await runtimeHash();
const readState = () => page.evaluate(() => structuredClone(window.afterwave.state));
const stateBytes = () => page.evaluate(() => JSON.stringify(window.afterwave.state));
const savedBytes = () => page.evaluate(() => localStorage.getItem('afterwave.save.v1'));
async function settle(label = 'navigation') {
  if (await page.locator('#board').count()) {
    await page.waitForFunction(() => { const canvas = document.querySelector('#board canvas'); if (!canvas?.width || !canvas.height) return false; return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0); });
  }
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(i => i.complete && i.naturalWidth > 0));
  await page.locator('main img').evaluateAll(images => Promise.all(images.map(i => i.decode())));
  await page.evaluate(() => document.fonts.ready);
  report.readiness.push(await page.evaluate(label => ({ label, year: window.afterwave.state.year, screen: window.afterwave.ui.screen, canvas: !!document.querySelector('#board canvas'), images: [...document.querySelectorAll('main img')].map(i => ({ src: i.getAttribute('src'), width: i.naturalWidth, height: i.naturalHeight })) }), label));
}
async function click(action) { await page.locator(`[data-action="${action}"]`).first().click();await readDecisionDetails(page); await settle(action); }
async function world() { await click('home'); await page.locator('.selection-card').waitFor(); }
async function select(cell, actor = 'protagonist') {
  await world(); await click('list'); await page.locator(`[data-action="select"][data-cell="${cell}"]`).click(); await settle(`select ${cell}`);
  const actorButton = page.locator(`[data-action="actor"][data-actor="${actor}"]`); await actorButton.click(); await settle(`actor ${actor}`);
}
async function enter(cell, actor = 'protagonist') {
  assert.ok(sim.getActions(await readState(), cell, actor).length, `${cell}/${actor}: engine confirms this AVG is legal before navigating`);
  await select(cell, actor);
  check(`${cell}/${actor}: entered only through legal planning AVG`, await page.locator('[data-primary-action]').getAttribute('data-action') === 'avg');
  await page.locator('[data-primary-action]').click(); await settle(`AVG ${cell}/${actor}`);
}
async function importState(s, label) {
  check(`${label}: fixture passes current structural validation`, sim.validateState(s).valid);
  await click('settings'); await page.locator('#import-save').setInputFiles({ name: `round15-${label}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ state: s })) });
  await page.locator('.toast').waitFor(); const notice = await page.locator('.toast').innerText(); await page.locator('.toast').waitFor({ state: 'detached' }); await settle(`import ${label}`);
  check(`${label}: visible file import preserves exact state and autosave`, notice.startsWith('已导入') && await stateBytes() === JSON.stringify(s) && same(JSON.parse(await savedBytes()).state, s));
}
async function evidence(id) {
  const details = page.locator(`[data-evidence-id="${id}"]`); if (!await details.evaluate(e => e.open)) await details.locator('summary').click();
  await details.locator('[data-action="evidence"]').click(); await settle(`evidence ${id}`);
}
async function uiChoose(actor, cell, id, extra = []) {
  await enter(cell, actor); const s = await readState(), action = sim.getActions(s, cell, actor).find(a => a.id === id); assert.ok(action);
  for (const evidenceId of [...action.requireEvidence, ...extra]) if (!sim.getInvestigation(await readState(), actor, cell).evidence.includes(evidenceId)) await evidence(evidenceId);
  await page.locator(`[data-action="choose"][data-id="${id}"]`).click(); await settle(`preview ${id}`); await click('confirm'); await click('lock');
}
async function uiPass(actor) { await world(); await click('window'); await page.locator(`[data-action="pass"][data-actor="${actor}"]`).click(); await settle(`pass ${actor}`); }
async function uiNext() { await click('commit'); await click('skip'); await world(); }
async function layout(label) { check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth)); }
function strictFocusPredicate(g) {
  if (!g.focused || !g.focusVisible || g.horizontalOverflow || g.left < 0 || g.right > g.viewportWidth || g.visibleHeight <= 0 || !g.hits.every(Boolean)) return false;
  // Only a naturally oversized full choice-card may exceed the viewport.
  // It must fill the visible vertical area and remain unobscured throughout.
  // Normal-sized buttons retain the stricter whole-rectangle visibility rule.
  return g.height > g.viewportHeight
    ? g.choiceCard && g.top <= 0 && g.bottom >= g.viewportHeight && g.visibleHeight === g.viewportHeight
    : g.top >= 0 && g.bottom <= g.viewportHeight;
}
function verifyFocusPredicate() {
  const oversized = { focused: true, focusVisible: true, horizontalOverflow: false, left: 16, right: 304, viewportWidth: 320, top: -66, bottom: 635, height: 701, viewportHeight: 568, visibleHeight: 568, choiceCard: true, hits: [true, true, true] };
  assert.ok(strictFocusPredicate(oversized));
  for (const [name, changes] of [['wrong focused element', { focused: false }], ['missing keyboard focus outline', { focusVisible: false }], ['visible portion obstructed', { hits: [true, false, true] }], ['non-choice oversized control', { choiceCard: false }], ['horizontal overflow', { horizontalOverflow: true }], ['partially clipped ordinary button', { top: -2, bottom: 116, height: 118, visibleHeight: 116, choiceCard: false }]]) {
    const rejected = !strictFocusPredicate({ ...oversized, ...changes }); report.focusNegativeControls.push({ name, rejected }); assert.ok(rejected, `Focus negative control: ${name}`);
  }
}
async function keyboard(locator, label) {
  const beforeKeyboardReading = await stateBytes();
  let tabs = 0;
  do { await page.keyboard.press('Tab'); tabs++; } while (tabs < 100 && !await locator.evaluate(el => document.activeElement === el));
  const readGeometry = () => locator.evaluate(el => {
    const r = el.getBoundingClientRect(), footer = document.querySelector('.storage-bar'), f = footer?.getBoundingClientRect(), fixedClearance = !footer?.contains(el) && f?.height > 0 && f.left <= 0 && f.right >= innerWidth && f.bottom >= innerHeight && getComputedStyle(footer).position === 'fixed', available = fixedClearance ? f.top : innerHeight, upper = Math.max(0, r.top), lower = Math.min(available, r.bottom), visibleHeight = Math.max(0, lower - upper);
    const ys = [upper + Math.min(8, visibleHeight / 4), (upper + lower) / 2, lower - Math.min(8, visibleHeight / 4)];
    return { focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'), choiceCard: el.matches('.choice-card'), left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, viewportWidth: innerWidth, viewportHeight: available, nativeViewportHeight: innerHeight, reservedFooterHeight: innerHeight-available, visibleHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth, hitWitness: ys.map(y=>{const x=r.x+r.width/2,top=document.elementFromPoint(x,y);return {x,y,top:top?.tagName,cls:top?.className,ancestors:top?[...function*(n){for(let k=0;n&&k<5;k++,n=n.parentElement)yield [n.tagName,n.className,getComputedStyle(n).position]}(top)]:[]}}), hits: ys.map(y => { const top = document.elementFromPoint(r.x + r.width / 2, y); return top === el || el.contains(top); }) };
  });
  let geometry = await readGeometry();
  const tabGeometry = { ...geometry };
  const tabScrollY = await page.evaluate(()=>scrollY);
  let arrowDownKeys = 0;
  // Native Tab may leave a small reading margin above an oversized card.
  // Read further using real keys, without changing the visibility predicate,
  // forcing focus/scroll/style, or masking an obstruction or lost focus.
  const canReadFurther = g => g.focused && g.focusVisible && g.choiceCard && g.height > g.viewportHeight && g.top > 0 && g.bottom > g.viewportHeight && !g.horizontalOverflow && g.left >= 0 && g.right <= g.viewportWidth && g.visibleHeight > 0 && g.hits.every(Boolean);
  while (!strictFocusPredicate(geometry) && canReadFurther(geometry) && arrowDownKeys < 5) {
    const topBefore = geometry.top;
    await page.keyboard.press('ArrowDown'); arrowDownKeys++;
    await page.waitForFunction(top => document.activeElement?.getBoundingClientRect().top < top, topBefore, {timeout: 1000});
    geometry = await readGeometry();
  }
  check(`${label}: native keyboard reading leaves the entire world unchanged`, await stateBytes() === beforeKeyboardReading);
  report.keyboardTargets.push({ label, tabs, tabGeometry, arrowDownKeys, ...geometry });
  check(`${label}: native Tab${arrowDownKeys ? ' and arrow reading of the oversized card' : ''} reaches visible, outlined and unobscured keyboard target`, strictFocusPredicate(geometry), geometry);
  if (label==='320/200 future preview') {
    const bands=[];
    const sample=()=>locator.evaluate(el=>{
      const r=el.getBoundingClientRect(),b=document.querySelector('.storage-bar').getBoundingClientRect();
      const y=Math.max(r.top,0),end=Math.min(r.bottom,b.top),x=r.left+r.width/2;
      const hits=[y+8,(y+end)/2,end-8].map(v=>{const e=document.elementFromPoint(x,v);return el===e||el.contains(e)});
      return {from:y-r.top,to:end-r.top,total:r.height,scroll:scrollY,focused:document.activeElement===el&&el.matches(':focus-visible'),hits,y,end,footerTop:b.top};
    });
    const first=await sample();
    const tabFrom=Math.max(0,-tabGeometry.top),tabTo=Math.min(tabGeometry.bottom,tabGeometry.viewportHeight)-tabGeometry.top;
    bands.push({from:tabFrom,to:tabTo,total:tabGeometry.height,scroll:tabScrollY,focused:tabGeometry.focused&&tabGeometry.focusVisible,hits:tabGeometry.hits});
    if(first.scroll!==tabScrollY)bands.push(first);
    for(let i=0;i<36&&bands.at(-1).to<bands.at(-1).total-1;i++){
      const y=bands.at(-1).scroll;await page.keyboard.press('ArrowDown');
      await page.waitForFunction(y=>scrollY>y,y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      bands.push(await sample());
    }
    report.scrollableCardCoverage=bands;
    check('Keyboard alone reaches every band of the oversized card above the footer without losing visible focus',bands[0].from<=1&&bands.at(-1).to>=bands.at(-1).total-1&&bands.every((b,i)=>b.focused&&b.hits.every(Boolean)&&(i===0||b.from<=bands[i-1].to)),bands);
    check('Reading full card including bottom remains free',await stateBytes()===beforeKeyboardReading);
  }
  await page.keyboard.press('Enter'); await settle(label);
}
async function snap(name, selector) {
  await settle(name); const target = selector ? page.locator(selector).first() : null, box = target ? await target.boundingBox() : null;
  const element = box && box.height > 0 && box.height < 8192, path = `${out}/round15-${name}.png`;
  if (element) await target.screenshot({ path }); else await page.screenshot({ path, fullPage: false });
  const bytes = await fs.readFile(path), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20); assert.ok(height < 8192);
  report.screenshots.push({ path, width, height, kind: element ? 'element' : 'viewport', selector: selector || null });
}
async function reload(label) { const before = await stateBytes(); await page.reload(); await settle(`reload ${label}`); check(`${label}: refresh preserves exact world`, before === await stateBytes()); }
async function source(id, label, useKeyboard = false, scope = page) {
  const before = await stateBytes(), s = JSON.parse(before), record = s.history.find(h => h.id === id); assert.ok(record, `${label} actual source exists`);
  const button = scope.locator(`[data-action="trace"][data-id="${id}"]`).first(); if (useKeyboard) await keyboard(button, label); else { await button.click(); await settle(label); }
  check(`${label}: traces actual original record without mutation`, await page.evaluate(() => window.afterwave.ui.traceId) === id && (await page.locator('.causal-chain').innerText()).includes(record.text) && before === await stateBytes());
}
async function finish(label, expected, title) {
  await click('skip'); sim.advanceToNextWindow(expected); check(`${label}: actual40 exactly matches annual engine`, same(await readState(), expected));
  await click('ending'); check(`${label}: true ending has correct policy outcome`, await page.locator('.ending h1').innerText() === title); await settle(label); await layout(label); return readState();
}
try {
  verifyFocusPredicate();
  auditFixtureEntries();
  server = await createServer({ server: { host: '127.0.0.1', port: 4216, strictPort: true } }); await server.listen();
  browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(15000);
  const requestTimes = new WeakMap();
  page.on('pageerror', e => report.errors.push({ type: 'page', message: e.message }));
  page.on('console', m => { if (m.type() === 'error' || /\[vite\].*(hot updated|page reload)/.test(m.text())) report.errors.push({ type: 'console-or-HMR', message: m.text() }); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push({ type: 'http', status: r.status(), url: r.url() }); });
  page.on('request', r => requestTimes.set(r, Date.now()));
  page.on('requestfailed', r => { const failure = { url: r.url(), error: r.failure()?.errorText, type: r.resourceType(), startedAt: requestTimes.get(r), failedAt: Date.now() }; report.requestFailures.push(failure); report.errors.push({ type: 'requestfailed', ...failure }); });
  await page.goto('http://127.0.0.1:4216'); await page.locator('.selection-card').waitFor(); await settle('initial');
  check('New UI factory explicitly pins future-check-v1', (await readState()).futureCheckRulesVersion === 'future-check-v1');

  // Natural route, fully enacted in the UI from a genuine seed0 initial save.
  const natural = sim.createRun(0); await importState(natural, 'natural-seed0');
  await uiPass('protagonist'); await uiNext(); decade(sim, natural);
  await uiChoose('protagonist', 'D4', 'recruit_volunteer'); await uiNext(); decade(sim, natural, [['protagonist', 'D4', 'recruit_volunteer']]);
  await uiChoose('protagonist', 'B4', 'local_veto', ['evacuation_routes']);
  await uiChoose('linche', 'E4', 'train_network'); await uiNext(); decade(sim, natural, [['protagonist', 'B4', 'local_veto', ['evacuation_routes']], ['linche', 'E4', 'train_network']]);
  check('Natural UI reaches30 with actual .1904 crisis and no invented failed review', same(await readState(), natural) && natural.flags.crisis.damage === .1904 && !natural.events.some(e => e.actionId === 'independent_review') && sim.getRecoverySource(natural, 'B4') === null);
  const past = structuredClone(historical(natural));
  await enter('B4', 'linche'); const previewBefore = await stateBytes();
  await page.locator(`[data-action="choose"][data-id="${ID}"]`).click(); await settle('future free preview');
  const terms = await page.locator('.contract').innerText();
  check('Free preview explains6 economy/4 science, one slot,34 and nonrefundable workforce condition', /经济.*6/.test(terms) && /科学.*4/.test(terms) && terms.includes('1 次介入') && terms.includes('34') && terms.includes('取消') && terms.includes('不退'));
  check('Missing evidence blocks locking and preview leaves world byte-identical', await page.locator('[data-action="confirm"]').isDisabled() && await stateBytes() === previewBefore);
  await snap('future-free-preview-390', '.page'); await click('preview-evidence');
  check('Opening evidence entrance is free', await stateBytes() === previewBefore);
  await evidence('anomaly_records'); check('Anomaly records genuinely spend2 rounds', sim.getInvestigation(await readState(), 'linche', 'B4').budget === 1);
  await evidence('resident_testimony'); const investigated = await readState();
  check('B4 current residents spend the third round under the actual actor', sim.getInvestigation(investigated, 'linche', 'B4').budget === 0 && investigated.investigations['30:linche'].some(e => e.cellId === 'B4' && e.evidenceId === 'resident_testimony'));
  const noInvestigation = s => { const x = structuredClone(s); delete x.investigations; return x; };
  check('Evidence does not pay costs, advance years, alter history or reveal outcomes', same(noInvestigation(investigated), noInvestigation(natural)));
  await page.locator(`[data-action="choose"][data-id="${ID}"]`).click(); await click('confirm'); await click('lock');
  choose(sim, natural, 'linche', 'B4', ID);
  check('Lock saves one draft and spends no resources or future facts', same(await readState(), natural) && !future(natural));
  await uiChoose('protagonist', 'D4', 'withdraw'); choose(sim, natural, 'protagonist', 'D4', 'withdraw');
  const outlookBefore = await stateBytes(), currentText = await page.locator('[data-handoff-stage="current"]').innerText(), projectedText = await page.locator('[data-handoff-stage="projected"]').innerText(), allOutlook = await page.locator('.handoff-outlook').innerText();
  check('Whole-window projection explicitly schedules34, separates current absence and futureB4', currentText.includes('异源校验：无') && projectedText.includes('异源校验：B4') && projectedText.includes('E4 → B4') && allOutlook.includes('第34年') && allOutlook.includes('不是旧失败补做'));
  check('Projection reading leaves state and committed history untouched', outlookBefore === await stateBytes());
  await snap('future-whole-window-390', '.handoff-outlook'); await reload('locked future contract');
  await click('commit'); submit(sim, natural);
  check('Submission pays exactly once and records one genuine pending event', same(await readState(), natural) && natural.events.filter(e => e.actionId === ID).length === 1 && future(natural).status === 'pending' && !currentCheck(natural));
  check('New30 action is genuinely recorded exactly once without a fabricated failed review', natural.history.filter(h => h.id === 'action:30:linche:B4:establish_future_check' && h.kind === 'action' && h.status === 'confirmed').length === 1 && !natural.events.some(e => e.actionId === 'independent_review' || e.status === 'failed') && !natural.history.some(h => h.kind === 'failure' || h.status === 'failed') && pastUnchanged(natural, past));
  const committed = await stateBytes(); await reload('submitted future contract');
  check('Reload exposes no second submit action and retains paid state', await page.locator('[data-action="commit"]').count() === 0 && committed === await stateBytes());
  for (let year = 31; year <= 34; year++) {
    await click('step'); sim.advanceYear(natural);
    check(`Actual year${year} exactly matches source engine`, same(await readState(), natural));
    if (year < 34) check(`Year${year} does not turn a future contract into present capability`, future(natural).status === 'pending' && !currentCheck(natural) && !sim.getHandoffReadiness(natural).checkCells.includes('B4'));
    else check('At34 actual workforce creates one future-only check with no retroactive review or free trust', future(natural).status === 'success' && currentCheck(natural)?.startYear === 34 && natural.flags.review === undefined && natural.flags.trust === undefined && sim.getHandoffReadiness(natural).canWithdraw && !sim.getHandoffReadiness(natural).canShare && pastUnchanged(natural, past));
  }
  check('Actual34 still contains no invented past failed review or failure record', !(await readState()).events.some(e => e.actionId === 'independent_review' || e.status === 'failed') && !(await readState()).history.some(h => h.kind === 'failure' || h.status === 'failed'));
  const futureRecord = `resolved:${future(natural).id}`;
  await source(futureRecord, '34 future check source'); await reload('settled future source'); await click('home'); await click('playback');
  await finish('Natural withdrawal', natural, '没有唯一守夜人');
  check('40-year positive withdrawal preserves original23 loss and all old snapshots', natural.flags.crisis.damage === .1904 && pastUnchanged(natural, past));
  await snap('future-positive-ending-390', '.ending');

  // Evidence cannot be borrowed from another executor or another location.
  const evidenceBase = at30(); await importState(evidenceBase, 'evidence-actor-boundary');
  await enter('B4'); await evidence('anomaly_records'); await evidence('resident_testimony');
  await enter('B4', 'linche'); const actorBoundary = await stateBytes(); await page.locator(`[data-action="choose"][data-id="${ID}"]`).click();
  check('Protagonist evidence cannot unlock Linche contract', await page.locator('[data-action="confirm"]').isDisabled() && await stateBytes() === actorBoundary && sim.getInvestigation(await readState(), 'linche', 'B4').budget === 3);
  await importState(evidenceBase, 'evidence-location-boundary'); await enter('E4', 'linche'); await evidence('resident_testimony'); await enter('B4', 'linche'); await evidence('anomaly_records');
  check('Changing location does not restore the actor three-round budget', sim.getInvestigation(await readState(), 'linche', 'B4').budget === 0);
  await page.locator(`[data-action="choose"][data-id="${ID}"]`).click();
  check('E4 residents never substitute forB4 local testimony', await page.locator('[data-action="confirm"]').isDisabled() && (await page.locator('.missing-evidence').innerText()).includes('居民'));
  await click('preview-evidence'); const exhausted = page.locator('[data-evidence-id="resident_testimony"]');
  if (!await exhausted.evaluate(e => e.open)) await exhausted.locator('summary').click();
  check('Real exhausted budget disables a fourth local evidence purchase', await exhausted.locator('[data-action="evidence"]').isDisabled());
  await reload('exhausted local evidence');

  // Cancellation and same-round training each use real reachable source saves.
  for (const training of [false, true]) {
    const s = at30({ staff: false }), label = training ? '31-training-no-policy' : '34-no-workforce-cancellation'; await importState(s, label);
    await uiChoose('linche', 'B4', ID); choose(sim, s, 'linche', 'B4', ID);
    await uiChoose('protagonist', training ? 'E4' : 'D4', training ? 'train_network' : 'withdraw'); choose(sim, s, 'protagonist', training ? 'E4' : 'D4', training ? 'train_network' : 'withdraw');
    const text = await page.locator('.handoff-outlook').innerText();
    check(`${label}: projected conditional branch explains actual support`, text.includes('第34年') && (training ? text.includes('先行培训') && text.includes('未锁定交班方针') : text.includes('将取消，费用不退')));
    await snap(`${label}-projection-390`, '.handoff-outlook'); await click('commit'); submit(sim, s);
    const paid = structuredClone(s), preexisting = structuredClone(historical(s));
    for (let year = 31; year <= 34; year++) { await click('step'); sim.advanceYear(s); check(`${label}: actual${year} follows declared annual branch`, same(await readState(), s)); if (year === 31) check(`${label}:31-year training is not an early completed check`, sim.getRecoveryWorkforce(s).length === (training ? 1 : 0) && future(s).status === 'pending' && !currentCheck(s)); }
    check(`${label}:34 creates only the supported result and retains earlier history`, future(s).status === (training ? 'success' : 'cancelled') && !!currentCheck(s) === training && same(historical(s), preexisting));
    if (!training) { const control = structuredClone(paid); until(sim, control, 34); check('Cancellation has no refund or late second settlement path', same(control, s) && future(s).text.includes('不退')); }
    await reload(label); await finish(label, s, training ? '未签署的下一页' : '交班后的空椅子');
    check(`${label}: no automatic policy or trust award`, training ? s.flags.policy === undefined && s.flags.trust === undefined : s.flags.policy === 'withdraw');
  }
  const shared = at30(); await importState(shared, 'future-check-shared-without-trust');
  await uiChoose('linche', 'B4', ID); choose(sim, shared, 'linche', 'B4', ID);
  await uiChoose('protagonist', 'D4', 'share_power'); choose(sim, shared, 'protagonist', 'D4', 'share_power');
  check('Shared policy projection still requires distinct riverport trust', (await page.locator('[data-handoff-stage="projected"]').innerText()).includes('河港尚未作出合作承诺'));
  await click('commit'); submit(sim, shared); await finish('Future check without shared trust', shared, '纸上的共同作者');
  check('Actual completed future check does not grant shared authority or trust', sim.hasCompletedFutureCheck(shared) && !sim.getHandoffReadiness(shared).canShare && shared.flags.trust === undefined);

  // Genuine old saves stay untagged; old cheaper32-year recovery is unchanged.
  const old = at30({}, prior); await importState(old, 'real-pre-future-veto30'); await select('B4', 'linche');
  check('Published old save gains no future-check menu, illegal AVG or version tag', sim.getActions(await readState(), 'B4', 'linche').length === 0 && await page.locator('[data-primary-action]').getAttribute('data-action') === 'cell-history' && !Object.hasOwn(await readState(), 'futureCheckRulesVersion'));
  await page.locator('[data-primary-action]').click(); await settle('old B4 legal history'); check('Old B4 history offers no fabricated future action', await page.locator(`[data-action="choose"][data-id="${ID}"]`).count() === 0 && same(await readState(), old)); await reload('real old untagged menu');
  const oldReview = at30({ review: true }, prior); await importState(oldReview, 'real-pre-future-failed-review30'); await enter('B4', 'linche');
  check('Real failed-review history keeps old recovery and no from-zero duplicate', await page.locator('[data-action="choose"][data-id="complete_review"]').count() === 1 && await page.locator(`[data-action="choose"][data-id="${ID}"]`).count() === 0);
  await page.locator('[data-action="choose"][data-id="complete_review"]').click(); const oldTerms = await page.locator('.contract').innerText();
  check('Old complete_review remains4 economy/3 science and year32', /经济.*4/.test(oldTerms) && /科学.*3/.test(oldTerms) && oldTerms.includes('32'));
  await uiChoose('linche', 'B4', 'complete_review'); choose(prior, oldReview, 'linche', 'B4', 'complete_review'); await uiChoose('protagonist', 'D4', 'withdraw'); choose(prior, oldReview, 'protagonist', 'D4', 'withdraw');
  await click('commit'); submit(prior, oldReview); for (let year = 31; year <= 32; year++) { await click('step'); prior.advanceYear(oldReview); }
  check('Actual old32 recovery is byte-identical to published engine', same(await readState(), oldReview) && sim.hasCompletedRecovery(oldReview) && !sim.hasCompletedFutureCheck(oldReview));
  const existing = sim.createRun(0); decade(sim, existing, [['protagonist', 'B4', 'preserve_records']]); decade(sim, existing); decade(sim, existing); await importState(existing, 'genuine-existing-check30'); await select('B4');
  check('Existing activeB4 check suppresses redundant from-zero construction while allowing its distinct upgrade', !sim.getActions(await readState(), 'B4').some(a => a.id === ID) && sim.getActions(await readState(), 'B4').some(a => a.id === 'upgrade_archive_check') && await page.locator('[data-primary-action]').getAttribute('data-action') === 'avg');
  await page.locator('[data-primary-action]').click(); await settle('existing B4 legal upgrade menu'); check('Existing B4 source has no redundant from-zero construction menu and browsing stays read-only', await page.locator(`[data-action="choose"][data-id="${ID}"]`).count() === 0 && same(await readState(), existing));
  const failedCurrent = at30({ review: true }); await importState(failedCurrent, 'current-genuine-failure30'); await enter('B4', 'linche');
  check('Current genuine failed source prefers old cheaper recovery', await page.locator(`[data-action="choose"][data-id="${ID}"]`).count() === 0 && await page.locator('[data-action="choose"][data-id="complete_review"]').count() === 1);
  await click('settings'); const beforeBad = await stateBytes(), beforeSave = await savedBytes(), bad = structuredClone(failedCurrent); bad.futureCheckRulesVersion = 'future-check-unknown'; report.boundaries.push('Synthetic rejection only: the real failed-review30 save has its futureCheckRulesVersion replaced with an unknown string. No other data changed.');
  await page.locator('#import-save').setInputFiles({ name: 'round15-unknown-version.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ state: bad })) }); await page.locator('.toast').waitFor();
  check('Unknown future version rejects atomically without replacing current world or autosave', (await page.locator('.toast').innerText()).includes('未来校验规则版本非法') && beforeBad === await stateBytes() && beforeSave === await savedBytes()); await page.locator('.toast').waitFor({ state: 'detached' });

  // Natural E4 destination narrative, separate from companion relationship.
  const destinationState = at20(); await importState(destinationState, 'natural-relocation20'); await uiChoose('protagonist', 'D4', 'relocate_teacher'); choose(sim, destinationState, 'protagonist', 'D4', 'relocate_teacher');
  await select('E4'); await click('cell-history'); check('Locked relocation does not anticipate E4 destination', await page.locator('.relocation-destination').count() === 0);
  await world(); await click('window'); await click('commit'); submit(sim, destinationState);
  await select('E4'); await click('cell-history'); check('Pending relocation does not invent a finished school or destination source', await page.locator('.relocation-destination').count() === 0 && !destinationState.institutions.some(i => i.cellId === 'E4'));
  await world(); await click('playback'); await click('step'); sim.advanceYear(destinationState);
  await select('E4'); await click('cell-history'); const destinationId = 'resolved:event:action:20:protagonist:D4:relocate_teacher';
  check('Actual21 destination citesD4 outcome without moving or duplicating record', await page.locator('.relocation-destination').getAttribute('data-destination-status') === 'recorded' && same(await readState(), destinationState) && destinationState.history.filter(h => h.id === destinationId).length === 1 && destinationState.history.find(h => h.id === destinationId).cellId === 'D4');
  await source(destinationId, 'Actual21 E4 origin', false, page.locator('.relocation-destination')); await world(); await click('playback'); await click('skip'); sim.advanceToNextWindow(destinationState);
  await enter('E4'); const e4Before = await stateBytes(), prose = await page.locator('.prose').innerText();
  check('Natural30 E4 story states Sulan opposition without inventing consent or current personal employment', prose.includes('苏岚反对自己的意愿被一份旧履历替代') && prose.includes('不能') && await page.locator('.relocation-destination').getAttribute('data-destination-status') === 'recorded' && await page.locator('.relationship-response').count() === 0 && same(await readState(), destinationState));
  await snap('e4-destination-scene-390', '.page.reading'); await layout('E4 destination390');
  const dPanel = page.locator('.relocation-destination'); check('Destination source button keeps exact originalD4 resolved ID', await dPanel.locator('[data-action="trace"]').getAttribute('data-id') === destinationId && (await dPanel.innerText()).includes('D4'));
  await source(destinationId, 'E4 AVG original source', false, dPanel); await click('archive'); check('Returning from destination source spends nothing', await stateBytes() === e4Before); await reload('E4 original source return');
  await select('E4'); await click('cell-history'); const raw = destinationState.history.find(h => h.id === destinationId);
  check('E4 regional archive shows untouched originalD4 record text and source', (await page.locator('.history-list').innerText()).includes(raw.text) && await page.locator(`.history-list [data-action="trace"][data-id="${destinationId}"]`).count() >= 1 && await stateBytes() === e4Before);
  await snap('e4-regional-origin-390', '.history-list');
  for (const action of ['fund_school', 'train_network']) {
    const s = sim.createRun(12); decade(sim, s); decade(sim, s, action === 'fund_school' ? [['protagonist', 'E4', action]] : []); if (action === 'train_network') decade(sim, s, [['protagonist', 'E4', action]]);
    await importState(s, `anonymous-${action}`); await enter('E4'); const text = await page.locator('.prose').innerText();
    check(`${action}: real anonymous E4 teaching is never attributed to Sulan relocation`, await page.locator('.relocation-destination').count() === 0 && !text.includes('苏岚') && !text.includes('河港迁任在东岸留下') && same(await readState(), s));
  }
  const companion = sim.createRun(12);
  decade(sim, companion, [['protagonist', 'D4', 'build_joint']]);
  decade(sim, companion, [['protagonist', 'D4', 'recruit_successor']]);
  decade(sim, companion, [['protagonist', 'D4', 'relocate_teacher'], ['linche', 'E4', 'train_network']]);
  await importState(companion, 'separate-companion-destination30'); await enter('E4');
  check('Companion disagreement remains a separate relationship panel, not destination proof', await page.locator('.relationship-response').count() === 1 && (await page.locator('.relationship-response').innerText()).includes('我同意同行，不等于认可') && await page.locator('.relocation-destination .relationship-response').count() === 0 && await page.locator('.relocation-destination [data-action="trace"]').getAttribute('data-id') === destinationId && same(await readState(), companion));
  check('Anonymous same-window training retains its own independent school source', companion.institutions.filter(i => i.cellId === 'E4' && ['school', 'training'].includes(i.kind)).length >= 2 && (await page.locator('.prose').innerText()).includes('各自的来处'));
  await source(destinationId, 'Separate companion source', false, page.locator('.relationship-response'));
  const missingSource = relocated(); missingSource.history = missingSource.history.filter(h => h.id !== destinationId); report.boundaries.push('Synthetic missing-source display: only the real relocation outcome history record is removed from a naturally generated30 save. Retained school is not claimed as proof of personal history.');
  await importState(missingSource, 'missing-destination-source-boundary'); await enter('E4');
  check('Missing destination evidence stays unknown with no fabricated link or personal story', await page.locator('.relocation-destination').getAttribute('data-destination-status') === 'unknown' && await page.locator('.relocation-destination [data-action="trace"]').count() === 0 && !(await page.locator('.prose').innerText()).includes('苏岚反对自己的意愿被一份旧履历替代'));
  await reload('unknown destination source');

  // Narrow device + true200% setting + keyboard, not CSS/transformed screenshots.
  await page.setViewportSize({ width: 320, height: 568 }); await importState(at30(), 'narrow-future30'); await click('settings'); await click('text-size');
  check('320px uses genuine200% application text mode', await page.evaluate(() => window.afterwave.ui.bigText && getComputedStyle(document.documentElement).fontSize === '32px'));
  await enter('B4', 'linche'); await keyboard(page.locator(`[data-action="choose"][data-id="${ID}"]`), '320/200 future preview'); await layout('future320/200'); await snap('future-preview-320-text200', '.page');
  await keyboard(page.locator('[data-action="preview-evidence"][data-id="anomaly_records"]'), '320/200 evidence entrance'); await evidence('anomaly_records'); await evidence('resident_testimony');
  await keyboard(page.locator(`[data-action="choose"][data-id="${ID}"]`), '320/200 prepared choice'); await keyboard(page.locator('[data-action="confirm"]'), '320/200 confirm'); await keyboard(page.locator('[data-action="lock"]'), '320/200 lock');
  check('320/200 real keyboard locks only one costly draft, not a settlement', (await readState()).drafts.linche.actionId === ID && !future(await readState())); await layout('locked future320/200');
  await importState(destinationState, 'narrow-destination30'); await click('settings'); await click('text-size'); await enter('E4'); await layout('E4 destination320/200'); await snap('e4-destination-320-text200', '.relocation-destination');
  await source(destinationId, '320/200 E4 source keyboard', true, page.locator('.relocation-destination')); await layout('E4 source320/200'); await reload('320/200 source');
  await keyboard(page.locator('[data-action="archive"]').first(), '320/200 return archive'); await layout('E4 archive320/200');
  check('Destination read helper remains pure for the final saved state', (() => { const before = structuredClone(destinationState); getRelocationDestination(destinationState); return same(destinationState, before); })());

  report.runtimeHash = { before: hashBefore, after: await runtimeHash() }; check('Runtime and all assets stayed frozen throughout independent browser regression', same(report.runtimeHash.before, report.runtimeHash.after));
  check('No page, HTTP, asset, HMR or request failures', report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  if (page) { report.lastState = await readState().catch(() => null); report.lastScreen = await page.locator('body').innerText().catch(() => ''); await page.screenshot({ path: `${out}/round15-future-check-destination-failure.png`, fullPage: false }).catch(() => {}); }
} finally {
  report.runtimeHash ??= { before: hashBefore, after: await runtimeHash() };
  await fs.writeFile(`${out}/round15-future-check-destination-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, failed: report.checks.filter(c => !c.passed), errors: report.errors, failure: report.failure, runtimeHash: report.runtimeHash, screenshots: report.screenshots }, null, 2));
  if (browser) await browser.close(); if (server) await server.close();
}
