import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import {next,lock} from './fixtures/pre-training-workload-scenarios.js';
import {getTeachingTimingContext} from '../src/teaching-timing-context.js';
import {renderTeachingTiming} from '../src/teaching-timing-view.js';
const context=(s,extra={})=>getTeachingTimingContext(s,{actorId:'protagonist',cellId:'E4',actionId:s.year===10?'fund_school':'train_network',...extra});
function at(year,producer=api,school=false){const s=producer.createRun(0);next(s,producer);if(year>=20){if(school)lock(s,'protagonist','E4','fund_school',producer);next(s,producer);}if(year===30)next(s,producer);return s;}
for(const [name,producer] of [['current',api],['old workload',old],['legacy',legacy]])for(const year of [10,20,30])test(`${name} year${year} chronological dates and immutable world`,()=>{
 const s=at(year,producer),before=JSON.stringify(s),v=context(s);assert.ok(v);assert.equal(v.dueYear,year+1);assert.deepEqual(v.events.map(e=>e.year),[year+1,23].sort((a,b)=>a-b));
 const card=renderTeachingTiming(v,'card'),contract=renderTeachingTiming(v);assert.ok(card.includes(String(year+1)));assert.ok(contract.includes('第23年'));assert.equal(JSON.stringify(s),before);
 if(year===30)assert.match(v.timing,/不能降低已经记下/);else assert.match(v.timing,/早于第23年/);
 if(name==='legacy'){assert.equal(v.model,'legacy-overall');assert.equal(v.currentCoverage,null);assert.equal(v.conditionalCoverage,null);assert.ok(!contract.includes('0.55'));assert.match(contract,/旧整体/);}else {assert.equal(v.model,'regional');assert.equal(v.schoolCoverage,.55);assert.equal(v.conditionalCoverage,Math.max(v.currentCoverage,.55));assert.match(contract,/足额维护/);assert.match(contract,/不叠加/);assert.match(contract,/不是人口比例、伤亡比例或成功概率/);}
});
for(const producer of [api,old])test(`existing natural school retains maximum coverage (${producer===api?'current':'old'})`,()=>{const s=at(20,producer,true),v=context(s);assert.equal(v.currentCoverage,.55);assert.equal(v.conditionalCoverage,.55);assert.notEqual(v.conditionalCoverage,1.1);});
test('current public coverage agrees exactly without invented future output',()=>{const s=at(20),v=context(s);assert.equal(v.currentCoverage,api.getWarningCoverage(s).E4.coverage);assert.equal(v.currentCoverage,0);assert.equal(v.conditionalCoverage,.55);assert.match(renderTeachingTiming(v),/其他载体保持现状/);assert.match(renderTeachingTiming(v),/同轮新建的人手不能反过来提高/);});
test('available companion reads same timing with her own actor',()=>{const s=at(10);lock(s,'protagonist','D4','recruit_volunteer',api);next(s,api);const v=context(s,{actorId:'linche'});assert.equal(v.actorId,'linche');assert.equal(v.dueYear,21);});
for(const extra of [{actorId:'unknown'},{cellId:'D4'},{actionId:'authorize_training'},{actionId:'fund_school'}])test('unknown or unavailable request omitted '+JSON.stringify(extra),()=>assert.equal(context(at(20),extra),null));
for(const value of [null,{}, {phase:'ended',year:20},{phase:'planning',year:15}])test('incomplete or nonplanning state omitted '+JSON.stringify(value),()=>assert.equal(getTeachingTimingContext(value,{actorId:'protagonist',cellId:'E4',actionId:'train_network'}),null));
test('actual committed state is not a new available contract',()=>{const s=at(20);for(const actor of api.getActors(s))api.passTask(s,actor.id);api.commitWindow(s);assert.equal(context(s),null);});
test('frozen state remains readable',()=>{const s=at(20);const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}};freeze(s);assert.ok(context(s));});
test('invalid view and mode omit markup',()=>{assert.equal(renderTeachingTiming(null),'');assert.equal(renderTeachingTiming(context(at(20)),'other'),'');});
test('render escapes labels and actor-independent action attributes',()=>{const v=context(at(20));v.actionId='"><img src=x>';v.events[0].label='<script>x</script>';assert.ok(!renderTeachingTiming(v).includes('<script>'));assert.ok(!renderTeachingTiming(v).includes('<img'));});

test('legacy card identifies overall rules without regional coefficient promises',()=>{const card=renderTeachingTiming(context(at(20,legacy)),'card');assert.match(card,/旧档仍按整体规则结算/);assert.ok(!card.includes('0.55'));});
test('regional card does not mislabel current model as old',()=>{const card=renderTeachingTiming(context(at(20)),'card');assert.ok(!card.includes('旧档'));assert.match(card,/第21年/);});
