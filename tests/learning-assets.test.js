import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('local learning props retain the handoff size, anchor and transparent 2x raster contract',()=>{
 for(const name of ['riverside_school','bank_reading_circle']){
  const svg=fs.readFileSync(new URL(`../public/assets/props/${name}.svg`,import.meta.url),'utf8');
  assert.match(svg,/viewBox="0 0 64 80"/);assert.match(svg,/Ground anchor 32,64/);
  const png=fs.readFileSync(new URL(`../public/assets/props/${name}.png`,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),128);assert.equal(png.readUInt32BE(20),160);
  assert.equal(png[25],6,'RGBA output retains the transparent canvas around each prop');
 }
});

test('south-bank and inactive scene variants preserve the intended physical differences',()=>{
 const read=name=>fs.readFileSync(new URL(`../public/assets/${name}.svg`,import.meta.url),'utf8');
 assert.match(read('local-classroom'),/id="open-shade"/);assert.match(read('local-classroom'),/id="learners"/);
 assert.doesNotMatch(read('bank-reading'),/id="open-shade"/);assert.match(read('bank-reading'),/id="learners"/);
 assert.match(read('closed-classroom'),/id="open-shade"/);assert.doesNotMatch(read('closed-classroom'),/id="learners"/);
 assert.doesNotMatch(read('closed-bank-reading'),/id="open-shade"|id="learners"/);
});
