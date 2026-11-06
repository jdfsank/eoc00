import fs from 'node:fs/promises';
const palette={ink:'#163339',river:'#3c6669',far:'#31535a',paper:'#d9cfad',paper2:'#afab85',line:'#7e8f7b',gold:'#c7a75d',dark:'#28473f',reed:'#8b9d83'};
const ruler=`<g id="old-tools"><path d="M88 259l28-157 19 4-28 157z" fill="#9a987b"/><path d="M107 151l14 3m-19 22l14 3m-19 22l14 3m-19 22l14 3" stroke="#294c47" stroke-width="5"/><path d="M72 273l174-1 6 16H67z" fill="#a5a186"/><path d="M90 288l-8 26m147-26 9 26" stroke="#304b40" stroke-width="10"/></g>`;
const oldBook=`<g id="old-record"><path d="M244 301l124-30 93 52-125 43z" fill="#b4a987"/><path d="M253 291l116-26 89 48-122 43z" fill="#e1d5af"/><path d="M369 265l-33 91m-57-52l58-14m-44 29l59-16m23-13l43 24m-49-10l38 22" fill="none" stroke="#8f957d" stroke-width="4"/><path d="M332 357l-7 24 14-8 8 4 5-27" fill="#b39453"/></g>`;
const sheet=`<path d="M531 243l200 12 70 91-208-17z" fill="#d9cfad"/><path d="M542 255l178 12m-167 8l178 12m-167 8l94 7" stroke="#a1a486" stroke-width="4"/>`;
const signed=`<g id="signed-page">${sheet}<path d="M720 255l12 24 18-3" fill="#b7b391"/><path d="M583 297l23 18 33-18 18 18 28-12" fill="none" stroke="#596e57" stroke-width="5"/><path d="M710 301l21 2 9 21-21-1z" fill="#b8954f"/><path d="M526 246l65 82" stroke="#627963" stroke-width="4" stroke-dasharray="4 10"/></g>`;
const newTools=`<g id="new-teaching-tools"><path d="M611 263l207-21 44 36-211 23z" fill="#bfbc95"/><path d="M641 298v38m196-54v47" stroke="#697b61" stroke-width="10"/><path d="M700 239l19-94 17 4-20 94zM746 238l19-81 15 4-17 78z" fill="#d1c297"/><path d="M713 173l13 3m-18 20l13 3m-18 20l13 3m41-28l12 3m-17 18l13 3" stroke="#4f7164" stroke-width="4"/><path d="M643 251l49-6 29 22-50 7z" fill="#e4dcbd"/><path d="M657 253l27-3m-18 10l26-3" stroke="#91977d" stroke-width="3"/></g>`;
const tied=`<g id="closed-tools"><path d="M92 229l137 39m-129-5l129-25" stroke="#d2c39c" stroke-width="7"/><path d="M180 239l21 38-20 10-19-36z" fill="#486957"/></g>`;
function svg(motif){
 let objects=oldBook;
 if(['authorized','authorized-stopped','unwritten'].includes(motif))objects=ruler+objects;
 if(motif==='authorized'||motif==='authorized-stopped')objects+=signed;
 if(motif==='authorized-stopped')objects+=tied;
 if(motif==='unwritten')objects+=`<g id="unsigned-page">${sheet}<path d="M587 312l145 11" stroke="#a6aa8d" stroke-width="3"/></g>`;
 if(motif==='network'||motif==='network-stopped')objects+=newTools;
 if(motif==='network-stopped')objects+=`<g id="closed-network"><path d="M691 187l88 49m-80-1l80-40" stroke="#d0c7a0" stroke-width="8"/><path d="M645 253l53 15m-49 4l49-26" stroke="#657d65" stroke-width="4"/></g>`;
 if(motif==='both')objects+=`<g transform="translate(-50 7) scale(.88)">${signed}</g><g transform="translate(146 7) scale(.86)">${newTools}</g>`;
 if(motif==='cancelled')objects+=`<g id="cancelled-scroll"><path d="M569 276q-12-12 0-26l163 16q16 12 3 27z" fill="#c8c09c"/><ellipse cx="734" cy="279" rx="10" ry="14" fill="#8c9578"/><path d="M629 258l23 27m-20 2l24-27" stroke="#587961" stroke-width="7"/></g>`;
 if(motif==='unknown')objects+=`<g id="unverified-folio"><path d="M568 252l153 14 39 64-166-20z" fill="#a2a98e"/><path d="M584 265l121 12 30 39-126-15z" fill="none" stroke="#3c635e" stroke-width="4" stroke-dasharray="9 8"/><path d="M657 271l-5 32" stroke="#637f70" stroke-width="6"/></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420"><title>余波 · 河岸末页</title><rect width="1000" height="420" fill="${palette.ink}"/><path d="M0 83l148 21 152-37 168 42 176-42 167 35 189-28v195H0z" fill="${palette.far}"/><path d="M0 128l171 27 196-28 211 37 190-22 232 25v149H0z" fill="${palette.river}"/><path d="M0 188l190 29 256-25 213 28 341-7M0 213l218 23 260-23 218 27 304-8" fill="none" stroke="#68877c" stroke-width="3" opacity=".55"/><path d="M0 300l246-62 213 38 130-60 189 43 222-22v183H0z" fill="#537265"/><path d="M0 355l280-88 190 43 102-60 290 65 138-19v124H0z" fill="#82917a"/><path d="M0 391l281-104 187 43 102-59 292 64 138-17v102H0z" fill="#abb096"/><path d="M0 411l281-105 187 43 103-59 291 65 138-17" fill="none" stroke="#d6cba6" stroke-width="5"/>${objects}<g id="river-reeds" fill="none" stroke="${palette.reed}" stroke-width="5"><path d="M36 315l-9-63m12 52l9-38m887 58l7-72m-4 55l-20-27m44 53l-2-63"/></g><path d="M854 86l24-6 13 10-23 6z" fill="#a6b4a0" opacity=".7"/></svg>`;
}
await fs.mkdir('public/assets',{recursive:true});
for(const motif of ['recorded','authorized','authorized-stopped','network','network-stopped','both','unwritten','cancelled','unknown'])await fs.writeFile(`public/assets/ending-${motif}.svg`,svg(motif));
console.log('Generated 9 original ending still lifes.');
