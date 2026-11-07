import test from 'node:test';
import assert from 'node:assert/strict';
import {getStageBoundaryContext as context} from '../src/stage-boundary-context.js';
import {getDecadeReview} from '../src/decade-review.js';
import {getStageDecadeReview} from '../src/stage-decade-review.js';
import * as current from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';

for (const year of [0,10,20,30]) test(`planning ${year} identifies the actual next boundary`,()=>{
 const c=context({year,phase:'planning'});
 assert.equal(c.nextDestination.year,year+10);
 assert.equal(c.nextDestination.kind,year===30?'archive':'window');
 assert.equal(c.review?.end,year||undefined);
 assert.equal(c.review?.action,year?'home':undefined);
 assert.equal(c.review?.label,year?`进入第 ${year} 年窗口 →`:undefined);
 assert.equal(c.terminal,false);
});
for (let year=0;year<40;year++) test(`playback ${year} names the reached decade's destination, not a new choice`,()=>{
 const c=context({year,phase:'playback'}),due=Math.floor(year/10)*10+10;
 assert.equal(c.review,null);assert.equal(c.nextDestination.year,due);
 assert.equal(c.nextDestination.label,`第 ${due} 年${year>=30?'归档':'窗口'}`);
 assert.equal(c.nextDestination.skipLabel,`略过逐条阅读，到第 ${due} 年${year>=30?'归档':'窗口'}`);
 if(year>=30){assert.match(c.nextDestination.commitCaution,/不再有新的介入窗口/);assert.doesNotMatch(c.nextDestination.label,/窗口/);}
});
test('ended40 is a terminal review and unmodeled future, never another window',()=>{
 const c=context({year:40,phase:'ended'});
 assert.equal(c.nextDestination,null);assert.equal(c.terminal,true);
 assert.deepEqual(c.review,{start:30,end:40,terminal:true,action:'ending',label:'阅读第 40 年结局 →',actorCountLabel:'参与者',title:'最后十年回顾',summary:'第40年已归档。本阶段不再新增介入，可以阅读结局或核对已经发生的记录。'});
 assert.match(c.archive.body,/第40年以后的历史未在本原型中模拟/);
 assert.doesNotMatch(c.archive.body,/未来取决于|固定随机结果/);
});
test('invalid and stale clocks cannot fabricate review or destination',()=>{
 for(const s of [null,{},[],{year:'40',phase:'ended'},{year:40,phase:'planning'},{year:40,phase:'playback'},{year:39,phase:'ended'},{year:41,phase:'ended'},{year:-1,phase:'playback'},{year:1.5,phase:'playback'},{year:5,phase:'planning'},{year:NaN,phase:'planning'},{year:0,phase:'unknown'}])assert.equal(context(s),null);
});
test('only own public data fields are read; getters and hidden state cannot influence copy',()=>{
 const state={year:40,phase:'ended'};
 for(const field of ['drafts','events','history','actors','institutions','flags','seed','roll','snapshots'])Object.defineProperty(state,field,{get(){throw Error(`forbidden ${field}`)}});
 assert.equal(context(state).terminal,true);
 assert.equal(context(Object.create({year:40,phase:'ended'})),null);
 assert.equal(context({get year(){throw Error('year getter');},phase:'ended'}),null);
 assert.equal(context({year:40,get phase(){throw Error('phase getter');}}),null);
});
for(const [name,api] of [['current',current],['old',old],['legacy',legacy]])test(`${name}: genuine full route preserves world and historical prose at every year`,()=>{
 const state=api.createRun(12);
 for(let decade=0;decade<4;decade++){
  let before=JSON.stringify(state);const planning=context(state);assert.equal(planning.kind,'planning');
  if(decade){assert.deepEqual(getStageDecadeReview(state),getDecadeReview(state));assert.equal(planning.review.end,state.year);assert.match(getDecadeReview(state).cards[0].responsibility,/下一次介入/);}
  assert.equal(JSON.stringify(state),before);
  for(const actor of api.getActors(state))api.passTask(state,actor.id);api.commitWindow(state);
  for(let i=0;i<10;i++){before=JSON.stringify(state);assert.equal(context(state).nextDestination.year,(decade+1)*10);assert.equal(JSON.stringify(state),before);api.advanceYear(state);}
 }
 const before=JSON.stringify(state),history=JSON.stringify(state.history),review=getStageDecadeReview(state);
 assert.equal(context(state).review.action,'ending');assert.equal(review.cards.length,1);
 assert.match(review.cards[0].responsibility,/本阶段的介入已经结束/);assert.doesNotMatch(review.cards[0].responsibility,/下一次介入/);
 assert.equal(JSON.stringify(state.history),history);assert.equal(JSON.stringify(state),before);assert.equal(api.validateState(state).valid,true);
});

for(const [name,api] of [['current',current],['old',old],['legacy',legacy]])test(`${name}: terminal adapter changes only verified pass responsibility and preserves missing/conflicting sources`,()=>{
 const state=api.createRun(12);
 for(let decade=0;decade<4;decade++){for(const actor of api.getActors(state))api.passTask(state,actor.id);api.commitWindow(state);api.advanceToNextWindow(state);}
 const before=JSON.stringify(state),original=getDecadeReview(state),adapted=getStageDecadeReview(state);
 assert.match(original.cards[0].responsibility,/下一次介入/);
 assert.notEqual(adapted.cards[0].responsibility,original.cards[0].responsibility);
 const restored=structuredClone(adapted);restored.cards[0].responsibility=original.cards[0].responsibility;
 assert.deepEqual(restored,original);assert.equal(JSON.stringify(state),before);
 for(const mutate of [s=>s.history=s.history.filter(h=>h.id!=='pass:30:protagonist'),s=>s.history.push(structuredClone(s.history.find(h=>h.id==='pass:30:protagonist'))),s=>s.history.find(h=>h.id==='pass:30:protagonist').kind='action']){
  const damaged=structuredClone(state);mutate(damaged);const snapshot=JSON.stringify(damaged);
  assert.deepEqual(getStageDecadeReview(damaged),getDecadeReview(damaged));
  assert.doesNotMatch(getStageDecadeReview(damaged).cards[0].responsibility,/本阶段的介入已经结束/);
  assert.equal(JSON.stringify(damaged),snapshot);
 }
});
