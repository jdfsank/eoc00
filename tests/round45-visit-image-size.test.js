import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sceneArt} from '../src/scene-art.js';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import {checkpoints} from './fixtures/pre-training-workload-scenarios.js';
const dims=file=>{const s=fs.readFileSync(new URL('../public/assets/'+file,import.meta.url),'utf8'),tag=s.match(/<svg[^>]+>/)[0];return ['width','height'].map(a=>Number(tag.match(new RegExp(`\\b${a}="(\\d+)"`))[1]));};
test('every scene SVG has audited actual dimensions; composite and detail art are not treated as 2:1',()=>{
 const files=fs.readdirSync(new URL('../public/assets/',import.meta.url)).filter(f=>f.endsWith('.svg'));let main=0,composite=0,detail=0;
 for(const file of files){if(file.startsWith('ending-')||file.startsWith('crisis-tally-'))continue;
 if(/^east-bank-teaching-(active|stopped|unknown)-(active|stopped|unknown)\.svg$/.test(file)){assert.deepEqual(dims(file),[1000,1018]);composite++;}
 else if(file.startsWith('east-bank-mandate-')){assert.deepEqual(dims(file),[1000,390]);detail++;}
 else{assert.deepEqual(dims(file),[1000,500],file);main++;}}
 assert.equal(main,92);assert.equal(composite,9);assert.equal(detail,4);
});
test('actual current and genuine previous route scene outputs agree with reserved image dimensions',()=>{
 for(const api of [sim,old])for(const seed of [0,1,2,3,12])for(const s of Object.values(checkpoints(api,{seed})))for(const cell of ['B4','D4','D5','E4','F6']){
  const a=sceneArt(s,cell,{visit:true});assert.deepEqual(dims(a.file),[1000,a.composite?1018:500],a.file);if(a.detail)assert.deepEqual(dims(a.detail.file),[1000,390]);
 }
});
test('all nine explicitly composite teaching variants reserve the original tall artwork',()=>{
 for(const training of ['active','stopped','unknown'])for(const school of ['active','stopped','unknown']){
  const s=sim.createRun(0);s.year=40;s.institutions=['training','school'].map((kind,i)=>({kind,cellId:'E4',startYear:30,active:[training,school][i]==='active',maintenance:[training,school][i]==='unknown'?NaN:1}));
  const a=sceneArt(s,'E4',{visit:true});assert.equal(a.composite,true);assert.equal(a.file,`east-bank-teaching-${training}-${school}.svg`);assert.deepEqual(dims(a.file),[1000,1018]);
 }
});
test('only visited main art and mandate detail receive newly audited HTML reservations',()=>{
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(main,/width="1000" height="\$\{art\.composite\?1018:500\}" data-intrinsic-visit-size/);
 assert.match(main,/width="1000" height="390" data-intrinsic-detail-size/);
 assert.match(css,/\.scene-visit \.scene-art img\[data-intrinsic-visit-size\],[\s\S]*?\.scene-art-detail img\[data-intrinsic-detail-size\]\{height:auto\}/);
});
