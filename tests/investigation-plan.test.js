import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {getInvestigationPlan,getActionInvestigation} from '../src/investigation-plan.js';
import {getActionPreview} from '../src/action-preview.js';
import {getCrisisOutlook} from '../src/crisis-outlook.js';
import {restoreSave} from '../src/save.js';
import {investigateAndLock as lock} from './helpers/play.js';

const clone=structuredClone;
const action=(view,id)=>view.actions.find(row=>row.actionId===id);
const material=(view,id)=>view.materials.find(row=>row.id===id);
function next(state,api=sim) {
  for(const actor of api.getActors(state))if(!state.drafts[actor.id])api.passTask(state,actor.id);
  api.commitWindow(state);api.advanceToNextWindow(state);return state;
}
function to20({seed=12,build=false,records=false}={}) {
  const state=sim.createRun(seed);
  if(build)lock(state,'protagonist','D4','build_joint');
  if(records)lock(state,'protagonist','B4','preserve_records');
  next(state);lock(state,'protagonist','D4',build?'recruit_successor':'recruit_volunteer');next(state);return state;
}
function to30(options={}) {
  const state=to20(options);
  lock(state,'protagonist','B4',options.review?'independent_review':'local_veto');
  if(options.warning)lock(state,'linche','D4','free_warning');
  next(state);return state;
}
function freeze(value) {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {for(const child of Object.values(value))freeze(child);Object.freeze(value);}
  return value;
}
function trap(target,key) {Object.defineProperty(target,key,{enumerable:true,configurable:true,get(){throw Error(`Hidden ${key}`);}});}

test('scope is a real actor and local contract in a modern planning window',()=>{
  const state=sim.createRun(12);
  assert.equal(getInvestigationPlan(null,'D4'),null);
  assert.equal(getInvestigationPlan(state,'A1'),null);
  assert.equal(getInvestigationPlan(state,'D4','linche'),null);
  assert.equal(getInvestigationPlan(state,'D4','missing'),null);
  assert.equal(getInvestigationPlan({...state,phase:'playback'},'D4'),null);
  assert.equal(getInvestigationPlan({...state,planningRulesVersion:undefined},'D4'),null);
  assert.equal(getActionInvestigation({...state,planningRulesVersion:undefined},'D4','protagonist',[]),null);
});

test('year0 separates two mandatory joint materials from zero-evidence alternatives',()=>{
  const state=sim.createRun(12),before=JSON.stringify(state),view=getInvestigationPlan(state,'D4');
  assert.equal(view.readOnly,true);assert.equal(view.budget,3);assert.equal(view.spent,0);assert.equal(view.maxBudget,3);
  const joint=action(view,'build_joint');
  assert.deepEqual(joint.missingEvidenceIds,['independent_flood_records','unfunded_maintenance']);
  assert.equal(joint.requiredRounds,2);assert.equal(joint.budgetAfter,1);assert.equal(joint.reachable,true);
  for(const id of ['build_state','build_merchant']) {assert.equal(action(view,id).requiredRounds,0);assert.equal(action(view,id).reachable,true);}
  assert.deepEqual(material(view,'independent_flood_records').requiredBy,['build_joint']);
  assert.equal(material(view,'independent_flood_records').portable,true);
  assert.equal(material(view,'unfunded_maintenance').portable,false);
  assert.deepEqual(material(view,'resident_testimony').requiredBy,[]);
  assert.deepEqual(material(view,'resident_testimony').enhances,[]);
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,[]);
  assert.equal(JSON.stringify(state),before);
  assert.throws(()=>sim.lockTask(state,'protagonist','D4','build_joint'),/证据/);
});

