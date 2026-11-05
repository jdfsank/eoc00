// Original B4 library art. Preservation, unresolved history and current review
// have independent physical layers; no image predicts the next crisis result.
// This generator deliberately resolves explicit metadata, never name suffixes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {MONASTERY_ASSETS, MONASTERY_ASSET_STATES} from '../src/monastery-visuals.js';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const temple = await fs.readFile(path('public/assets/props/temple.svg'), 'utf8');
// Use the original landmark's exact geometry, including its stepped green roof,
// spire, amber flag, entry and ground anchor. Only new foreground layers vary.
const landmark = temple.replace(/^[\s\S]*?<desc>[\s\S]*?<\/desc>/, '').replace(/<\/svg>\s*$/, '').trim();
assert.match(landmark, /M 32 20 L 36 24/);
assert.match(landmark, /34,14 40,16 34,18/);
const states = new Map(MONASTERY_ASSET_STATES.map(state => [state.name, state]));
assert.equal(states.size, 27, 'B4 requires three archive states × nine review states.');
assert.equal(MONASTERY_ASSETS.length, 27);
assert.equal(new Set(MONASTERY_ASSETS).size, 27);
const archiveStates = ['none', 'kept', 'closed'];
const reviewStates = ['none', 'pending', 'failed', 'failed_closed', 'renewing', 'verified', 'recovered', 'closed', 'closed_recovered'];
for (const archive of archiveStates) for (const review of reviewStates) {
  const expected = `monastery_${archive}_${review}`;
  assert.ok(MONASTERY_ASSETS.includes(expected));
  assert.equal(states.get(expected)?.archive, archive);
  assert.equal(states.get(expected)?.review, review);
}
function stateFor(name) {
  const state = states.get(name);
  assert.ok(state, `Unknown B4 asset: ${name}`);
  return state;
}
function reviewParts(review) {
  return {
    pending: ['pending', 'renewing'].includes(review),
    failed: ['failed', 'failed_closed', 'renewing', 'recovered', 'closed_recovered'].includes(review),
    failedClosed: review === 'failed_closed',
    paired: ['verified', 'recovered'].includes(review),
    shut: ['closed', 'closed_recovered'].includes(review),
  };
}
function description({archive, review}) {
  return `B4 monastery library, original fixed-location artwork. Preserved records: ${archive}. Review workspace: ${review}. The stepped-roof library remains open as a landmark. The separate left cabinet preserves differing old flood-level records; retention alone is not a corrected crisis or successful independent review. A tied broken-line folio retains failed history. A blank order means work is pending, never an accomplished check. Completed paired ledgers appear only after successful review; retained old failure is separate. Closing either service covers only its own furniture. No people, casualties, disaster ruins, future flood result, or numeric forecast is depicted. Paper marks are illustrative, not measured quantities.`;
}

