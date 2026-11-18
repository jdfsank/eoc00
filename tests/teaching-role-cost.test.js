import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {next,lock} from './fixtures/pre-training-workload-scenarios.js';
import {getTeachingTimingContext} from '../src/teaching-timing-context.js';
import {renderTeachingTiming} from '../src/teaching-timing-view.js';
function route(){const s=sim.createRun(0);next(s,sim);lock(s,'protagonist','D4','recruit_volunteer',sim);next(s,sim);lock(s,'protagonist','E4','train_network',sim);next(s,sim);return s;}
for(const actorId of ['protagonist','linche'])test(`final teaching states the correct role cost: ${actorId}`,()=>{
 const s=route(),before=JSON.stringify(s),v=getTeachingTimingContext(s,{actorId,cellId:'E4',actionId:'train_network'});assert.ok(v.roleCost);
 for(const mode of ['card','contract']){const html=renderTeachingTiming(v,mode);assert.match(html,/data-teaching-role-cost/);assert.match(html,/不能代签/);assert.match(html,actorId==='protagonist'?/提交本项就不签方针/:/不占.*名额，也不代签/);}
 if(actorId==='linche')assert.ok(!v.handoffGap?.detail.includes('或签署交班方针'));
 assert.equal(JSON.stringify(s),before);
});
test('role cost is independent of missing-check conditions and escapes content',()=>{const s=sim.createRun(1);next(s,sim);next(s,sim);next(s,sim);const v=getTeachingTimingContext(s,{actorId:'protagonist',cellId:'E4',actionId:'train_network'});assert.equal(v.handoffGap,null);assert.ok(v.roleCost);v.roleCost.summary='<img src=x>';assert.ok(!renderTeachingTiming(v).includes('<img'));});
test('earlier teaching does not claim a final policy opportunity',()=>{const s=sim.createRun(1);next(s,sim);next(s,sim);assert.equal(getTeachingTimingContext(s,{actorId:'protagonist',cellId:'E4',actionId:'train_network'}).roleCost,null);});