test('year0 portable records travel but locally gathered maintenance does not',()=>{
  const state=sim.createRun(12);
  sim.investigate(state,'protagonist','B4','independent_flood_records');
  sim.investigate(state,'protagonist','B4','unfunded_maintenance');
  const view=getInvestigationPlan(state,'D4'),joint=action(view,'build_joint');
  assert.equal(view.budget,1);assert.equal(joint.requiredRounds,1);assert.equal(joint.reachable,true);
  assert.deepEqual(joint.missingEvidenceIds,['unfunded_maintenance']);
  assert.equal(material(view,'independent_flood_records').acquired,true);
  assert.equal(material(view,'independent_flood_records').canInvestigate,false);
  assert.equal(material(view,'independent_flood_records').budgetAfter,1);
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,['build_joint']);
  sim.investigate(state,'protagonist','D4','unfunded_maintenance');
  assert.equal(action(getInvestigationPlan(state,'D4'),'build_joint').requiredRounds,0);
  assert.equal(sim.getInvestigation(state,'protagonist','D4').budget,0);
});

test('year10 succession consent remains local and the third background reading closes succession',()=>{
  const state=sim.createRun(0);lock(state,'protagonist','D4','build_joint');next(state);
  assert.equal(state.flags.stationBuilt,true);
  let view=getInvestigationPlan(state,'D4');
  assert.equal(action(view,'recruit_successor').requiredRounds,1);
  assert.equal(action(view,'renew_charter').requiredRounds,0);
  sim.investigate(state,'protagonist','B4','successor_consent');
  sim.investigate(state,'protagonist','D4','unfunded_maintenance');
  view=getInvestigationPlan(state,'D4');
  assert.equal(view.budget,1);assert.equal(material(view,'successor_consent').acquired,false);
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,['recruit_successor']);
  sim.investigate(state,'protagonist','D4','resident_testimony');
  view=getInvestigationPlan(state,'D4');
  assert.equal(action(view,'recruit_successor').reachable,false);
  assert.equal(action(view,'recruit_risk').reachable,true);assert.equal(action(view,'renew_charter').reachable,true);
});

test('year20 optional two-round evacuation is separate from mandatory review and basic veto',()=>{
  const state=to20(),view=getInvestigationPlan(state,'B4');
  assert.equal(action(view,'independent_review').requiredRounds,2);
  const veto=action(view,'local_veto'),extra=veto.optionalEnhancements[0];
  assert.equal(veto.requiredRounds,0);assert.deepEqual(veto.requiredEvidence,[]);
  assert.equal(extra.id,'surveyed_veto');assert.equal(extra.requiredRounds,2);assert.equal(extra.budgetAfter,1);
  const routes=material(view,'evacuation_routes');
  assert.deepEqual(routes.requiredBy,[]);
  assert.deepEqual(routes.enhances,[{actionId:'local_veto',enhancementId:'surveyed_veto'}]);
  assert.deepEqual(routes.blocksAfter,['independent_review']);
  const anomaly=material(view,'anomaly_records');
  assert.deepEqual(anomaly.blocksAfter,[]);
  assert.deepEqual(anomaly.enhancementsLostAfter,[{actionId:'local_veto',enhancementId:'surveyed_veto'}]);
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,[]);
  assert.deepEqual(material(view,'old_reality_record').enhances,[]);
});

test('only newly lost routes are attributed to a reading and impossible readings are not simulated',()=>{
  const state=to20();sim.investigate(state,'protagonist','D4','old_reality_record');
  let view=getInvestigationPlan(state,'B4'),reading=material(view,'resident_testimony');
  assert.equal(view.budget,2);
  assert.deepEqual(reading.blocksAfter,['independent_review']);
  assert.deepEqual(reading.enhancementsLostAfter,[{actionId:'local_veto',enhancementId:'surveyed_veto'}]);
  sim.investigate(state,'protagonist','B4','resident_testimony');view=getInvestigationPlan(state,'B4');
  assert.equal(action(view,'independent_review').reachable,false);assert.equal(action(view,'local_veto').reachable,true);
  for(const id of ['anomaly_records','evacuation_routes']) {
    const row=material(view,id);assert.equal(row.canInvestigate,false);assert.equal(row.budgetAfter,null);
    assert.deepEqual(row.blocksAfter,[]);assert.deepEqual(row.enhancementsLostAfter,[]);
  }
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,[]);
});

