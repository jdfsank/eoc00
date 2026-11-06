import {readDecisionDetails} from './helpers/decision-reading.mjs';
import { chromium } from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-tradeoffs-simulation.js';
import { getCrisisOutlook } from '../src/crisis-outlook.js';
import { investigateAndLock } from '../tests/helpers/play.js';
import { evidenceFor } from '../src/story.js';

const out = 'playtest-output/round-17';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 4217, strictPort: true } });
await server.listen();
let browser, page;
const report = {
  scope: 'Real headless Chromium. Main route is clicked from fresh seed12 through pass0 → voluntary companion10 → linche D4 resident warning20, then compare before protagonist research. Additional states come from legal engine paths; malformed/pending cases are explicitly labelled. Engine clones are used only as independent action/settlement oracles, not to drive the main UI. Desktop, 390px, 320px/200% text; not a physical-device or human playtest certification.',
  checks: [], errors: [], oracles: [], screenshots: [],
};
const check = (name, ok) => { report.checks.push({ name, passed: !!ok }); assert.ok(ok, name); };
const click = async action => {await page.locator(`[data-action="${action}"]`).first().click();await readDecisionDetails(page);};
const choose = id => page.locator(`[data-action="choose"][data-id="${id}"]`).click();
const stateBytes = () => page.evaluate(() => JSON.stringify(window.afterwave.state));
const savedBytes = () => page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state));
const panel = () => page.locator('[data-investigation-comparison]');
const row = id => page.locator(`[data-comparison-option="${id}"]`);
const next = (state, api = sim) => { for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id); api.commitWindow(state); api.advanceToNextWindow(state); return state; };
function fixture({ seed = 12, opening = null, warning = true } = {}) {
  const state = sim.createRun(seed);
  if (opening) investigateAndLock(state, 'protagonist', opening === 'preserve_records' ? 'B4' : 'D4', opening);
  next(state); investigateAndLock(state, 'protagonist', 'D4', opening?.startsWith('build_') ? 'recruit_successor' : 'recruit_volunteer'); next(state);
  if (warning) investigateAndLock(state, 'linche', 'D4', 'free_warning');
  return state;
}
function oracle(state, id) {
  const copy = structuredClone(state);
  if (id === 'surveyed_veto') sim.investigate(copy, 'protagonist', 'B4', 'evacuation_routes');
  investigateAndLock(copy, 'protagonist', 'B4', id === 'review' ? 'independent_review' : 'local_veto');
  const outlook = getCrisisOutlook(copy);
  sim.commitWindow(copy); while (copy.year < 23) sim.advanceYear(copy);
  return { id, probability: outlook.attempts.find(a => a.actorId === 'protagonist')?.probability ?? 1, success: outlook.success, fallback: outlook.fallback, actual: copy.flags.crisis };
}
const restore = async (state, ui = {}) => {
  await page.evaluate(({ state, ui }) => sessionStorage.setItem('investigation-comparison.fixture', JSON.stringify({ state, ui })), { state, ui });
  await page.reload(); await page.locator('main h1,[data-primary-action]').first().waitFor();await readDecisionDetails(page);
};
const select = async (cell, actor = null) => {
  await click('home');
  if (actor) await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();
  await click('list'); await page.locator(`[data-action="select"][data-cell="${cell}"]`).click(); await page.locator('[data-primary-action]').click();
};
const investigate = async id => {
  const entry = page.locator(`[data-evidence-id="${id}"]`);
  if (!await entry.evaluate(el => el.open)) await entry.locator('summary').click();
  await entry.locator('[data-action="evidence"]').click();
};
const lock = async id => { await choose(id); await click('confirm'); await click('lock'); };
const screenshot = async (name, selector = null, fullPage = false) => {
  const path = `${out}/${name}.png`;
  if (selector) await page.locator(selector).screenshot({ path });
  else await page.screenshot({ path, fullPage });
  report.screenshots.push(path);
};
async function checkRowOracle(label, state, expectedProbability, expectedVeto, expectedBasic) {
  const readings = [];
  for (const id of ['review', 'surveyed_veto', 'basic_veto']) {
    const actual = oracle(state, id); readings.push(actual);
    if(await row(id).evaluate(el=>el.tagName==='DETAILS'&&!el.open))await row(id).locator(':scope > summary').click();
    const text = await row(id).innerText();
    check(`${label}: ${id} visibly ready with real costs and timing`, await row(id).getAttribute('data-ready') === 'true' && text.includes(id === 'review' ? '22' : '21'));
    check(`${label}: ${id} does not expose lock or investigate controls`, await row(id).locator('[data-action="lock"],[data-action="confirm"],[data-action="evidence"]').count() === 0);
    const branch = actual.actual.damage === 0 ? actual.success : actual.fallback;
    check(`${label}: ${id} actual settlement equals displayed conditional model`, actual.actual.damage === branch.damage && JSON.stringify(actual.actual.damageByCell) === JSON.stringify(branch.damageByCell));
    if (actual.fallback.possible) check(`${label}: ${id} shows the real rounded average ${actual.fallback.damage.toFixed(4)}`, text.includes(String(actual.fallback.damage)));
  }
  check(`${label}: exact preparation probability ${expectedProbability}%`, (await row('review').innerText()).includes(`${expectedProbability}%`));
  check(`${label}: surveyed/basic retained-warning losses match ${expectedVeto}/${expectedBasic}`, readings[1].fallback.damage === expectedVeto && readings[2].fallback.damage === expectedBasic);
  report.oracles.push({ label, alternatives: readings });
}

