// Original D4 access artwork. One existing station, two independent access
// policies and five operating conditions. Explicit metadata, never suffix tests.
// The original room/building/gauge/pier/shelf geometry is retained verbatim.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
export const STATION_ACCESS_SCENE_STATES = Object.freeze([
  {name: 'river-station-fee-active', access: 'fee', condition: 'active'},
  {name: 'river-station-fee-maintenance', access: 'fee', condition: 'maintenance'},
  {name: 'river-station-fee-understaffed', access: 'fee', condition: 'understaffed'},
  {name: 'river-station-fee-maintenance-understaffed', access: 'fee', condition: 'maintenance-understaffed'},
  {name: 'river-station-fee-stopped', access: 'fee', condition: 'stopped'},
  {name: 'river-station-public-active', access: 'public', condition: 'active'},
  {name: 'river-station-public-maintenance', access: 'public', condition: 'maintenance'},
  {name: 'river-station-public-understaffed', access: 'public', condition: 'understaffed'},
  {name: 'river-station-public-maintenance-understaffed', access: 'public', condition: 'maintenance-understaffed'},
  {name: 'river-station-public-stopped', access: 'public', condition: 'stopped'},
].map(Object.freeze));
export const STATION_ACCESS_PROP_STATES = Object.freeze([
  {name: 'river_station_fee', access: 'fee', condition: 'active'},
  {name: 'river_station_public', access: 'public', condition: 'active'},
  {name: 'river_station_closed_fee', access: 'fee', condition: 'stopped'},
  {name: 'river_station_closed_public', access: 'public', condition: 'stopped'},
].map(Object.freeze));
const sceneStates = new Map(STATION_ACCESS_SCENE_STATES.map(state => [state.name, state]));
const propStates = new Map(STATION_ACCESS_PROP_STATES.map(state => [state.name, state]));
const conditions = Object.freeze({
  active: {stopped: false, maintenance: false, understaffed: false},
  maintenance: {stopped: false, maintenance: true, understaffed: false},
  understaffed: {stopped: false, maintenance: false, understaffed: true},
  'maintenance-understaffed': {stopped: false, maintenance: true, understaffed: true},
  stopped: {stopped: true, maintenance: false, understaffed: false},
});
function stateFor(states, name) {
  const state = states.get(name);
  assert.ok(state, `Unknown D4 access artwork: ${name}`);
  return {...state, ...conditions[state.condition]};
}
function description({access, stopped, maintenance, understaffed}) {
  return `Original D4 river station artwork. The same existing station, river gauge, pier and stored records remain. ${access === 'fee' ? 'An open payment register, coin tray and narrow service list identify fee access.' : 'A broad public notice identifies public access, without a payment register or coin tray.'} Access is independent of staffing and maintenance. ${stopped ? 'The station is closed, records remain, and the lamp is unlit. The old access furniture is retained but crossed and bound; no public or fee service continues.' : `${maintenance ? 'A roof repair patch shows maintenance needs only. ' : ''}${understaffed ? 'Empty duty slots show missing staff only. ' : 'The duty board remains fully occupied. '}${!maintenance ? 'The roof is not depicted as broken. ' : ''}Operation and public access do not imply averted flood damage.`} Marks are illustrative, not numerical staffing or protection forecasts.`;
}
function sceneAccess({access, stopped}) {
  // Foreground furniture is wholly below/left of the gauge and duty board.
  const fee = access === 'fee';
  return `<g id="station-access" data-access="${access}" data-working="${!stopped}">
  <g id="access-counter"><path d="M103 382l171-24 61 40-177 25Z" fill="#A79B77" stroke="#29453F" stroke-width="6"/>
  <path d="M103 382l55 41 177-25v15l-177 26-55-40Z" fill="#796C50" stroke="#29453F" stroke-width="5"/>
  <path d="M121 409v42M167 437v37M317 414v34" stroke="#29453F" stroke-width="11"/></g>
  ${fee ? `<g id="access-fee-register">
    <g id="fee-service-list"><path d="M276 368v-89" stroke="#796C50" stroke-width="10"/>
    <path d="M242 287l77-9v92l-77 10Z" fill="#A3916B" stroke="#29453F" stroke-width="6"/>
    <path d="M251 296l59-7v71l-59 8Z" fill="#D3C5A0"/>
    <path d="M259 310l43-5M259 327l43-5M259 345l43-5" stroke="#52695C" stroke-width="6"/>
    <path d="M279 300v55" stroke="#A3916B" stroke-width="3"/></g>
    <g id="fee-payment-book"><path d="M113 368l60-14 33 15 28-19 41 11-49 44-55 9Z" fill="#796C50" stroke="#29453F" stroke-width="5"/>
    <path d="M115 361l59-14 32 15 27-19 40 11-48 42-54 9Z" fill="#E0D6B7" stroke="#29453F" stroke-width="5"/>
    <path d="M206 362l-35 43" stroke="#796C50" stroke-width="5"/>
    <path d="M131 365l30-7M142 378l28-6M223 365l24-13M213 380l23-13" stroke="#7C8873" stroke-width="4"/></g>
    <g id="fee-coin-tray"><path d="M280 387l30-4 17 11-30 6Z" fill="#796C50" stroke="#29453F" stroke-width="4"/>
    <path d="M290 378l10-5 11 5v9l-10 5-11-5Z" fill="#C8AE71" stroke="#29453F" stroke-width="4"/>
    <path d="M301 377v10" stroke="#796C50" stroke-width="3"/></g>
  </g>` : `<g id="access-public-notice">
    <path d="M127 386v45M293 367v45" stroke="#796C50" stroke-width="11"/>
    <path d="M105 299l213-24v119l-213 26Z" fill="#A3916B" stroke="#29453F" stroke-width="7"/>
    <path d="M116 309l191-22v95l-191 24Z" fill="#D3C5A0"/>
    <path d="M133 324l155-18" stroke="#52695C" stroke-width="10"/>
    <path d="M133 347l155-19M133 368l155-19M133 389l107-13" stroke="#7C8873" stroke-width="6"/>
  </g>`}
  ${stopped ? `<g id="access-closed-binding">
    ${fee ? `<path d="M244 296l73 65M245 370l70-84M120 355l106 45M133 397l115-44" fill="none" stroke="#29453F" stroke-width="14"/>
    <path d="M244 296l73 65M245 370l70-84M120 355l106 45M133 397l115-44" fill="none" stroke="#B3A37A" stroke-width="7"/>
    <path d="M266 317l25-3v29l-25 3Z" fill="#A3916B" stroke="#29453F" stroke-width="5"/>` : `<path d="M111 306l200 80M112 410l199-126" fill="none" stroke="#29453F" stroke-width="17"/>
    <path d="M111 306l200 80M112 410l199-126" fill="none" stroke="#B3A37A" stroke-width="9"/>
    <path d="M195 333l31-4v32l-31 4Z" fill="#A3916B" stroke="#29453F" stroke-width="6"/>`}
  </g>` : ''}
  </g>`;
}
function dutyBoard({stopped, understaffed}) {
  const filled = stopped ? 0 : understaffed ? 2 : 4;
  const occupied = [], vacant = [];
  for (let n = 0; n < 4; n++) {
    const x = 656 + (n % 2) * 108, y = 88 + Math.floor(n / 2) * 61;
    (n < filled ? occupied : vacant).push(n < filled
      ? `<path d="M${x} ${y}h81v40h-81Z" fill="#D3C5A0"/><path d="M${x+13} ${y+12}h53M${x+13} ${y+23}h39" stroke="#7C8873" stroke-width="4"/>`
      : `<path d="M${x} ${y}h81v40h-81Z" fill="#2B4944" stroke="#7C8873" stroke-width="3"/><path d="M${x+14} ${y+20}h53" stroke="#52695C" stroke-width="3"/>`);
  }
  return `<g id="station-duty-board"><path d="M632 66h255v155H632Z" fill="#A3916B"/>
  <path d="M644 78h231v131H644Z" fill="#233F3C"/>${occupied.join('')}
  ${understaffed ? `<g id="staffing-vacancies">${vacant.join('')}</g>` : vacant.join('')}
  ${stopped ? '<path d="M649 169l213-65M655 109l207 66" stroke="#233F3C" stroke-width="17"/><path d="M649 169l213-65M655 109l207 66" stroke="#A3926C" stroke-width="9"/>' : ''}</g>`;
}
export function stationAccessScene(name) {
  const state = stateFor(sceneStates, name), {access, condition, stopped, maintenance} = state;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" shape-rendering="crispEdges" data-access="${access}" data-station-state="${condition}">
<title>D4 river station: ${access} access, ${condition}</title><desc>${description(state)}</desc>
<rect width="1000" height="500" fill="#163337"/>
<path d="M0 48h1000v15H0ZM0 324h1000v15H0Z" fill="#365854"/>
<path d="M0 365h1000v135H0Z" fill="#29453F"/>
<path d="M0 425l1000-37v26L0 455Z" fill="#3E584B"/>
<g id="original-record-room"><path d="M68 38h505v312H68Z" fill="#B2A47C"/>
<path d="M83 53h475v281H83Z" fill="#203E3C"/>
<path d="M98 68h445v249H98Z" fill="#ACBDA8"/>
<path d="M98 161l63-50 71 27 56-42 94 47 60-31 101 58v147H98Z" fill="#708B79"/>
<path d="M98 224l445-35v128H98Z" fill="#4B7975"/>
<path d="M98 250l445-31M140 291l310-23" stroke="#97B3A2" stroke-width="8"/>
<g id="station-pier"><path d="M340 242l159-13v16l-159 14Z" fill="#A19370"/>
<path d="M351 250v45M477 238v43" stroke="#4E6254" stroke-width="9"/></g>
<g id="station-building"><path d="M350 162h104v80H350Z" fill="#8D967D"/>
<path d="M350 162h58v80h-58Z" fill="#B9AF8C"/>
<path d="M340 163l61-44 66 43-58 15Z" fill="#365E59"/>
<path d="M340 163l69 14v9l-69-15ZM409 177l58-15v9l-58 15Z" fill="#254843"/>
${maintenance ? '<g id="maintenance-roof-patch"><path d="M400 133l34 9-12 13-34-10Z" fill="#A79772"/><path d="M396 139l29 8" stroke="#6D715A" stroke-width="3"/></g>' : ''}
${stopped ? '<g id="station-closed-shutters"><path d="M365 185h29v30h-29ZM418 187h24v55h-24Z" fill="#7A7B62"/><path d="M364 189l31 20M365 211l29-20M417 194l27 37M417 231l27-37" stroke="#B3A37A" stroke-width="5"/></g>' : '<path d="M368 185h11v25h-11ZM386 185h8v25h-8ZM422 188h14v46h-14Z" fill="#D8C69B"/>'}</g>
<g id="river-gauge"><path d="M502 143h15v144h-15Z" fill="#284740"/>
<path d="M506 148h7v134h-7Z" fill="#D2C5A2"/>
<path d="M506 159h7M506 179h7M506 199h7M506 219h7M506 239h7M506 259h7M506 279h7" stroke="#657B69" stroke-width="4"/></g>
<path d="M269 59v270" stroke="#284B44" stroke-width="12"/></g>
${dutyBoard(state)}
<g id="record-shelf"><path d="M607 245h323v111H607Z" fill="#1D3C39"/>
<path d="M619 260h299v9H619ZM619 338h299v10H619Z" fill="#566D5D"/>
<path d="M634 276h23v57h-23ZM667 288h20v45h-20ZM704 281h29v52h-29ZM772 276h22v57h-22ZM808 284h30v49h-30ZM860 278h35v55h-35Z" fill="#AAA080"/></g>
<path d="M170 360l575-20 141 95-622 38Z" fill="#A79B77"/>
<path d="M264 473l622-38v28l-622 32Z" fill="#4D5A48"/>
<g id="station-work-record"><path d="M340 366l177-5 69 58-189 10Z" fill="#CDBF99"/>
${stopped ? '<path d="M350 375l176-5 50 42-177 9Z" fill="#8C8E73"/><path d="M440 366l10 58" stroke="#CEC39D" stroke-width="7"/>' : '<path d="M375 380l123-4M388 393l123-4M401 407l123-5" stroke="#7B8064" stroke-width="4"/>'}</g>
<g id="station-lamp" data-lit="${!stopped}"><path d="M692 329h48v66h-48ZM680 329h73v11h-73Z" fill="#28483F"/>
${stopped ? '<path d="M704 304h24v32h-24Z" fill="#697263"/><path d="M712 288h8v17h-8Z" fill="#29453F"/>' : '<path d="M704 304h24v32h-24Z" fill="#C8AE71"/><path d="M712 278h8v27h-8Z" fill="#E5C87C"/>'}</g>
${sceneAccess(state)}
</svg>`;
}

const originalProp = await fs.readFile(path('public/assets/props/water_station.svg'), 'utf8');
const landmark = originalProp.replace(/^[\s\S]*?<desc>[\s\S]*?<\/desc>/, '').replace(/<\/svg>\s*$/, '').trim();
assert.match(landmark, /26,30 42,38 26,46 10,38/);
assert.match(landmark, /M 44 30 H 52 V 66 L 48 68 L 44 66 Z/);
function propAccess({access, stopped}) {
  const fee = access === 'fee';
  // All access additions stay left of x22. Runtime duty-board overlays occupy
  // x22..40,y59..77; maintenance patches occupy the original upper-left roof.
  return `<g id="station-access" data-access="${access}" data-working="${!stopped}">
  <path d="M1 68l12-6 8 5-13 7Z" fill="#A79B77" stroke="#233C3B" stroke-width="1.5"/>
  <path d="M4 71v5M17 70v5" stroke="#796C50" stroke-width="2"/>
  ${fee ? `<g id="access-fee-register">
    <g id="fee-service-list"><path d="M8 62v-14" stroke="#796C50" stroke-width="2"/>
    <path d="M3 51l9-3v14l-9 3Z" fill="#D3C5A0" stroke="#233C3B" stroke-width="1.5"/>
    <path d="M5 54l5-2M5 58l5-2M5 62l5-2" stroke="#52695C" stroke-width="1.5"/></g>
    <g id="fee-payment-book"><path d="M1 66l6-3 4 2 4-4 6 3-7 7-7 1Z" fill="#E0D6B7" stroke="#233C3B" stroke-width="1.5"/>
    <path d="M11 65l-4 7M3 67l4-2M13 67l4-3" stroke="#796C50" stroke-width="1"/></g>
    <g id="fee-coin-tray"><path d="M15 59l3-2 3 2v3l-3 2-3-2Z" fill="#C8AE71" stroke="#233C3B" stroke-width="1.5"/>
    <path d="M18 59v3" stroke="#796C50"/></g>
  </g>` : `<g id="access-public-notice"><path d="M4 70v6M18 68v7" stroke="#796C50" stroke-width="2"/>
    <path d="M1 58l19-3v14L1 72Z" fill="#D3C5A0" stroke="#233C3B" stroke-width="1.5"/>
    <path d="M4 61l13-2" stroke="#52695C" stroke-width="2"/>
    <path d="M4 65l13-2M4 69l9-1.5" stroke="#7C8873" stroke-width="1.5"/>
  </g>`}
  ${stopped ? `<g id="access-closed-binding">${fee ? '<path d="M4 52l7 9M4 63l7-13M2 65l13 6M4 71l14-8" stroke="#233C3B" stroke-width="3"/><path d="M4 52l7 9M4 63l7-13M2 65l13 6M4 71l14-8" stroke="#B3A37A" stroke-width="1.5"/>' : '<path d="M2 59l17 9M2 71l17-15" stroke="#233C3B" stroke-width="3"/><path d="M2 59l17 9M2 71l17-15" stroke="#B3A37A" stroke-width="1.5"/>'}</g>` : ''}
  </g>`;
}
export function stationAccessProp(name) {
  const state = stateFor(propStates, name), {access, condition, stopped} = state;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges" data-access="${access}" data-station-state="${condition}" data-ground-anchor="32,64">
<title>D4 station: ${access} access, ${condition}</title><desc>Transparent 2:1 dimetric prop. Ground anchor 32,64. ${description(state)}</desc>
<g id="station-landmark">${landmark}</g>
${stopped ? `<g id="station-closed-shutters" data-lit="false"><path d="M18 46l4 2v6l-4-2Z" fill="#7D8271" stroke="#233C3B"/>
<path d="M30 50l4-2v12l-4 2Z" fill="#7D8271" stroke="#233C3B"/>
<path d="M18 47l4 6M18 51l4-3M30 51l4 8M30 60l4-10" stroke="#B3A37A" stroke-width="1.5"/></g>` : ''}
${propAccess(state)}
</svg>`;
}
async function generate() {
  for (const {name} of STATION_ACCESS_SCENE_STATES) await fs.writeFile(path(`public/assets/${name}.svg`), stationAccessScene(name));
  for (const {name} of STATION_ACCESS_PROP_STATES) await fs.writeFile(path(`public/assets/props/${name}.svg`), stationAccessProp(name));
  const browser = await chromium.launch({executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 64, height: 80}, deviceScaleFactor: 2});
    for (const {name} of STATION_ACCESS_PROP_STATES) {
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${stationAccessProp(name)}`);
      await page.screenshot({path: path(`public/assets/props/${name}.png`).pathname, omitBackground: true});
    }
  } finally { await browser.close(); }
  console.log('Generated 10 original D4 access scenes (1000 × 500), 4 SVG props and 4 transparent PNG props (128 × 160).');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await generate();