test('shared actor budget and portable materials do not cross actor boundaries',()=>{
  const state=to20();sim.investigate(state,'protagonist','F6','anomaly_records');
  const own=getInvestigationPlan(state,'B4'),other=getInvestigationPlan(state,'B4','linche');
  assert.equal(own.budget,1);assert.equal(action(own,'independent_review').requiredRounds,0);
  assert.equal(material(own,'anomaly_records').acquired,true);
  assert.equal(other.budget,3);assert.equal(action(other,'independent_review').requiredRounds,2);
  sim.investigate(state,'linche','F6','evacuation_routes');
  const travel=getInvestigationPlan(state,'B4','linche');
  assert.equal(action(travel,'local_veto').optionalEnhancements[0].acquired,true);
  assert.equal(action(travel,'local_veto').optionalEnhancements[0].requiredRounds,0);
  assert.equal(material(getInvestigationPlan(state,'B4'),'evacuation_routes').acquired,false);
});

for(const records of [false,true])test(`year30 ${records?'archive upgrade':'new future check'} shows a one-round distraction closing the three-round contract`,()=>{
  const state=to30({records}),id=records?'upgrade_archive_check':'establish_future_check';
  let view=getInvestigationPlan(state,'B4'),row=action(view,id);
  assert.equal(row.requiredRounds,3);assert.equal(row.reachable,true);
  assert.deepEqual(material(view,'old_reality_record').blocksAfter,[id]);
  assert.deepEqual(material(view,'anomaly_records').blocksAfter,[]);
  assert.deepEqual(material(view,'resident_testimony').blocksAfter,[]);
  sim.investigate(state,'protagonist','D4','old_reality_record');view=getInvestigationPlan(state,'B4');
  row=action(view,id);assert.equal(view.budget,2);assert.equal(row.requiredRounds,3);assert.equal(row.reachable,false);assert.equal(row.budgetAfter,-1);
  assert.deepEqual(material(view,'anomaly_records').blocksAfter,[],'already inaccessible is not blamed on another reading');
  const preview=getActionPreview(state,'B4','protagonist',id);
  assert.equal(preview.canLock,false);assert.deepEqual(preview.investigation,{budget:2,requiredRounds:3,budgetAfter:-1,reachable:false});
  sim.investigate(state,'protagonist','B4','anomaly_records');
  assert.throws(()=>sim.investigate(state,'protagonist','B4','resident_testimony'),/轮次不足/);
  assert.throws(()=>sim.lockTask(state,'protagonist','B4',id),/证据/);
});

test('year30 B4 testimony from another place cannot fill a three-round contract',()=>{
  const state=to30();sim.investigate(state,'protagonist','D4','resident_testimony');
  const view=getInvestigationPlan(state,'B4'),row=action(view,'establish_future_check');
  assert.equal(material(view,'resident_testimony').acquired,false);
  assert.equal(row.requiredRounds,3);assert.equal(row.reachable,false);
});

test('year30 mandate needs one real E4 testimony while new training remains a zero-evidence choice',()=>{
  const state=to30({seed:0,build:true,review:true,warning:true});
  let view=getInvestigationPlan(state,'E4','linche');
  assert.equal(action(view,'authorize_training').requiredRounds,1);
  assert.equal(action(view,'train_network').requiredRounds,0);
  assert.deepEqual(material(view,'resident_testimony').requiredBy,['authorize_training']);
  assert.deepEqual(material(view,'anomaly_records').requiredBy,[]);
  sim.investigate(state,'linche','D5','resident_testimony');
  sim.investigate(state,'linche','E4','old_reality_record');
  view=getInvestigationPlan(state,'E4','linche');
  assert.equal(action(view,'authorize_training').requiredRounds,1);assert.equal(view.budget,1);
  sim.investigate(state,'linche','E4','resident_testimony');
  view=getInvestigationPlan(state,'E4','linche');
  assert.equal(action(view,'authorize_training').requiredRounds,0);assert.equal(action(view,'train_network').reachable,true);
  assert.equal(view.budget,0);
});

