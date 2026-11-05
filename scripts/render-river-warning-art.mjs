// Original repo-native illustration. Keep the archive room while showing a
// distinct, low resident bell frame outside it, never a measuring station.
import fs from 'node:fs/promises';

export function riverWarningSvg(condition){
 const stopped=condition==='stopped',worn=condition==='maintenance';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" shape-rendering="crispEdges" data-warning-state="${condition}">
<title>D4 resident bell and archive room: ${condition}</title>
<desc>Original riverport illustration. Retained books and desk do not imply that an old archive post reopened. A low wooden frame holds a resident warning bell, not a measuring tower. Duty marks and figures are illustrative, not a headcount or a coverage forecast. ${stopped?'The rope is tied, duty board barred, and no messenger is working.':worn?'Residents still relay observations while the bell frame needs upkeep.':'Residents relay local observations with a bell, a duty sheet and hand-carried notes.'} No water gauge, measurement station, independent verification or reversed flood loss is depicted.</desc>
<rect width="1000" height="500" fill="#163337"/>
<path d="M0 0h1000v360H0Z" fill="#214448"/><path d="M0 360h1000v140H0Z" fill="#314B43"/>
<!-- Familiar archive shelf and records remain on the left in every state. -->
<g id="retained-archive"><path d="M50 50h390v20H50ZM50 170h390v16H50ZM50 285h390v18H50Z" fill="#46615A"/>
<path d="M70 85h36v80H70ZM116 70h22v95h-22ZM150 100h55v65h-55ZM230 82h26v83h-26ZM280 92h58v73h-58ZM356 77h28v88h-28ZM75 207h44v73H75ZM132 194h28v86h-28ZM170 218h70v62h-70ZM258 201h50v79h-50ZM320 195h24v85h-24ZM359 210h50v70h-50Z" fill="#AF9B70"/>
<path d="M105 350h335l110 110H35Z" fill="#A99C78"/><path d="M35 460h515v30H35Z" fill="#4C5A48"/>
<g id="retained-records"><path d="M151 366h162l51 62H121Z" fill="#9C9B7C"/><path d="M151 366h162v15H142Z" fill="#C3B58F"/><path d="M228 366l9 62" stroke="#D7CAA4" stroke-width="8"/><path d="M370 365h70l30 50h-75Z" fill="#C8B993"/><path d="M375 379l66 7" stroke="#796C50" stroke-width="4"/></g></g>
<!-- The open doorway keeps the river bank visible; there is no new building. -->
<g id="river-doorway"><path d="M480 48h487v340H480Z" fill="#AA9A73"/><path d="M497 65h453v310H497Z" fill="#A6B8A5"/>
<path d="M497 138l65-31 54 17 66-30 85 39 71-23 112 29v180H497Z" fill="#718D7D"/>
<path d="M497 205l453-35v158l-453 24Z" fill="#4B7975"/><path d="M517 239l212-16M784 222l148-12M520 284l393-28" stroke="#91B1A4" stroke-width="7"/>
<path d="M497 327l453-27v75H497Z" fill="#81927A"/><path d="M497 325l453-29v13l-453 30Z" fill="#B4B79B"/>
<path d="M480 374h487v20H480Z" fill="#3E5B4E"/></g>
<g id="resident-bell-frame"><path d="M650 157v213M809 157v202" stroke="#294944" stroke-width="19"/><path d="M650 157v213M809 157v202" stroke="#8A7D5A" stroke-width="11"/>
<path d="M632 154h195v18H632Z" fill="#294944"/><path d="M636 156h187v9H636Z" fill="#B3A27A"/>
<path d="M650 168l37 29M809 168l-35 29" stroke="#8A7D5A" stroke-width="9"/>
<path d="M726 168v29" stroke="#294944" stroke-width="6"/>
<g id="bell"><path d="M700 210l10-15h32l11 15 8 37 12 11v10h-90v-10l12-11Z" fill="#B4A06C" stroke="#294944" stroke-width="7"/>
<path d="M712 204h27l9 43h-46Z" fill="#D5BF85"/><path d="M688 255h80v10h-80Z" fill="#A38A59"/><path d="M722 269h12v14h-12Z" fill="#294944"/></g>
${worn?'<g id="upkeep-brace"><path d="M640 305l21-3v36l-21 3ZM800 273l18-3v30l-18 3Z" fill="#D1BE93"/><path d="M646 310l9 22M804 278l10 17" stroke="#6C7058" stroke-width="4"/></g>':''}
${stopped?'<g id="tied-bell-rope"><path d="M728 283v40l-22 18 25 15 22-19-25-14M706 340h47" fill="none" stroke="#D4C49B" stroke-width="6"/><path d="M711 349l40-18" stroke="#294944" stroke-width="3"/></g>':'<path id="working-bell-rope" d="M728 281l58 43" fill="none" stroke="#D4C49B" stroke-width="6"/>'}
</g>
<g id="resident-duty-board"><path d="M535 198h85v117h-85Z" fill="#294944"/><path d="M541 205h73v102h-73Z" fill="#B7AA84"/>
${stopped?'<g id="closed-duty-board"><path d="M543 212l69 88M543 299l69-87" stroke="#294944" stroke-width="13"/><path d="M543 212l69 88M543 299l69-87" stroke="#998963" stroke-width="7"/></g>':`<g id="current-duty-sheets"><path d="M551 215h51v22h-51ZM551 248h51v22h-51Z" fill="#E0D6B7"/><path d="M559 224h33M559 257h33" stroke="#72816A" stroke-width="4"/>${worn?'<path d="M551 281h51v17h-51Z" fill="none" stroke="#687A67" stroke-width="3"/>':'<path d="M551 281h51v17h-51Z" fill="#E0D6B7"/>'}</g>`}</g>
${!stopped?`<g id="resident-relay"><path d="M835 263h27v33h-27Z" fill="#BEAA89"/><path d="M831 261h32v12h-32Z" fill="#294944"/><path d="M828 296h41v66h-41Z" fill="#526F67"/><path d="M834 361l-7 37M860 361l12 35" stroke="#294944" stroke-width="14"/><path d="M831 308l-29 24-20-7" fill="none" stroke="#526F67" stroke-width="13"/>
<path d="M865 312l29 25" stroke="#526F67" stroke-width="12"/><path d="M881 316l24 6-9 30-23-7Z" fill="#E0D6B7" stroke="#294944" stroke-width="3"/>
<path d="M936 301h21v27h-21Z" fill="#B5A184"/><path d="M931 298h28v11h-28Z" fill="#294944"/><path d="M930 328h33v58h-33Z" fill="#9E9678"/><path d="M936 385l-6 33M957 385l11 28" stroke="#294944" stroke-width="11"/><path d="M933 342l-25 3" stroke="#9E9678" stroke-width="10"/></g>`:''}
<path d="M590 420l353-19" stroke="#526D5A" stroke-width="10"/><path d="M605 421v-30M620 420v-25" stroke="#859575" stroke-width="5"/>
</svg>`;
}
for(const condition of ['active','maintenance','stopped']){
 await fs.writeFile(`public/assets/river-warning-${condition}.svg`,riverWarningSvg(condition));
 console.log(`D4 resident bell ${condition}: original 1000 × 500 SVG generated`);
}
