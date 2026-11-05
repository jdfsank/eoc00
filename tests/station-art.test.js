import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('all D4 scene states retain the same station, river gauge, pier and stored records',()=>{
 for(const condition of ['active','maintenance','understaffed','stopped']){
  const svg=fs.readFileSync(new URL(`../public/assets/river-station-${condition}.svg`,import.meta.url),'utf8');
  assert.match(svg,new RegExp(`data-station-state="${condition}"`));assert.match(svg,/viewBox="0 0 1000 500"/);
  for(const shape of ['M350 162h104v80H350Z','M502 143h15v144h-15Z','M340 242l159-13v16l-159 14Z','M607 245h323v111H607Z']) assert.ok(svg.includes(shape),`${condition} preserves ${shape}`);
  if(condition==='stopped')assert.match(svg,/The station is closed, records remain, and the lamp is unlit/);
  if(condition==='understaffed')assert.match(svg,/roof is not depicted as broken/);
 }
});