test('year30 failed review keeps its two-round recovery requirement without promising future completion',()=>{
  let state;
  for(let seed=0;seed<50;seed++) {const candidate=to30({seed,review:true});if(candidate.events.some(event=>event.actionId==='independent_review'&&event.status==='failed')) {state=candidate;break;}}
  assert.ok(state);
  const view=getInvestigationPlan(state,'B4');
  assert.equal(action(view,'complete_review').requiredRounds,2);
  assert.equal(view.materials.some(row=>row.id==='evacuation_routes'),false);
  assert.equal(view.actions.some(row=>row.actionId==='establish_future_check'),false);
  assert.doesNotMatch(JSON.stringify(view),/futureOutcome|projected|probability|damage|canCommit/);
});

test('reachability is not affordability, same-cell clearance, or another actors arrangement',()=>{
  const state=to20();state.cells.find(cell=>cell.id==='B4').channels.science=0;
  sim.lockTask(state,'linche','B4','local_veto');
  const view=getInvestigationPlan(state,'B4');
  assert.equal(action(view,'independent_review').reachable,true);
  assert.equal(action(view,'local_veto').reachable,true);
  assert.equal(Object.hasOwn(view,'ready'),false);assert.equal(Object.hasOwn(view,'canCommit'),false);
  sim.investigate(state,'protagonist','B4','anomaly_records');sim.lockTask(state,'protagonist','B4','independent_review');
  assert.equal(getActionPreview(state,'B4','protagonist','independent_review').canLock,true);
  assert.equal(sim.getWindowReview(state).ready,false);
});

test('post-lock optional investigation changes the fresh preview but never upgrades the locked snapshot',()=>{
  const state=to20();sim.lockTask(state,'protagonist','B4','local_veto');sim.passTask(state,'linche');
  const draft=clone(state.drafts.protagonist);
  sim.investigate(state,'protagonist','B4','evacuation_routes');
  const before=JSON.stringify(state),view=getInvestigationPlan(state,'B4'),preview=getActionPreview(state,'B4','protagonist','local_veto');
  assert.equal(action(view,'local_veto').optionalEnhancements[0].acquired,true);
  assert.equal(preview.investigation.requiredRounds,0);assert.match(preview.action.reward,/0\.20/);
  assert.deepEqual(state.drafts.protagonist,draft);assert.equal(JSON.stringify(state),before);
  assert.equal(getCrisisOutlook(state).vetoBase,.3);
  sim.commitWindow(state);
  assert.deepEqual(state.events.find(event=>event.actionId==='local_veto').evidence,[]);
  sim.advanceYear(state);
  assert.equal(state.flags.vetoMitigation,.3);
});

test('frozen inputs, hidden getters, returned objects and alternate seeds cannot turn planning into simulation',()=>{
  const states=[sim.createRun(12),to20(),to30({records:true}),to30({seed:0,build:true,review:true,warning:true})];
  for(const state of states)for(const cellId of ['D4','B4','E4','F6']) {
    const expected=getInvestigationPlan(state,cellId);if(!expected)continue;
    const before=JSON.stringify(state),hidden=clone(state);
    for(const key of ['seed','random','roll','snapshots','baseline','privateEvidence','hiddenEvidenceBody','drafts'])trap(hidden,key);
    // The plan may read public past event identities/statuses, never saved
    // random draws, descriptive evidence bodies or predicted future results.
    for(const event of hidden.events)for(const key of ['roll','text','hiddenEvidenceBody','futureOutcome'])trap(event,key);
    for(const entry of hidden.history)for(const key of ['text','privateBody'])trap(entry,key);
    for(const entries of Object.values(hidden.investigations))for(const entry of entries)trap(entry,'body');
    assert.deepEqual(getInvestigationPlan(hidden,cellId),expected);
    assert.deepEqual(getInvestigationPlan(freeze(clone(state)),cellId),expected);
    assert.deepEqual(getInvestigationPlan({...state,seed:'different'},cellId),expected);
    const objects=new Set(),walk=(value,visit)=>{if(value&&typeof value==='object'){visit(value);for(const child of Object.values(value))walk(child,visit);}};
    walk(state,value=>objects.add(value));const view=getInvestigationPlan(state,cellId);walk(view,value=>assert.equal(objects.has(value),false));
    view.actions[0].title='changed';view.actions[0].requiredEvidence.push({id:'invented'});view.materials[0].requiredBy.push('invented');
    assert.equal(JSON.stringify(state),before);assert.deepEqual(getInvestigationPlan(state,cellId),expected);
  }
});

