import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import {next,lock as currentLock} from './fixtures/pre-training-workload-scenarios.js';
import {getTeachingTimingContext} from '../src/teaching-timing-context.js';
import {renderTeachingTiming} from '../src/teaching-timing-view.js';
function lock(s,actor,cell,id,producer){if(producer.getInvestigation)return currentLock(s,actor,cell,id,producer);const a=producer.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a);return producer.lockTask(s,actor,cell,id,a.requireEvidence);}
const context=s=>getTeachingTimingContext(s,{actorId:'protagonist',cellId:'E4',actionId:'train_network'});
function route(producer=api,authorized=true){
 const s=producer.createRun(0);lock(s,'protagonist','D4','build_joint',producer);next(s,producer);
 if(authorized)lock(s,'protagonist','D4','renew_charter',producer);
 next(s,producer);return s;
}
for(const year of [20,30])test(`natural authorized staff without check: year ${year}`,()=>{
 const s=route();if(year===30)next(s,api);const before=JSON.stringify(s),v=context(s);
 assert.ok(api.getHandoffReadiness(s).authorizedCells.length);assert.equal(api.getHandoffReadiness(s).checks.length,0);
 assert.ok(v.handoffGap);assert.deepEqual(v.handoffGap.authorizedCells,api.getHandoffReadiness(s).authorizedCells);
 for(const mode of ['card','contract'])assert.match(renderTeachingTiming(v,mode),/已有获授权的承接人手，当前仍缺异源校验/);
 const html=renderTeachingTiming(v);assert.match(html,/仍可增加当地维护产出/);assert.match(html,/本角色本轮一个名额/);
 assert.match(html,year===20?/不能同时用于交叉复核/:/不能同时用于未来校验或签署交班方针/);
 assert.equal(JSON.stringify(s),before);
});
test('natural no staff and unauthorized staff do not claim authorization',()=>{
 const empty=api.createRun(0);next(empty,api);next(empty,api);
 assert.equal(context(empty).handoffGap,null);
 const unapproved=route(api,false);assert.ok(api.getHandoffReadiness(unapproved).staff.length);
 assert.equal(api.getHandoffReadiness(unapproved).authorizedStaff.length,0);assert.equal(context(unapproved).handoffGap,null);
});
test('successful cross-region review removes the missing-check warning',()=>{
 const s=route();lock(s,'protagonist','F6','independent_review',api);next(s,api);
 assert.ok(api.getHandoffReadiness(s).canWithdraw);assert.equal(context(s).handoffGap,null);
 assert.ok(!renderTeachingTiming(context(s)).includes('data-teaching-handoff-gap'));
});
test('inactive check is not mistaken for currently working check (detached boundary)',()=>{
 const s=route();lock(s,'protagonist','F6','independent_review',api);next(s,api);
 s.institutions.find(i=>i.kind==='independent').active=false;
 assert.ok(context(s).handoffGap);
});
test('actual legacy producer does not receive new handoff semantics',()=>{
 const s=route(legacy),before=JSON.stringify(s);assert.equal(api.usesHandoffRules(s),false);
 assert.equal(context(s).handoffGap,null);assert.ok(!renderTeachingTiming(context(s)).includes('data-teaching-handoff-gap'));assert.equal(JSON.stringify(s),before);
});
test('reading hints at each planning step leaves committed and final bytes identical',()=>{
 for(const producer of [api,legacy]){
  const control=route(producer),viewed=structuredClone(control);
  for(const s of [control,viewed]){if(s===viewed)renderTeachingTiming(context(s));lock(s,'protagonist','E4','train_network',producer);next(s,producer);}
  assert.equal(JSON.stringify(viewed),JSON.stringify(control));
  for(const s of [control,viewed]){if(s===viewed)renderTeachingTiming(context(s),'card');lock(s,'protagonist','D4','withdraw',producer);next(s,producer);}
  assert.equal(JSON.stringify(viewed),JSON.stringify(control));
 }
});
test('dynamic gap strings are escaped in both surfaces',()=>{
 const v=context(route());v.handoffGap.summary='<img src=x>';v.handoffGap.detail='<script>x</script>';
 for(const mode of ['card','contract']){const html=renderTeachingTiming(v,mode);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));}
});
test('same-region check gap is not misreported as no check (detached boundary)',()=>{
 const s=route();lock(s,'protagonist','F6','independent_review',api);next(s,api);
 const check=s.institutions.find(i=>i.kind==='independent');check.cellId='E4';
 for(const staff of s.institutions.filter(i=>['school','training'].includes(i.kind)))staff.cellId='E4';
 const ready=api.getHandoffReadiness(s);assert.equal(ready.checks.length,1);assert.equal(ready.links.length,0);
 assert.equal(context(s).handoffGap,null);
});
test('another role pending check is not a currently working check or a guaranteed outcome',()=>{
 const s=api.createRun(0);next(s,api);lock(s,'protagonist','D4','recruit_volunteer',api);next(s,api);
 lock(s,'protagonist','E4','train_network',api);next(s,api);
 assert.ok(api.getActors(s).some(a=>a.id==='linche'));
 lock(s,'linche','B4','establish_future_check',api);
 const before=JSON.stringify(s),v=context(s);assert.ok(v.handoffGap);assert.match(v.handoffGap.summary,/当前仍缺/);
 assert.match(v.handoffGap.detail,/不把本轮安排当作已完成校验/);
 assert.match(v.handoffGap.detail,/其他角色是否能补足，须看各自可用行动和名额/);
 assert.equal(JSON.stringify(s),before);assert.equal(api.getHandoffReadiness(s).checks.length,0);
});
test('frozen world remains readable and returned cell labels are detached',()=>{
 const s=route(),before=JSON.stringify(s);const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}};freeze(s);
 const v=context(s);assert.ok(v.handoffGap);v.handoffGap.authorizedCells.push('invented');
 assert.equal(JSON.stringify(s),before);assert.ok(!context(s).handoffGap.authorizedCells.includes('invented'));
});
