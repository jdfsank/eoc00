// Original repo-native F6 asset family. The three physical layers are generated
// separately: dock/branch, historical failed records, and current check table.
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import cb from '@sparticuz/chromium';
import {FAR_PORT_ASSETS} from '../src/far-port-visuals.js';
function parts(name){
 const suffix=name.replace('far_port_','');
 // The separator matters: branch_closed is an open branch with a closed
 // checking service, while branch_closed_* is a closed branch plus its stage.
 const place=suffix.startsWith('branch_closed_')?'branch_closed':suffix.startsWith('branch_')?'branch':'shore';
 return {place,stage:suffix.slice(place.length+1)};
}
function scene(name){
 const {place,stage}=parts(name),branch=place!=='shore',closed=place==='branch_closed',failed=['failed','failed_closed','pending','recovered'].includes(stage),checked=['verified','recovered'].includes(stage),table=checked||stage==='closed';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" shape-rendering="crispEdges" data-branch="${place}" data-review="${stage}">
<title>F6 tributary landing: ${place}, ${stage}</title><desc>Original fixed-location illustration. The branch and checking service are distinct. A tied unresolved folio is not successful correction; an unfilled work order is not a new institution. Later checking keeps the old failure and cannot reverse past flood loss. Ledger marks are illustrative, not numerical measurements.</desc>
<rect width="1000" height="500" fill="#A6B8A5"/><path d="M0 106h90V85h88v26h90V70h95v49h101V91h86v42h105v-24h123v33h110v-31h112v244H0Z" fill="#718D7D"/>
<!-- A side channel meets the main river beside the same short landing. -->
<path d="M0 184l1000-42v214L0 393Z" fill="#4B7975"/><path d="M640 142l-82 214h112l112-218Z" fill="#3F6967"/>
<path d="M0 231l535-24M714 201l286-13M0 290l510-33M690 274l310-18" stroke="#91B1A4" stroke-width="7"/>
<path d="M0 370l1000-52v182H0Z" fill="#748673"/><path d="M0 357l1000-53v23L0 382Z" fill="#ADB49B"/>
<path d="M63 333l333-27 107 49-343 36Z" fill="#A69771" stroke="#294944" stroke-width="7"/>
<path d="M91 331l99 51M143 326l103 52M197 322l102 50M251 318l103 50M304 313l107 49" stroke="#766F52" stroke-width="5"/>
<path d="M77 330v82M383 310v69M479 353v53" stroke="#4F6254" stroke-width="12"/>
<path d="M76 326l22-2M382 305l21-2" stroke="#D3C5A0" stroke-width="8"/>
${branch?`<g id="branch-house"><path d="M144 180l131 20v134l-131-21Z" fill="#B7AC88" stroke="#294944" stroke-width="7"/><path d="M275 200l116-29v140l-116 23Z" fill="#7C8C74" stroke="#294944" stroke-width="7"/>
<path d="M128 180l125-65 154 55-132 44Z" fill="#365E59" stroke="#294944" stroke-width="8"/><path d="M128 180l147 34 132-44v15l-132 44-147-34Z" fill="#294944"/>
<path d="M170 157l141 42M212 136l143 46" stroke="#52776A" stroke-width="7"/>
<path d="M164 221l82 12v65l-82-11ZM304 234l52-12v84l-52 13Z" fill="#294944"/>
${closed?'<g id="branch-shutter"><path d="M166 225l78 11v60l-78-11ZM307 238l46-11v76l-46 12Z" fill="#7B8268"/><path d="M168 231l72 57M169 278l71-36M310 243l40 54M310 305l40-70" stroke="#BCAB80" stroke-width="8"/></g>':'<g id="branch-open"><path d="M171 231l27 4v47l-27-4ZM210 237l27 4v47l-27-4ZM314 241l30-6v63l-30 7Z" fill="#D2C5A2"/></g>'}
<path d="M425 190v158" stroke="#294944" stroke-width="17"/><path d="M425 194v147" stroke="#D2C5A2" stroke-width="9"/><path d="M421 212h8M421 238h8M421 264h8M421 290h8M421 316h8" stroke="#657B69" stroke-width="4"/></g>`:''}
${stage!=='none'?`<g id="record-platform"><path d="M548 385l324-31 91 49-326 39Z" fill="#526D60"/>
${failed?`<g id="failed-folio"><path d="M558 312l102-12 48 23-103 17Z" fill="#9F916D"/><path d="M573 333v75M685 335v69" stroke="#796C50" stroke-width="9"/><path d="M588 241l83-9v86l-83 12Z" fill="#C7B992" stroke="#294944" stroke-width="6"/><path d="M588 241l62-7 21 17-22 3-2-20" fill="#E0D6B7"/><path d="M600 267l16-8 12 14M638 274l20-10M601 299l22-5M642 290l16-4" fill="none" stroke="#6D755C" stroke-width="5"/><path d="M622 239v84" stroke="#8D7755" stroke-width="7"/>
${stage==='failed_closed'?'<path d="M585 254l87 59M588 315l80-65" stroke="#294944" stroke-width="13"/><path d="M585 254l87 59M588 315l80-65" stroke="#B6A67E" stroke-width="7"/>':''}</g>`:''}
${stage==='pending'?`<g id="pending-order"><path d="M773 197v201" stroke="#796C50" stroke-width="9"/><path d="M724 214h112v101H724Z" fill="#D2C5A2" stroke="#294944" stroke-width="6"/><path d="M747 207h65v15h-65Z" fill="#796C50"/><path d="M741 237h30v15h-30ZM741 270h30v15h-30Z" fill="none" stroke="#6D755C" stroke-width="4"/><path d="M792 244h25M792 282h25M792 244l25 38M817 244l-25 38" fill="none" stroke="#294944" stroke-width="5"/></g>`:''}
${table?`<g id="check-table"><path d="M704 348l158-20 93 40-164 29Z" fill="#AD9F77" stroke="#294944" stroke-width="6"/><path d="M721 367v68M924 380v55M795 397v47" stroke="#796C50" stroke-width="10"/>
${checked?`<g id="paired-ledgers"><path d="M724 272l61-8 5 86-62 11Z M805 258l63-8 8 88-65 11Z" fill="#E0D6B7" stroke="#294944" stroke-width="5"/><path d="M736 291l39-5M738 311l38-5M740 331l37-5M817 277l40-5M819 297l40-5M821 317l40-5" stroke="#72816A" stroke-width="4"/><path d="M754 270l6 86M837 254l8 89" stroke="#A3916B" stroke-width="3"/></g><g id="check-worker"><path d="M888 259h25v29h-25Z" fill="#BCA888"/><path d="M884 254h31v12h-31Z" fill="#294944"/><path d="M881 287h40v60h-40Z" fill="#52746B"/><path d="M883 307l-31 28-26-1" fill="none" stroke="#52746B" stroke-width="11"/></g>`:`<g id="check-closure"><path d="M735 284l122-16 10 86-124 18Z" fill="#7B8268" stroke="#294944" stroke-width="6"/><path d="M735 292l126 59M744 357l109-81" stroke="#BCAB80" stroke-width="9"/><path d="M695 374l60-7 29 14-60 10Z" fill="#C7B992"/><path d="M720 369l17 19" stroke="#796C50" stroke-width="5"/></g>`}</g>`:''}
</g>`:''}
<path d="M38 446v-50M53 439v-39M970 445v-44M950 450v-35" stroke="#83966F" stroke-width="7"/><path d="M38 396v-17M970 401v-15" stroke="#C0B186" stroke-width="8"/>
</svg>`;
}
function prop(name){
 const {place,stage}=parts(name),branch=place!=='shore',closed=place==='branch_closed',failed=['failed','failed_closed','pending'].includes(stage),checked=['verified','recovered'].includes(stage);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges" data-branch="${place}" data-review="${stage}"><title>F6 dock and separate review history</title><desc>Original low dimetric prop. Ground anchor 32,64. Failed folio, pending order, paired ledgers and closed table are non-color alternatives, never predictions.</desc>
<path d="M32 52L59 65 32 77 5 64Z" fill="#233C3B"/><path d="M32 55L55 65 32 74 9 64Z" fill="#6F8170"/>
<path d="M8 61l23-11 16 8-23 12Z" fill="#B1A17B" stroke="#233C3B" stroke-width="2"/><path d="M14 59l17 8M21 55l17 8M9 62v8M31 52v8" stroke="#796C50" stroke-width="2"/>
${branch?`<g id="branch-house"><path d="M11 39l14 7v19l-14-7Z" fill="#C4B99A" stroke="#233C3B" stroke-width="2"/><path d="M25 46l13-7v19l-13 7Z" fill="#7D8271" stroke="#233C3B" stroke-width="2"/><path d="M8 39l16-14 18 13-17 11Z" fill="#365E59" stroke="#233C3B" stroke-width="2"/><path d="M15 34l17 10" stroke="#52776A" stroke-width="2"/>
${closed?'<g id="branch-shutter"><path d="M15 45l8 15M15 56l8-8M29 49l7 9M29 60l7-14" stroke="#BCAB80" stroke-width="2"/></g>':'<g id="branch-open"><path d="M15 45l5 3v9l-5-3ZM30 49l5-3v11l-5 3Z" fill="#E0D6B7"/></g>'}
<path d="M6 37v25" stroke="#233C3B" stroke-width="4"/><path d="M6 38v23" stroke="#E0D6B7" stroke-width="2"/><path d="M5 44h2M5 51h2M5 58h2" stroke="#796B50"/></g>`:''}
${failed?`<g id="failed-folio"><path d="M39 46l11-3v18l-11 3Z" fill="#C7B992" stroke="#233C3B" stroke-width="2"/><path d="M44 44v18" stroke="#8D7755" stroke-width="2"/><path d="M40 51l3 1M46 54l3-2" stroke="#65725D"/>
${stage==='failed_closed'?'<path d="M38 48l13 13M39 63l12-18" stroke="#233C3B" stroke-width="3"/><path d="M38 48l13 13M39 63l12-18" stroke="#BCAB80" stroke-width="1.5"/>':''}</g>`:''}
${stage==='pending'?'<g id="pending-order"><path d="M55 31v32" stroke="#796C50" stroke-width="2"/><path d="M47 31h14v16H47Z" fill="#E0D6B7" stroke="#233C3B" stroke-width="2"/><path d="M50 34h4v3h-4ZM50 40h4v3h-4Z" fill="none" stroke="#233C3B"/></g>':''}
${checked||stage==='closed'?`<g id="check-table"><path d="M35 62l16-8 11 6-16 9Z" fill="#B1A17B" stroke="#233C3B" stroke-width="2"/><path d="M38 65v5M57 65v5" stroke="#796C50" stroke-width="2"/>
${checked?'<g id="paired-ledgers"><path d="M40 47l7-2v14l-7 3ZM51 43l7-2v14l-7 4Z" fill="#E0D6B7" stroke="#233C3B" stroke-width="2"/><path d="M42 51l3-1M42 56l3-1M53 47l3-1M53 52l3-1" stroke="#72816A"/></g>':'<g id="check-closure"><path d="M39 48l18-6v20l-18 6Z" fill="#7B8268" stroke="#233C3B" stroke-width="2"/><path d="M39 49l18 13M40 65l16-22" stroke="#BCAB80" stroke-width="2"/></g>'}
</g>`:''}
${stage==='recovered'?'<path id="retained-failed-folio" d="M30 67l7-3 7 3-7 4Z" fill="#C7B992" stroke="#233C3B" stroke-width="1"/>':''}
</svg>`;
}
for(const name of FAR_PORT_ASSETS){await fs.writeFile(`public/assets/${name.replaceAll('_','-')}.svg`,scene(name));await fs.writeFile(`public/assets/props/${name}.svg`,prop(name));}
const browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});try{const page=await browser.newPage({viewport:{width:64,height:80},deviceScaleFactor:2});for(const name of FAR_PORT_ASSETS){await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${prop(name)}`);await page.screenshot({path:`public/assets/props/${name}.png`,omitBackground:true});}console.log(`${FAR_PORT_ASSETS.length} F6 scene/prop states generated from original SVG geometry.`);}finally{await browser.close();}
