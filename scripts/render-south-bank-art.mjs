// Original geometric art for D5. These source SVGs are the masters; no generated
// image or game-concept sheet is cropped into the game. Labels remain in HTML.
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {SOUTH_BANK_ASSETS} from '../src/south-bank-visuals.js';

function conditions(name){return {teaching:name.includes('learning'),teachActive:name.includes('learning')&&!name.includes('learning_closed'),aidActive:!name.endsWith('aid_closed')};}
function scene(name){
 const {teaching,teachActive,aidActive}=conditions(name);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" shape-rendering="crispEdges" data-teaching-state="${teaching?teachActive?'active':'stopped':'absent'}" data-aid-state="${aidActive?'active':'stopped'}">
<title>D5 south-bank commons: ${name}</title>
<desc>Original riverbank illustration. A low raised supply shed and an open-air reading circle, when present, remain independent services. Closed services retain their physical history. People, supplies and ledger marks are illustrative, not measured population, inventory or flood protection.</desc>
<rect width="1000" height="500" fill="#A6B8A5"/>
<path d="M0 96h48V74h70V90h48V60h70V84h70v18h62V76h68v30h74V82h82v30h76V94h76v30h80v-20h74v28h102v106H0Z" fill="#708C7D"/>
<path d="M0 169l1000-40v201L0 346Z" fill="#4B7975"/>
<path d="M0 211l1000-31M0 267l1000-29" stroke="#7EA399" stroke-width="9"/>
<path d="M67 191h100M410 228h105M780 204h95M110 285h124" stroke="#A4BBB0" stroke-width="4"/>
<path d="M0 349l1000-91v242H0Z" fill="#6F8170"/>
<path d="M0 340l1000-92v25L0 367Z" fill="#ADB49B"/>
<path d="M0 364l1000-92v22L0 387Z" fill="#526D60"/>
<path d="M0 389l1000-94v24L0 416Z" fill="#8B9A82"/>
<!-- The shed stands on short floodplain posts, not a station tower. -->
<g id="mutual-shed">
<path d="M558 329l272-19 109 48-280 31Z" fill="#3B5750"/>
<path d="M590 274v79M744 286v90M881 267v76" stroke="#4C5C48" stroke-width="14"/>
<path d="M576 278l174 15 150-29v30l-150 31-174-17Z" fill="#8F805D" stroke="#294944" stroke-width="6"/>
<path d="M577 184l173 26v97l-173-21Z" fill="#B6AA85" stroke="#294944" stroke-width="6"/>
<path d="M750 210l140-35v111l-140 21Z" fill="#7D8A70" stroke="#294944" stroke-width="6"/>
<path d="M566 186l136-66 207 54-159 48Z" fill="#365E59" stroke="#294944" stroke-width="7"/>
<path d="M566 186l184 36 159-48v15l-159 48-184-36Z" fill="#294944"/>
<path d="M613 166l177 35M650 148l182 40M689 131l187 43" stroke="#52776A" stroke-width="6"/>
<path d="M596 221l131 17v61l-131-16Z" fill="#294944"/>
${aidActive?`<g id="aid-open-hatch"><path d="M592 216l139 18v12l-139-17Z" fill="#DBC99B"/><path d="M600 261l34 5v22l-34-5ZM644 257l35 5v32l-35-4ZM688 274l33 4v21l-33-4Z" fill="#AA956A"/><path d="M605 273l23 3M650 276l22 3M693 286l22 3" stroke="#706D51" stroke-width="4"/></g>`:`<g id="aid-shutter"><path d="M595 222l135 17v64l-135-17Z" fill="#7B8268"/><path d="M607 225v61M632 230v60M657 231v61M682 236v59M707 239v59" stroke="#9F9A77" stroke-width="5"/><path d="M600 236l124 53M600 276l124-29" stroke="#294944" stroke-width="14"/><path d="M600 236l124 53M600 276l124-29" stroke="#BCAB80" stroke-width="8"/></g>`}
<path d="M785 223l69-16v53l-69 15Z" fill="#294944"/>
<path d="M794 229l51-11v10l-51 11ZM794 247l51-11v10l-51 11Z" fill="${aidActive?'#D2C5A2':'#7D8A70'}"/>
</g>
<!-- Distribution table is not a ruler board or a classroom blackboard. -->
<g id="aid-register"><path d="M625 366l175-28 93 40-183 36Z" fill="#B1A17B" stroke="#294944" stroke-width="6"/><path d="M647 386v59M851 399v49M716 414v45" stroke="#796C50" stroke-width="10"/>
<path d="M704 365l62-9 35 16-63 10Z" fill="#E0D6B7"/>
${aidActive?'<path d="M738 361l1 17M715 367l18-3M744 373l30-5" stroke="#768675" stroke-width="3"/>':'<path d="M719 360l35 21" stroke="#796C50" stroke-width="6"/>'}</g>
${aidActive?`<g id="aid-workers"><path d="M861 304h27v31h-27Z" fill="#BCA888"/><path d="M857 299h32v13h-32Z" fill="#294944"/><path d="M854 332h42v66h-42Z" fill="#9A8F76"/><path d="M856 351l-35 24-44-3" fill="none" stroke="#9A8F76" stroke-width="12"/><path d="M856 395h14v45h-14ZM880 395h14v45h-14Z" fill="#294944"/></g>`:''}
${teaching?`<g id="reading-circle"><path d="M120 360l148-17 51 24-151 21Z" fill="#B1A17B"/><path d="M146 381v38M295 375v37" stroke="#71684F" stroke-width="10"/>
<path d="M315 347l113-18 65 29-113 21Z" fill="#A69771" stroke="#294944" stroke-width="5"/><path d="M333 360v51M466 372v47" stroke="#796C50" stroke-width="9"/>
<path d="M352 345l47-7 29 13-45 9Z" fill="#E0D6B7"/>
<path d="M399 208v123M432 220v106" stroke="#294944" stroke-width="14"/><path d="M399 208v123M432 220v106" stroke="#D2C5A2" stroke-width="8"/>
<path d="M395 225h8M395 250h8M395 275h8M395 300h8M428 238h8M428 263h8M428 288h8M428 313h8" stroke="#60786D" stroke-width="4"/>
${teachActive?`<g id="learners"><path d="M231 280h27v30h-27Z" fill="#BCA888"/><path d="M227 275h32v13h-32Z" fill="#294944"/><path d="M225 309h39v55h-39Z" fill="#52746B"/><path d="M226 360h14v40h-14ZM251 360h14v40h-14Z" fill="#294944"/><path d="M263 323l29 13 46-37" fill="none" stroke="#BCA888" stroke-width="10"/><path d="M327 273v68" stroke="#D2C5A2" stroke-width="8"/><path d="M323 288h8M323 309h8" stroke="#60786D" stroke-width="3"/></g>`:`<g id="teaching-closure"><path d="M325 338l142 34M333 372l124-38" stroke="#294944" stroke-width="12"/><path d="M325 338l142 34M333 372l124-38" stroke="#BCAB80" stroke-width="6"/></g>`}</g>`:''}
<path d="M70 432v-51M52 424v-38M88 419v-49M947 448v-50M966 454v-37" stroke="#83966F" stroke-width="7"/><path d="M52 386v-15M88 370v-18M947 398v-17" stroke="#C0B186" stroke-width="8"/>
</svg>`;
}
function prop(name){
 const {teaching,teachActive,aidActive}=conditions(name),x=teaching?30:17,w=teaching?25:32;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges" data-teaching-state="${teaching?teachActive?'active':'stopped':'absent'}" data-aid-state="${aidActive?'active':'stopped'}">
<title>${teaching?'D5 supply shed and open-air reading circle':'D5 raised supply shed'}</title><desc>Original low riverbank prop. Ground anchor 32,64. Open hatches and closed crossbars show each service independently; this is not a station or a numerical capacity meter.</desc>
<path d="M32 51L59 64 32 77 5 64Z" fill="#233C3B"/><path d="M32 54L55 64 32 74 9 64Z" fill="#6F8170"/>
<g id="mutual-shed"><path d="M${x} 43l${w*.55} 7v19l-${w*.55}-7Z" fill="#B6AA85" stroke="#233C3B" stroke-width="2"/><path d="M${x+w*.55} 50l${w*.45}-7v19l-${w*.45} 7Z" fill="#7D8A70" stroke="#233C3B" stroke-width="2"/>
<path d="M${x-3} 43l${w*.5}-13 ${w*.5+6} 11-${w*.45+3} 11Z" fill="#365E59" stroke="#233C3B" stroke-width="2"/>
<path d="M${x+3} 38l${w*.6} 10" stroke="#52776A" stroke-width="2"/>
<path d="M${x+3} 48l${w*.37} 5v11l-${w*.37}-5Z" fill="#233C3B"/>
${aidActive?`<g id="aid-open-hatch"><path d="M${x+3} 48l${w*.37} 5" stroke="#E0D6B7" stroke-width="3"/><path d="M${x+4} 55l${w*.28} 4v4l-${w*.28}-4Z" fill="#C2B18A"/></g>`:`<g id="aid-shutter"><path d="M${x+3} 49l${w*.37} 14M${x+3} 59l${w*.37}-7" stroke="#BCAB80" stroke-width="2"/></g>`}
<path d="M${x+2} 63v7M${x+w*.6} 69v5M${x+w-1} 62v6" stroke="#796C50" stroke-width="2"/>
</g>
${teaching?`<g id="reading-circle"><path d="M8 59l11-5 6 3-11 5Z M8 66l13 6 5-3-12-6Z" fill="#C2B18A" stroke="#233C3B" stroke-width="2"/>
<path d="M19 60l9-4 7 4-10 5Z" fill="#B5A37B" stroke="#233C3B" stroke-width="2"/>
<path d="M18 39v19M23 42v15" stroke="#233C3B" stroke-width="4"/><path d="M18 39v19M23 42v15" stroke="#E0D6B7" stroke-width="2"/><path d="M17 45h2M17 50h2M17 55h2M22 47h2M22 52h2" stroke="#796B50"/>
${teachActive?'<path d="M25 59l5 2-5 2-4-2Z" fill="#E0D6B7"/>':'<g id="teaching-closure"><path d="M20 57l13 7M20 64l12-7" stroke="#233C3B" stroke-width="3"/><path d="M20 57l13 7M20 64l12-7" stroke="#BCAB80" stroke-width="1.5"/></g>'}</g>`:'<path d="M11 62V48M7 59V46M15 58V44" stroke="#839286" stroke-width="2"/><path d="M7 46v-4M15 44v-4" stroke="#B6A778" stroke-width="3"/>'}
</svg>`;
}
for(const name of SOUTH_BANK_ASSETS){await fs.writeFile(`public/assets/${name.replaceAll('_','-')}.svg`,scene(name));await fs.writeFile(`public/assets/props/${name}.svg`,prop(name));}
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
try{const page=await browser.newPage({viewport:{width:64,height:80},deviceScaleFactor:2});for(const name of SOUTH_BANK_ASSETS){await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${prop(name)}`);await page.screenshot({path:`public/assets/props/${name}.png`,omitBackground:true});console.log(`${name}: original scene, SVG master and transparent128×160 prop`);}}
finally{await browser.close();}
