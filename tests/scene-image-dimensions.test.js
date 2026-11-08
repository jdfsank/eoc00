import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sceneArt} from '../src/scene-art.js';
import * as current from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as old from './fixtures/pre-aftermath-simulation.js';
import {makeRoute} from './fixtures/round23-playback-routes.js';
const assetDir=new URL('../public/assets/',import.meta.url);
function dimensions(file){const text=fs.readFileSync(new URL(file,assetDir),'utf8'),tag=text.match(/<svg\b[^>]*>/)?.[0];assert.ok(tag,file+' SVG root');const attr=name=>tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];return {width:Number(attr('width')),height:Number(attr('height')),viewBox:attr('viewBox')};}
function primary(file){assert.deepEqual(dimensions(file),{width:1000,height:500,viewBox:'0 0 1000 500'},file);}
test('every current AVG primary asset family reserves the real 1000 by 500 SVG size',()=>{
 const families=[/^archive-desk\.svg$/,/^(?:closed-)?(?:bank-reading|classroom)\.svg$/,/^local-classroom\.svg$/,/^open-shore\.svg$/,/^river-station-(?:fee|public)-.*\.svg$/,/^river-warning-.*\.svg$/,/^monastery-.*\.svg$/,/^far-port-.*\.svg$/,/^south-bank-.*\.svg$/];
 const files=fs.readdirSync(assetDir);for(const family of families){const matched=files.filter(f=>family.test(f));assert.ok(matched.length,'Nonempty family '+family);for(const file of matched)primary(file);}
});
test('natural current and archived producer routes use matching AVG primary dimensions without state mutation',()=>{
 const seen=new Set();for(const api of [current,previous])for(const route of ['success','maintenance','failure-cancellation'])for(const state of Object.values(makeRoute(api,route).years)){const before=JSON.stringify(state);for(const cell of state.cells){const art=sceneArt(state,cell.id);primary(art.file);seen.add(art.file);}assert.equal(JSON.stringify(state),before);}
 assert.ok(seen.has('river-station-public-stopped.svg'));assert.ok(seen.has('archive-desk.svg')||seen.has('open-shore.svg'));
});
test('genuine pre-aftermath producer retains its actual primary geometry at each completed planning window',()=>{
 const state=old.createRun(0);function inspect(){const before=JSON.stringify(state);for(const cell of state.cells)primary(sceneArt(state,cell.id).file);assert.equal(JSON.stringify(state),before);}inspect();for(const id of ['build_joint','recruit_successor']){const action=old.getActions(state,'D4','protagonist').find(a=>a.id===id);assert.ok(action);for(const evidence of action.requireEvidence)old.investigate(state,'protagonist','D4',evidence);old.lockTask(state,'protagonist','D4',id,action.requireEvidence);old.commitWindow(state);old.advanceToNextWindow(state);inspect();}
});
test('AVG reserves primary dimensions without imposing them on visit composites or detail art',()=>{
 const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');const avg=source.slice(source.indexOf('class="page reading scene-planning-page"'),source.indexOf('class="page reading scene-planning-page"')+1300);assert.match(avg,/<img[^>]+width="1000" height="500" data-intrinsic-scene-size/);assert.doesNotMatch(avg,/art\.file==='archive-desk\.svg'/);
 assert.equal(dimensions('east-bank-teaching-active-active.svg').height,1018);assert.equal(dimensions('east-bank-mandate-authorized.svg').height,390);
});