function sceneArchive(archive) {
  if (archive === 'none') return '';
  return `<g id="preserved-cabinet" data-archive="${archive}">
  <path d="M76 263l218-20 44 22-222 25Z" fill="#C4B48A" stroke="#294944" stroke-width="7"/>
  <path d="M76 263l40 27v146l-40-25Z" fill="#65715B" stroke="#294944" stroke-width="7"/>
  <path d="M116 290l222-25v147l-222 24Z" fill="#A69870" stroke="#294944" stroke-width="7"/>
  <path d="M131 301l192-21v113l-192 22Z" fill="#294944"/>
  <path d="M112 434v22M324 415v22" stroke="#294944" stroke-width="11"/>
  ${archive === 'closed' ? `<g id="preserved-closed">
    <path d="M128 298l198-22v125l-198 23Z" fill="#7D8271" stroke="#294944" stroke-width="6"/>
    <path d="M170 294v122M217 289v121M265 284v121" stroke="#576650" stroke-width="5"/>
    <path d="M126 324l200 52M128 400l195-99" stroke="#D0BE93" stroke-width="10"/>
    <path d="M205 347l34-4v30l-34 4Z" fill="#C6B58C" stroke="#294944" stroke-width="5"/>
  </g>` : `<g id="preserved-flood-records">
    <path d="M144 310l43-5v72l-43 5ZM204 303l43-5v72l-43 5ZM264 296l43-5v72l-43 5Z" fill="#E0D6B7"/>
    <path d="M145 310v72M205 303v72M265 296v72" stroke="#A28B61" stroke-width="7"/>
    <path d="M154 349l24-3M214 321l24-3M274 344l24-3" stroke="#426B65" stroke-width="6"/>
    <path d="M154 326v31M214 313v31M274 309v40" stroke="#83907A" stroke-width="3"/>
    <path d="M132 389l192-22v13l-192 22Z" fill="#A69870"/>
    <path d="M144 398l46-5v8l-46 5ZM203 392l46-5v8l-46 5ZM264 385l43-5v8l-43 5Z" fill="#C4B48A"/>
  </g>`}
  </g>`;
}
function sceneFailed(closed) {
  return `<g id="failed-folio" data-storage="${closed ? 'closed' : 'retained'}">
  <path d="M596 357l73-7 32 18-74 11Z" fill="#9C906C" stroke="#294944" stroke-width="5"/>
  <path d="M607 368v68M686 376v46" stroke="#796C50" stroke-width="9"/>
  <path d="M608 278l68-7v84l-68 9Z" fill="#C6B892" stroke="#294944" stroke-width="5"/>
  <path d="M615 295l19-3 10 15M654 305l13-10M616 330l19-3M652 326l15-2" fill="none" stroke="#6A7059" stroke-width="5"/>
  <path d="M641 274v85" stroke="#987A53" stroke-width="8"/>
  <path d="M632 312l17-2 6 7-13 7-12-5Z" fill="#987A53" stroke="#294944" stroke-width="3"/>
  ${closed ? `<g id="failed-storage-closed">
    <path d="M601 277l79-8 9 92-82 10Z" fill="#7D8271" stroke="#294944" stroke-width="6"/>
    <path d="M609 285l69 68M610 356l61-75" stroke="#C4B48A" stroke-width="8"/>
    <path d="M636 305l18-2v26l-18 3Z" fill="#A69870"/>
  </g>` : ''}
  </g>`;
}
function scenePending() {
  return `<g id="pending-order">
  <path d="M815 263v157M815 369l-32 62M815 369l36 59" stroke="#796C50" stroke-width="9"/>
  <path d="M762 261l107-11v111l-107 14Z" fill="#A69870" stroke="#294944" stroke-width="6"/>
  <path d="M772 271l87-9v88l-87 11Z" fill="#E0D6B7"/>
  <path d="M792 254l44-4v17l-44 5Z" fill="#796C50" stroke="#294944" stroke-width="3"/>
  <path d="M786 290l18-2v18l-18 2ZM786 323l18-2v18l-18 2Z" fill="none" stroke="#7C826B" stroke-width="4"/>
  <path d="M819 300l24-3M819 332l24-3" stroke="#B5AC8C" stroke-width="3"/>
  </g>`;
}
function sceneReviewTable(shut) {
  return `<g id="review-table" data-working="${!shut}">
  <path d="M700 350l199-22 65 47-207 30Z" fill="#B2A57C" stroke="#294944" stroke-width="7"/>
  <path d="M757 405l207-30v16l-207 30-57-41v-30Z" fill="#796C50" stroke="#294944" stroke-width="5"/>
  <path d="M714 384v57M768 413v58M941 393v57" stroke="#294944" stroke-width="13"/>
  <path d="M714 384v51M768 413v52M941 393v51" stroke="#A69870" stroke-width="6"/>
  ${shut ? `<g id="review-closure">
    <path d="M723 284l171-19 19 87-177 24Z" fill="#7D8271" stroke="#294944" stroke-width="6"/>
    <path d="M756 281l15 89M791 277l16 87M826 273l16 87M862 270l16 84" stroke="#526653" stroke-width="5"/>
    <path d="M730 292l174 50M741 361l147-86" stroke="#C4B48A" stroke-width="9"/>
    <path d="M715 365l32-4 20 17-33 5Z" fill="#C4B48A"/>
    <path d="M729 363l20 17" stroke="#796C50" stroke-width="5"/>
  </g>` : `<g id="paired-ledgers">
    <path d="M721 279l69-8 10 83-70 11ZM812 269l71-8 11 82-73 12Z" fill="#E0D6B7" stroke="#294944" stroke-width="5"/>
    <path d="M730 276l9 86M822 266l9 86" stroke="#A58D61" stroke-width="7"/>
    <path d="M744 297l34-4M746 315l34-4M748 333l34-4M835 287l34-4M837 305l34-4M839 323l34-4" stroke="#567B6D" stroke-width="5"/>
    <path d="M760 282l8 65M852 272l8 65" stroke="#A2A58A" stroke-width="3"/>
    <path d="M791 320l24-3" stroke="#C4B48A" stroke-width="6"/>
    <path d="M759 356l14-2 6 5-14 2ZM851 346l14-2 6 5-14 2Z" fill="#567B6D"/>
  </g>`}
  </g>`;
}
export function monasteryScene(name) {
  const state = stateFor(name), {archive, review} = state;
  const parts = reviewParts(review);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" shape-rendering="crispEdges" data-archive="${archive}" data-review="${review}">
<title>B4 monastery library: ${archive} preservation, ${review} review</title>
<desc>${description(state)}</desc>
<rect width="1000" height="500" fill="#A4B19B"/>
<path d="M0 127l106-43 76 27 106-55 118 49 105-37 120 47 125-58 100 55 144-37v247H0Z" fill="#718679"/>
<path d="M0 199l86-40 121 42 129-34 111 32 127-26 116 18 144-35 166 41v146H0Z" fill="#64796B"/>
<g id="library-courtyard">
  <path d="M0 306l490-52 510 58v188H0Z" fill="#7F8C77"/>
  <path d="M0 363l487-61 513 69v129H0Z" fill="#9A9C80"/>
  <path d="M383 315l133 16 108 169H241Z" fill="#B3AD8D"/>
  <path d="M0 415l467-57 533 65M0 480l448-67 552 68M126 500l149-172M734 500l-67-165" fill="none" stroke="#7C886F" stroke-width="5"/>
  <path d="M77 238l309-24 2 100-311 34ZM636 213l294 31v103l-294-33Z" fill="#7D8271" stroke="#294944" stroke-width="7"/>
  <path d="M69 237l17-72 289-23 20 71ZM629 213l19-71 274 33 18 70Z" fill="#365E59" stroke="#294944" stroke-width="7"/>
  <path d="M84 166l290-23M650 145l271 31" stroke="#658072" stroke-width="7"/>
  <path d="M105 252l113-10v69l-113 10ZM243 240l111-9v69l-111 10ZM667 236l109 11v66l-109-11ZM799 250l104 11v66l-104-11Z" fill="#294944"/>
  <path d="M115 264l16-2v33l-16 2ZM140 257l12-1v39l-12 1ZM160 265l21-2v30l-21 2ZM188 253l16-1v39l-16 1ZM253 251l17-1v35l-17 2ZM279 246l11-1v39l-11 1ZM300 254l21-2v29l-21 2ZM329 241l14-1v39l-14 1ZM677 247l16 2v36l-16-2ZM701 251l12 1v36l-12-1ZM722 259l23 2v31l-23-2ZM753 254l13 1v39l-13-1ZM809 263l13 1v37l-13-1ZM829 268l22 2v33l-22-2ZM859 266l12 1v39l-12-1ZM879 276l13 1v31l-13-1Z" fill="#B7A57C"/>
  <path d="M102 303l119-10M241 291l116-10M664 292l115 12M797 306l109 11" stroke="#A69870" stroke-width="8"/>
</g>
<g id="library-landmark" transform="translate(350 -25) scale(5)">${landmark}</g>
<path d="M481 312l30 14 31-14v14l-31 16-30-16Z" fill="#B8AE8B" stroke="#294944" stroke-width="4"/>
<path d="M468 331l43 21 45-22v13l-45 22-43-22Z" fill="#C3B693" stroke="#294944" stroke-width="4"/>
${sceneArchive(archive)}
<g id="review-workspace" data-review="${review}">
${parts.failed ? sceneFailed(parts.failedClosed) : ''}
${parts.pending ? scenePending() : ''}
${parts.paired || parts.shut ? sceneReviewTable(parts.shut) : ''}
</g>
<path d="M28 447v-37M44 444v-28M370 463v-28M385 458v-17M973 459v-33M957 456v-18" stroke="#61775F" stroke-width="6"/>
</svg>`;
}

function propArchive(archive) {
  if (archive === 'none') return '';
  return `<g id="preserved-cabinet" data-archive="${archive}">
  <path d="M4 48l14-7 8 5-14 7Z" fill="#C4B48A" stroke="#233C3B" stroke-width="2"/>
  <path d="M4 48l8 5v20l-8-5Z" fill="#65715B" stroke="#233C3B" stroke-width="2"/>
  <path d="M12 53l14-7v20l-14 7Z" fill="#A69870" stroke="#233C3B" stroke-width="2"/>
  ${archive === 'closed' ? `<g id="preserved-closed"><path d="M12 53l14-7v20l-14 7Z" fill="#7D8271"/>
    <path d="M13 54l12 11M13 69l12-20" stroke="#D0BE93" stroke-width="2"/>
    <path d="M17 59l5-2v5l-5 3Z" fill="#C6B58C" stroke="#233C3B"/></g>` : `<g id="preserved-flood-records">
    <path d="M13 55l3-2v12l-3 2ZM17 53l3-2v12l-3 2ZM21 51l3-2v12l-3 2Z" fill="#E0D6B7"/>
    <path d="M13 61l3-2M17 55l3-2M21 58l3-2" stroke="#426B65"/>
    <path d="M12 68l14-7" stroke="#233C3B" stroke-width="2"/>
  </g>`}</g>`;
}
function propFailed(closed) {
  return `<g id="failed-folio" data-storage="${closed ? 'closed' : 'retained'}">
  <path d="M35 64l8-4 5 3-8 5Z" fill="#9C906C" stroke="#233C3B"/>
  <path d="M36 49l8-4v17l-8 4Z" fill="#C6B892" stroke="#233C3B" stroke-width="2"/>
  <path d="M37 53l2 1M42 56l2-2M37 61l2-1" stroke="#526653"/>
  <path d="M40 47v17" stroke="#987A53" stroke-width="2"/>
  ${closed ? `<g id="failed-storage-closed"><path d="M35 49l10-5v19l-10 5Z" fill="#7D8271" stroke="#233C3B" stroke-width="2"/>
    <path d="M36 51l8 11M36 65l8-18" stroke="#C4B48A" stroke-width="2"/></g>` : ''}</g>`;
}
function propPending() {
  return `<g id="pending-order"><path d="M56 56v12M56 62l-4 7M56 62l4 5" stroke="#796C50" stroke-width="2"/>
  <path d="M49 42l12-5v19l-12 6Z" fill="#E0D6B7" stroke="#233C3B" stroke-width="2"/>
  <path d="M53 40l5-2v3l-5 2Z" fill="#796C50"/>
  <path d="M52 46l3-1v3l-3 1ZM52 53l3-1v3l-3 1Z" fill="none" stroke="#7C826B"/>
  </g>`;
}
function propTable(shut) {
  return `<g id="review-table" data-working="${!shut}">
  <path d="M44 61l12-6 7 5-12 7Z" fill="#B2A57C" stroke="#233C3B" stroke-width="2"/>
  <path d="M46 64v7M52 67v6M61 63v6" stroke="#796C50" stroke-width="2"/>
  ${shut ? `<g id="review-closure"><path d="M46 47l14-6v19l-14 7Z" fill="#7D8271" stroke="#233C3B" stroke-width="2"/>
    <path d="M47 49l12 10M47 64l12-20" stroke="#C4B48A" stroke-width="2"/>
    <path d="M52 46v16M56 44v17" stroke="#526653"/></g>` : `<g id="paired-ledgers">
    <path d="M45 47l6-3v16l-6 3ZM55 43l6-3v16l-6 3Z" fill="#E0D6B7" stroke="#233C3B" stroke-width="2"/>
    <path d="M47 51l3-1M47 55l3-1M57 47l3-1M57 51l3-1" stroke="#567B6D"/>
    <path d="M51 55l4-2" stroke="#C4B48A" stroke-width="2"/>
  </g>`}</g>`;
}
export function monasteryProp(name) {
  const state = stateFor(name), {archive, review} = state;
  const parts = reviewParts(review);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges" data-archive="${archive}" data-review="${review}" data-ground-anchor="32,64">
<title>B4 library: ${archive} preservation, ${review} review</title>
<desc>Transparent 2:1 dimetric prop. Ground anchor 32,64. ${description(state)}</desc>
<g id="library-landmark">${landmark}</g>
${propArchive(archive)}
<g id="review-workspace" data-review="${review}">
${parts.failed ? propFailed(parts.failedClosed) : ''}
${parts.pending ? propPending() : ''}
${parts.paired || parts.shut ? propTable(parts.shut) : ''}
</g>
</svg>`;
}

async function generate() {
  for (const name of MONASTERY_ASSETS) {
    await fs.writeFile(path(`public/assets/${name.replaceAll('_', '-')}.svg`), monasteryScene(name));
    await fs.writeFile(path(`public/assets/props/${name}.svg`), monasteryProp(name));
  }
  const browser = await chromium.launch({executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 64, height: 80}, deviceScaleFactor: 2});
    for (const name of MONASTERY_ASSETS) {
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${monasteryProp(name)}`);
      await page.screenshot({path: path(`public/assets/props/${name}.png`).pathname, omitBackground: true});
    }
  } finally {
    await browser.close();
  }
  console.log(`${MONASTERY_ASSETS.length} original B4 scenes (1000 × 500), SVG props (64 × 80), and transparent PNG props (128 × 160) generated. Ground anchor: 32,64.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await generate();