try {
  browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/assets/') && response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => { const fixture = sessionStorage.getItem('investigation-comparison.fixture'); if (fixture) { localStorage.setItem('afterwave.save.v1', fixture); sessionStorage.removeItem('investigation-comparison.fixture'); } });
  await page.goto('http://127.0.0.1:4217'); await page.locator('canvas').waitFor();
  // Full natural click route: no fixture or synthetic draft on the primary path.
  await click('window'); await page.locator('[data-action="pass"][data-actor="protagonist"]').click(); await click('commit'); await click('skip');
  await select('D4'); await lock('recruit_volunteer'); await click('commit'); await click('skip');
  await select('D4', 'linche'); await investigate('resident_testimony'); await lock('free_warning');
  await select('B4', 'protagonist'); await panel().waitFor();
  const untouched = await stateBytes(), natural = JSON.parse(untouched), hidden = evidenceFor(natural, 'anomaly_records', 'B4', 'protagonist').text;
  check('Natural click route reaches year20 with only linche warning locked and protagonist budget3', natural.year === 20 && natural.seed === '12' && natural.drafts.linche.actionId === 'free_warning' && !natural.drafts.protagonist && sim.getInvestigation(natural, 'protagonist', 'B4').budget === 3);
  check('Comparison is labelled read-only and placed before any real investigation control', (await panel().innerText()).includes('只读') && await page.evaluate(() => !!(document.querySelector('[data-investigation-comparison]').compareDocumentPosition(document.querySelector('.evidence-panel')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  check('Comparison retains linche actual warning and separates it from hypothetical protagonist choices', (await panel().innerText()).includes('林澈') && (await panel().innerText()).includes('居民传讯'));
  check('Comparison does not reveal unread anomaly text', !(await page.locator('main').innerText()).includes(hidden));
  await checkRowOracle('Natural seed12 pass/voluntary', natural, 55, .1886, .2830);
  check('Visible review conditions include nonrefundable cost and both possible branches', (await panel().innerText()).includes('不退') && await row('review').locator('[data-branch="success"]').count() === 1 && await row('review').locator('[data-branch="fallback"]').count() === 1);
  for (const details of await panel().locator('details').all()) { await details.locator('summary').click(); await details.locator('summary').click(); }
  await choose('independent_review'); check('Contract is freely readable while authoritative confirm is still disabled', await page.locator('.contract').isVisible() && await page.locator('[data-action="confirm"]').isDisabled());
  check('Contract repeats the same clearly labelled hypothesis rather than issuing a draft', await panel().count() === 1 && await stateBytes() === untouched);
  await click('avg'); await choose('local_veto'); await click('avg'); await page.reload(); await panel().waitFor();
  check('Reading, switching alternatives, closing details and reloading preserve world and stored world bytes', await stateBytes() === untouched && await savedBytes() === untouched);
  await screenshot('comparison-before-research-390', '[data-investigation-comparison]');
  await page.setViewportSize({ width: 1280, height: 960 }); await screenshot('comparison-before-research-desktop', '[data-investigation-comparison]');
  await page.setViewportSize({ width: 390, height: 844 });
  // Spend the real two rounds. The alternative must remain inaccessible, not merely warned.
  await investigate('anomaly_records'); const spent = await stateBytes();
  check('Actual anomaly investigation spends exactly two rounds', sim.getInvestigation(JSON.parse(spent), 'protagonist', 'B4').budget === 1);
  check('After spending, two-round survey is unreachable and has no invented whole-round outcome', await row('surveyed_veto').getAttribute('data-reachable') === 'false' && await row('surveyed_veto').getAttribute('data-ready') === 'false' && await row('surveyed_veto').locator('[data-branch]').count() === 0);
  const routes = page.locator('[data-evidence-id="evacuation_routes"]'); await routes.locator('summary').click();
  check('Real route-survey control remains disabled with only one round left', await routes.locator('[data-action="evidence"]').isDisabled());
  await screenshot('comparison-after-two-rounds-390', '[data-investigation-comparison]');
  await select('F6', 'protagonist'); check('Cross-location comparison cannot refund the spent portable evidence', sim.getInvestigation(JSON.parse(await stateBytes()), 'protagonist', 'F6').budget === 1 && await row('surveyed_veto').getAttribute('data-reachable') === 'false');
  await select('B4', 'protagonist'); await choose('local_veto'); await click('avg');
  check('Reopening the basic fallback never rewrites acquired evidence or returns rounds', await stateBytes() === spent && await savedBytes() === spent);
  await lock('independent_review'); const actualLocked = JSON.parse(await stateBytes());
  check('Only actual lock produces review draft, and does not pay costs', actualLocked.drafts.protagonist.actionId === 'independent_review' && JSON.stringify(actualLocked.cells) === JSON.stringify(natural.cells));
  check('True locked-plan outlook is still separate and ready only after both actors lock', await page.locator('.crisis-outlook').count() === 1 && (await page.locator('.crisis-outlook').innerText()).includes('55%') && await panel().count() === 0);
  const expected = oracle(natural, 'review').actual; await click('commit'); await click('skip');
  check('Real clicked submission settles the displayed review branch without rerolling', await page.evaluate(() => window.afterwave.state.flags.crisis.damage) === expected.damage);

  const failedReview = fixture({ seed: 0 });
  await restore(failedReview, { screen: 'world', selected: 'B4' }); await page.locator('[data-primary-action]').click();
  await checkRowOracle('Seed0 pass/voluntary failed review', failedReview, 55, .1886, .2830);
  check('Independent review oracles exercise both possible outcomes, not just successful seeds', report.oracles.some(entry => entry.alternatives.find(row => row.id === 'review').actual.damage === .9431) && report.oracles.some(entry => entry.alternatives.find(row => row.id === 'review').actual.damage === 0));

  const archive = fixture({ seed: 1, opening: 'preserve_records' });
  await restore(archive, { screen: 'world', selected: 'B4' }); await page.locator('[data-primary-action]').click();
  await checkRowOracle('Seed1 preserve/voluntary', archive, 80, .1886, .2830);
  const joint = fixture({ seed: 12, opening: 'build_joint' });
  await restore(joint, { screen: 'world', selected: 'B4' }); await page.locator('[data-primary-action]').click();
  await checkRowOracle('Seed12 joint/successor', joint, 100, .1239, .1859);
  check('Certain review has no impossible failure branch', await row('review').locator('[data-branch="success"]').count() === 1 && await row('review').locator('[data-branch="fallback"]').count() === 0);
  await screenshot('comparison-certain-review-390', '[data-investigation-comparison]');

  const retainedReview = fixture({ warning: false }); investigateAndLock(retainedReview, 'linche', 'F6', 'independent_review');
  await restore(retainedReview, { screen: 'avg', selected: 'B4' }); const retainedReviewBytes = await stateBytes();
  for (const id of ['surveyed_veto', 'basic_veto']) {
    if(await row(id).evaluate(el=>el.tagName==='DETAILS'&&!el.open))await row(id).locator(':scope > summary').click();
    const attempts = row(id).locator('.comparison-attempts');
    check(`Retained Linche review: ${id} identifies her55% year22 contract instead of implying a certain review`, await attempts.locator('li').count() === 1 && (await attempts.innerText()).includes('林澈') && (await attempts.innerText()).includes('F6') && (await attempts.innerText()).includes('55%') && (await attempts.innerText()).includes('22') && !(await row(id).innerText()).includes('整轮成功率'));
  }
  check('Reading retained-review alternatives never replaces the other actor contract or grants protagonist evidence', await stateBytes() === retainedReviewBytes && await savedBytes() === retainedReviewBytes && sim.getInvestigation(JSON.parse(retainedReviewBytes), 'protagonist', 'B4').budget === 3);
  await screenshot('comparison-retained-review-390', '[data-investigation-comparison]');

  for (const name of ['missing actor', 'same-cell conflict', 'unfunded retained warning', 'unknown pending contract']) {
    const state = fixture({ warning: name !== 'missing actor' });
    if (name === 'same-cell conflict') sim.lockTask(state, 'linche', 'B4', 'local_veto');
    if (name === 'unfunded retained warning') state.cells.find(cell => cell.id === 'D4').channels.economy = 0;
    if (name === 'unknown pending contract') state.events.push({ id: 'future-extension', actionId: 'future_extension', year: 22, cellId: 'D4', probability: 1, status: 'pending' });
    await restore(state, { screen: 'avg', selected: 'B4' }); const before = await stateBytes();
    check(`Labelled fixture ${name}: explains blocker without whole-round branches`, await panel().locator('.comparison-issues').count() > 0 && await panel().locator('[data-branch]').count() === 0 && await panel().locator('[data-ready="true"]').count() === 0);
    check(`Labelled fixture ${name}: reading never repairs or mutates the input`, before === JSON.stringify(state) && await stateBytes() === before);
    if (name === 'missing actor') await screenshot('comparison-other-actor-missing-390', '[data-investigation-comparison]');
  }
  const poor = fixture(); poor.cells.find(cell => cell.id === 'B4').channels.science = 0;
  await restore(poor, { screen: 'avg', selected: 'B4' });
  check('Unaffordable review withholds only its numbers and preserves payable alternatives', await row('review').getAttribute('data-ready') === 'false' && await row('review').locator('[data-branch]').count() === 0 && await row('basic_veto').getAttribute('data-ready') === 'true');

  const lockedBasic = fixture(); sim.lockTask(lockedBasic, 'protagonist', 'B4', 'local_veto');
  await restore(lockedBasic, { screen: 'avg', selected: 'B4' }); await investigate('evacuation_routes'); const afterSurvey = await stateBytes();
  check('Acquired route evidence never offers a fictitious new basic lock', await row('basic_veto').getAttribute('data-ready') === 'false' && await row('basic_veto').locator('[data-branch]').count() === 0);
  await click('window'); check('Existing basic snapshot remains0.30 until real relock despite newly acquired route evidence', (await page.locator('.crisis-outlook .fallback-summary').innerText()).includes('0.30') && (await page.locator('.commit-warnings').innerText()).includes('重新锁定') && await stateBytes() === afterSurvey);

  const legacy = old.createRun(12); next(legacy, old); next(legacy, old);
  await restore(legacy, { screen: 'avg', selected: 'B4' }); const legacyBytes = await stateBytes();
  check('Genuine old save has no new comparison and retains its original contract preview', await panel().count() === 0 && legacyBytes === JSON.stringify(legacy));
  await choose('independent_review'); check('Reading old contract does not migrate, grant evidence, or change stored world', await panel().count() === 0 && await page.locator('.contract').isVisible() && await stateBytes() === legacyBytes && await savedBytes() === legacyBytes);

  await page.setViewportSize({ width: 320, height: 568 });
  await restore(natural, { screen: 'avg', selected: 'B4' });
  await click('settings'); await click('text-size'); await select('B4', 'protagonist');
  check('320px/200% uses the real accessibility toggle with no horizontal page overflow', await page.locator('html').evaluate(el => el.classList.contains('large-text')) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('320px/200% keeps comparison and every row within the viewport', await panel().evaluate(el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }) && await page.locator('[data-comparison-option]').evaluateAll(nodes => nodes.every(el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; })));
  for (const details of await panel().locator('details').all()) {
    await details.locator('summary').focus(); await page.keyboard.press('Enter');
    check('320px/200% expanded regional explanation never overflows horizontally', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  check('320px/200% never wraps any average loss number across lines', await panel().locator('.comparison-outcome strong').evaluateAll(nodes => nodes.every(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size === 1;
  })));
  await panel().scrollIntoViewIfNeeded(); await panel().evaluate(el => el.scrollIntoView({ block: 'start' })); await screenshot('comparison-320-text200-heading');
  await screenshot('comparison-320-text200-review', '[data-comparison-option="review"]');
  await page.locator('[data-action="choose"][data-id="independent_review"]').focus(); await page.keyboard.press('Enter');
  check('Keyboard can reach unread contract at320/200% without crossing the actual evidence boundary', await page.locator('.contract').isVisible() && await page.locator('[data-action="confirm"]').isDisabled());
  await page.locator('[data-action="preview-evidence"]').focus(); await page.keyboard.press('Enter');
  check('Keyboard return still focuses the exact unpaid evidence summary after comparison', await page.locator('[data-evidence-id="anomaly_records"] summary').evaluate(el => document.activeElement === el));
  check('Accessibility toggles, keyboard expansion and navigation preserve every world byte', await stateBytes() === untouched && await savedBytes() === untouched);
  check('No browser script or asset errors', report.errors.length === 0);
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  if (page) await screenshot('failure', null, true).catch(() => {});
} finally {
  await fs.writeFile(`${out}/investigation-comparison-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close(); await server.close();
}