test('true pre-tradeoffs saves retain original preview shape and continue bytewise unchanged',()=>{
  const original=legacy.createRun(12);
  for(let window=0;window<4;window++) {
    const state=restoreSave({state:clone(original)}).state,before=JSON.stringify(state);
    for(const cellId of ['D4','B4','E4','D5','F6']) {
      assert.equal(getInvestigationPlan(state,cellId),null);
      for(const contract of legacy.getActions(original,cellId)) {
        const preview=getActionPreview(state,cellId,'protagonist',contract.id,contract.requireEvidence);
        assert.equal(preview.canLock,true);assert.equal(Object.hasOwn(preview,'investigation'),false);
        assert.deepEqual(Object.keys(preview).sort(),['action','canLock','missing']);
      }
    }
    assert.equal(JSON.stringify(state),before);
    next(state);next(original,legacy);assert.deepEqual(state,original);
  }
  assert.equal(original.phase,'ended');assert.equal(getInvestigationPlan(original,'D4'),null);
});

test('every advertised one-reading loss agrees with actual investigation on natural routes',()=>{
  const year10=sim.createRun(0);lock(year10,'protagonist','D4','build_joint');next(year10);
  const states=[sim.createRun(12),year10,to20(),to30(),to30({records:true}),to30({seed:0,build:true,review:true,warning:true})];
  let checked=0;
  for(const state of states)for(const actor of sim.getActors(state))for(const cellId of ['D4','B4','E4','D5','F6']) {
    const initial=getInvestigationPlan(state,cellId,actor.id);if(!initial)continue;
    // Include the already-spent states reached by each first legal reading.
    const cases=[state];
    for(const row of initial.materials.filter(row=>row.canInvestigate)) {const copy=clone(state);sim.investigate(copy,actor.id,cellId,row.id);cases.push(copy);}
    for(const current of cases) {
      const view=getInvestigationPlan(current,cellId,actor.id);
      for(const row of view.materials.filter(row=>row.canInvestigate)) {
        const copy=clone(current);sim.investigate(copy,actor.id,cellId,row.id);
        const after=getInvestigationPlan(copy,cellId,actor.id);
        assert.equal(after.budget,row.budgetAfter);
        assert.deepEqual(row.blocksAfter,view.actions.filter(before=>before.reachable&&!action(after,before.actionId).reachable).map(before=>before.actionId));
        assert.deepEqual(row.enhancementsLostAfter,view.actions.flatMap(before=>before.optionalEnhancements.filter(extra=>extra.reachable&&!action(after,before.actionId).optionalEnhancements.find(item=>item.id===extra.id).reachable).map(extra=>({actionId:before.actionId,enhancementId:extra.id}))));
        for(const item of after.actions) {
          const actual=clone(copy);
          if(item.reachable) {
            for(const id of item.missingEvidenceIds)sim.investigate(actual,actor.id,cellId,id);
            assert.equal(getActionPreview(actual,cellId,actor.id,item.actionId).canLock,true);
          } else assert.ok(item.requiredRounds>after.budget);
        }
        checked++;
      }
    }
  }
  assert.ok(checked>100,`checked ${checked} natural investigations`);
});
