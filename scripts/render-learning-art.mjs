// Reproduce the bitmap game props from their original repo-native SVG sources.
// Scene text stays in HTML. These images contain no baked UI labels.
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const source=await fs.readFile('public/assets/local-classroom.svg','utf8');
assert.match(source,/<!-- SHADE_START[\s\S]*?<!-- SHADE_END -->/);
const south=source
 .replace(/<!-- SHADE_START[\s\S]*?<!-- SHADE_END -->/,'<!-- South-bank learning has no shade or walls. -->')
 .replace('Learning together on the east-bank embankment','The south-bank reading circle')
 .replace('behind a wall-free shade shelter','behind an open riverbank reading circle');
await fs.writeFile('public/assets/bank-reading.svg',south);
assert.match(source,/<!-- LEARNERS_START[\s\S]*?<!-- LEARNERS_END -->/);
for(const [name,scene] of [['closed-classroom',source],['closed-bank-reading',south]]){
 await fs.writeFile(`public/assets/${name}.svg`,scene
  .replace(/<title>[\s\S]*?<\/title>/,'<title>The learning place remains after teaching stops</title>')
  .replace(/<desc>[\s\S]*?<\/desc>/,'<desc>Original inactive learning-place variant. The physical benches, old rulers and shelter where present remain. There are no learners; wooden boards close the record table.</desc>')
  .replace(/<!-- LEARNERS_START[\s\S]*?<!-- LEARNERS_END -->/,'<!-- No active learners after the local institution stops. -->')
  .replace('</svg>','<path d="M649 330l160 17M685 352l114-43" stroke="#5C695B" stroke-width="13"/><path d="M649 328l160 17M685 350l114-43" stroke="#9B8C67" stroke-width="7"/></svg>'));
}

const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
try{
 const page=await browser.newPage({viewport:{width:64,height:80},deviceScaleFactor:2});
 for(const name of ['riverside_school','bank_reading_circle']){
  const svg=await fs.readFile(`public/assets/props/${name}.svg`,'utf8');
  assert.match(svg,/viewBox="0 0 64 80"/);
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await page.screenshot({path:`public/assets/props/${name}.png`,omitBackground:true});
  console.log(`${name}: rendered transparent 128 × 160 PNG; logical size 64 × 80, ground anchor 32,64`);
 }
}finally{await browser.close();}
