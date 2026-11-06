import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import * as original from './fixtures/pre-tradeoffs-simulation.js';
import {getCrossLocationInvestigation as cross} from '../src/investigation-cross-location.js';
import {getInvestigationPlan} from '../src/investigation-plan.js';
import {restoreSave} from '../src/save.js';

const copy = structuredClone, bytes = JSON.stringify;
const row = (view, id) => view.materials.find(item => item.id === id);
function lock(s, actorId, cellId, actionId, api = sim) {
  const action = api.getActions(s, cellId, actorId).find(item => item.id === actionId);
  assert.ok(action, `${s.year}/${actorId}/${cellId}/${actionId}`);
  if (api.usesTradeoffs?.(s)) for (const id of action.requireEvidence)
    if (!api.getInvestigation(s, actorId, cellId).evidence.includes(id)) api.investigate(s, actorId, cellId, id);
  api.lockTask(s, actorId, cellId, actionId, action.requireEvidence);
}
function next(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s); api.advanceToNextWindow(s); return s;
}
function route({api = sim, build = 'build_joint', review = false, warning = true} = {}) {
  const s = api.createRun(0), states = {0: copy(s)};
  if (build) lock(s, 'protagonist', build === 'preserve_records' ? 'B4' : 'D4', build, api);
  next(s, api); states[10] = copy(s);
  lock(s, 'protagonist', 'D4', build === 'build_joint' ? 'recruit_successor' : 'recruit_volunteer', api);
  next(s, api); states[20] = copy(s);
  if (review) lock(s, 'protagonist', 'B4', 'independent_review', api);
  else if (warning) lock(s, 'protagonist', 'D4', 'free_warning', api);
  else lock(s, 'protagonist', 'B4', 'local_veto', api);
  lock(s, 'linche', review ? 'D4' : 'E4', review ? 'free_warning' : 'train_network', api);
  next(s, api); states[30] = copy(s); return states;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function trap(target, key) { Object.defineProperty(target, key, {configurable:true, enumerable:true, get() {throw Error(`Forbidden private read: ${key}`);}}); }
function findLoss(view, materialId, cellId, actionId) { return row(view, materialId).blocksAfter.find(item => item.cellId === cellId && item.actionId === actionId); }

const natural = route();

test('scope requires a real modern planning window, actor and actionable origin', () => {
  const s = natural[0];
  for (const value of [null, {}, {...s, phase:'playback'}, {...s, year:5}, {...s, planningRulesVersion:undefined}, {...s, planningRulesVersion:'unknown'}]) assert.equal(cross(value,'D4'), null);
  for (const [cell, actor] of [['A1','protagonist'], ['X9','protagonist'], ['D4','missing'], ['D4','linche']]) assert.equal(cross(s,cell,actor),null);
  for (const year of [0,10,20,30]) assert.ok(cross(natural[year],'D4'));
  const ended = copy(natural[30]); next(ended); assert.equal(cross(ended,'D4'),null);
});

test('natural year0: local maintenance bought at B4 does not satisfy D4 joint construction', () => {
  const s=copy(natural[0]);sim.investigate(s,'protagonist','B4','resident_testimony');
  const view=cross(s,'B4'),loss=findLoss(view,'unfunded_maintenance','D4','build_joint');
  assert.deepEqual(loss,{cellId:'D4',cellName:'河港',actionId:'build_joint',title:'联合管理',requiredRoundsBefore:2,requiredRoundsAfter:2,budgetAfter:1});
  assert.deepEqual(row(view,'independent_flood_records').blocksAfter,[],'portable records help the destination, not close it');
  const moved=copy(s);sim.investigate(moved,'protagonist','B4','independent_flood_records');
  assert.equal(getInvestigationPlan(moved,'D4').actions.find(a=>a.actionId==='build_joint').requiredRounds,1);
  assert.ok(cross(s,'D4').materials.every(m=>m.blocksAfter.every(loss=>loss.cellId!=='D4')),'local losses stay with the existing local plan');
});

test('natural year10: same-name consent elsewhere cannot fill the D4 succession requirement', () => {
  const s=copy(natural[10]);sim.investigate(s,'protagonist','B4','resident_testimony');sim.investigate(s,'protagonist','B4','unfunded_maintenance');
  const view=cross(s,'B4'),loss=findLoss(view,'successor_consent','D4','recruit_successor');
  assert.equal(view.budget,1);assert.equal(loss.requiredRoundsBefore,1);assert.equal(loss.requiredRoundsAfter,1);assert.equal(loss.budgetAfter,0);
  assert.equal(row(cross(s,'D4'),'successor_consent').blocksAfter.length,0,'the actual D4 material satisfies succession');
});

test('natural year20: D4 second reading newly closes both reviews and optional stronger veto, never basic veto', () => {
  const s=copy(natural[20]);sim.investigate(s,'protagonist','D4','resident_testimony');
  const view=cross(s,'D4'),reading=row(view,'old_reality_record');
  assert.equal(view.actorName,'主角');assert.equal(view.origin.name,'河港');assert.equal(view.budget,2);assert.equal(reading.budgetAfter,1);
  assert.deepEqual(reading.blocksAfter.map(x=>[x.cellId,x.actionId,x.requiredRoundsBefore,x.requiredRoundsAfter,x.budgetAfter]),[['B4','independent_review',2,2,1],['F6','independent_review',2,2,1]]);
  assert.deepEqual(reading.enhancementsLostAfter.map(x=>[x.cellId,x.enhancementId]),[['B4','surveyed_veto'],['F6','surveyed_veto']]);
  for (const extra of reading.enhancementsLostAfter) {assert.equal(extra.basicRequiresNoEvidence,true);assert.equal(extra.notice,'基本停闸仍无需取证');}
  assert.ok(reading.blocksAfter.every(item=>item.actionId!=='local_veto'));
  assert.deepEqual(view.otherActors,[{actorId:'linche',actorName:'林澈',budget:3}]);
  const first=cross(natural[20],'D4');assert.deepEqual(row(first,'resident_testimony').blocksAfter,[],'one round still leaves enough for the two-round review');
});

test('natural year30: D4 testimony closes B4 new check while portable anomaly remains helpful', () => {
  const s=copy(natural[30]),view=cross(s,'D4'),loss=findLoss(view,'resident_testimony','B4','establish_future_check');
  assert.equal(loss.requiredRoundsBefore,3);assert.equal(loss.requiredRoundsAfter,3);assert.equal(loss.budgetAfter,2);
  assert.deepEqual(row(view,'anomaly_records').blocksAfter,[]);
  sim.investigate(s,'protagonist','D4','anomaly_records');
  const b4=getInvestigationPlan(s,'B4'),check=b4.actions.find(a=>a.actionId==='establish_future_check');
  assert.equal(b4.budget,1);assert.equal(check.requiredRounds,1);assert.equal(check.reachable,true);
  assert.equal(row(cross(s,'D4'),'anomaly_records').acquired,true);assert.equal(row(cross(s,'D4'),'anomaly_records').canInvestigate,false);
  assert.equal(row(cross(s,'D4'),'anomaly_records').budgetAfter,1);assert.deepEqual(row(cross(s,'D4'),'anomaly_records').blocksAfter,[]);
});

test('archive upgrade and failed-review follow-up use their actual current contracts', () => {
  const archive=route({build:'preserve_records',warning:false})[30];
  assert.ok(findLoss(cross(archive,'D4'),'resident_testimony','B4','upgrade_archive_check'));
  const recovery=route({build:null,review:true})[30];
  assert.ok(sim.getActions(recovery,'B4').some(a=>a.id==='complete_review'));
  assert.deepEqual(row(cross(recovery,'D4'),'resident_testimony').blocksAfter,[],'first one-round reading does not close the two-round recovery');
  sim.investigate(recovery,'protagonist','D4','resident_testimony');
  assert.ok(findLoss(cross(recovery,'D4'),'old_reality_record','B4','complete_review'));
});

test('own budget, local acquired evidence and companion inventories stay separate', () => {
  const s=copy(natural[30]);sim.investigate(s,'linche','D5','resident_testimony');
  assert.equal(cross(s,'D4').budget,3);assert.equal(cross(s,'D4').otherActors[0].budget,2);
  assert.equal(cross(s,'E4','linche').budget,2);assert.equal(row(cross(s,'E4','linche'),'resident_testimony').acquired,false);
  assert.deepEqual(row(cross(s,'E4','linche'),'resident_testimony').blocksAfter,[],'B4 already inaccessible for this actor, not newly lost');
  assert.ok(findLoss(cross(s,'D4'),'resident_testimony','B4','establish_future_check'));
  sim.investigate(s,'protagonist','D4','anomaly_records');
  assert.equal(row(cross(s,'B4'),'anomaly_records').acquired,true);assert.equal(row(cross(s,'B4','linche'),'anomaly_records').acquired,false);
});

test('already unreachable, zero budget, unaffordable and acquired materials never invent a new loss', () => {
  const s=copy(natural[20]);sim.investigate(s,'protagonist','D4','resident_testimony');sim.investigate(s,'protagonist','D4','old_reality_record');
  let view=cross(s,'D4');
  for(const id of ['anomaly_records','evacuation_routes']) {assert.equal(row(view,id).canInvestigate,false);assert.equal(row(view,id).budgetAfter,null);}
  for(const material of view.materials) {assert.deepEqual(material.blocksAfter,[]);assert.deepEqual(material.enhancementsLostAfter,[]);}
  sim.investigate(s,'protagonist','E4','resident_testimony');view=cross(s,'D4');assert.equal(view.budget,0);
  for(const material of view.materials) {assert.equal(material.canInvestigate,false);assert.equal(material.budgetAfter,material.acquired?0:null);assert.deepEqual(material.blocksAfter,[]);assert.deepEqual(material.enhancementsLostAfter,[]);}
});

test('locked snapshots and passed actors neither mutate nor become permission to submit', () => {
  const s=copy(natural[20]);sim.lockTask(s,'protagonist','B4','local_veto');sim.passTask(s,'linche');
  const draft=copy(s.drafts.protagonist),before=bytes(s),view=cross(s,'D4');
  assert.equal(bytes(s),before);assert.equal(Object.hasOwn(view,'canCommit'),false);
  const anomaly=row(view,'anomaly_records');assert.ok(anomaly.enhancementsLostAfter.some(x=>x.cellId==='B4'));assert.ok(anomaly.blocksAfter.every(x=>x.actionId!=='local_veto'));
  sim.investigate(s,'protagonist','D4','anomaly_records');assert.deepEqual(s.drafts.protagonist,draft);
  assert.ok(cross(s,'D4').materials.every(m=>m.blocksAfter.every(x=>x.actionId!=='independent_review')),'portable held review evidence cannot be lost by spending remaining time');
  const locked=copy(natural[20]);lock(locked,'protagonist','B4','independent_review');const exact=bytes(locked);
  assert.ok(cross(locked,'D4'));assert.equal(bytes(locked),exact);
  assert.ok(cross(locked,'D4').materials.every(m=>m.blocksAfter.every(x=>x.actionId!=='independent_review')));
});

test('frozen purity, no aliases, hidden fields and draft internals never turn this read into a future', () => {
  for(const state of [natural[0],natural[10],natural[20],natural[30],route({build:'preserve_records',warning:false})[30],route({review:true})[30]]) {
    const expected=cross(state,'D4'),before=bytes(state),hidden=copy(state);
    for(const key of ['seed','random','roll','snapshots','baseline','privateEvidence','hiddenEvidenceBody','drafts'])trap(hidden,key);
    for(const event of hidden.events)for(const key of ['roll','text','futureOutcome','hiddenEvidenceBody'])trap(event,key);
    for(const entry of hidden.history)for(const key of ['text','privateBody'])trap(entry,key);
    for(const entries of Object.values(hidden.investigations))for(const entry of entries)trap(entry,'body');
    assert.deepEqual(cross(hidden,'D4'),expected);assert.deepEqual(cross(freeze(copy(state)),'D4'),expected);
    assert.deepEqual(cross({...state,seed:'another-unread-seed'},'D4'),expected);
    const originalObjects=new Set();const walk=(value,fn)=>{if(value&&typeof value==='object'){fn(value);Object.values(value).forEach(child=>walk(child,fn));}};
    walk(state,value=>originalObjects.add(value));walk(expected,value=>assert.equal(originalObjects.has(value),false));
    if(expected){expected.origin.name='changed';expected.materials[0].blocksAfter.push({cellId:'invented'});}
    assert.equal(bytes(state),before);
  }
});

test('unresolved future event results cannot alter current investigation opportunities', () => {
  const s=copy(natural[10]),expected=cross(s,'B4');assert.ok(s.events.some(event=>event.year>s.year));
  for(const event of s.events.filter(event=>event.year>s.year)) {
    event.roll=.999;event.futureOutcome='success';event.text='A future result must not be read';
    for(const key of ['roll','futureOutcome','text'])trap(event,key);
  }
  assert.deepEqual(cross(s,'B4'),expected);
});

test('malformed public identities and inventories are conservative without fabricated destinations', () => {
  const base=natural[30];
  const bads=[s=>s.cells.push(copy(s.cells[0])),s=>s.actors.push(copy(s.actors[0])),s=>s.cells=null,s=>s.actors[0].name=null,s=>s.investigations=null,s=>s.investigations['30:protagonist']=[{cellId:'X9',evidenceId:'resident_testimony'}],s=>s.investigations['30:protagonist']=[{cellId:'D4',evidenceId:'invented'}],s=>s.investigations['30:protagonist']=[{cellId:'D4',evidenceId:'anomaly_records'},{cellId:'E4',evidenceId:'anomaly_records'}],s=>s.investigations['30:protagonist']=[{cellId:'D4',evidenceId:'anomaly_records'},{cellId:'D4',evidenceId:'evacuation_routes'}],s=>s.history=[null],s=>s.investigations['30:protagonist']=null,s=>s.history.push(copy(s.history[0])),s=>s.events.push(copy(s.events[0]))];
  for(const change of bads){const s=copy(base);change(s);const view=cross(s,'D4');assert.deepEqual(view.issues,['当前公开资料不完整，暂不能核对跨地取证代价。']);assert.deepEqual(view.materials,[]);assert.equal(view.budget,null);}
  const absent=copy(base);absent.cells=absent.cells.filter(cell=>cell.id!=='B4');assert.ok(cross(absent,'D4').issues.length,'incomplete board is unknown, never a fabricated all-clear');
  const other=copy(base);other.investigations['30:linche']=[{cellId:'D5',evidenceId:'invented'}];assert.equal(cross(other,'D4').otherActors[0].budget,null,'unknown companion budget is never replenished by presentation');
});

test('different real old producers retain their menus and entire continuation; original per-scene rules return null', () => {
  for(const api of [previous,older,original]) {
    const states=route({api});
    for(const year of [0,10,20,30]) {
      const produced=states[year],s=restoreSave({state:copy(produced)}).state,before=bytes(s),control=copy(s);
      for(const actor of sim.getActors(s))for(const cell of s.cells){const view=cross(s,cell.id,actor.id);assert.equal(!!view,!!api.usesTradeoffs?.(s)&&sim.getActions(s,cell.id,actor.id).length>0);}
      assert.equal(bytes(s),before);next(s,sim);next(control,api);assert.deepEqual(s,control,`${api===original?'original':api===older?'older':'previous'}/${year}`);
    }
  }
});

test('independent actual-investigation enumeration exactly matches every advertised cross-place loss', t => {
  const states=[natural[0],natural[10],natural[20],natural[30],route({review:true})[30],route({build:'preserve_records',warning:false})[30],route({build:null,review:true})[30]];
  let readings=0,losses=0;
  for(const base of states)for(const actor of sim.getActors(base))for(const origin of base.cells) {
    const initial=cross(base,origin.id,actor.id);if(!initial)continue;
    const cases=[base];
    for(const material of initial.materials.filter(m=>m.canInvestigate)){const s=copy(base);sim.investigate(s,actor.id,origin.id,material.id);cases.push(s);}
    for(const s of cases){const view=cross(s,origin.id,actor.id);assert.ok(view);
      for(const material of view.materials.filter(m=>m.canInvestigate)){
        const actual=copy(s);sim.investigate(actual,actor.id,origin.id,material.id);const expectedContracts=[],expectedExtras=[];
        assert.equal(sim.getInvestigation(actual,actor.id,origin.id).budget,material.budgetAfter);
        for(const destination of s.cells.filter(cell=>cell.id!==origin.id)){
          const before=getInvestigationPlan(s,destination.id,actor.id),after=getInvestigationPlan(actual,destination.id,actor.id);if(!before)continue;
          for(const action of before.actions){const updated=after.actions.find(a=>a.actionId===action.actionId);
            if(action.reachable&&!updated.reachable)expectedContracts.push({cellId:destination.id,actionId:action.actionId,requiredRoundsBefore:action.requiredRounds,requiredRoundsAfter:updated.requiredRounds,budgetAfter:after.budget});
            for(const extra of action.optionalEnhancements){const changed=updated.optionalEnhancements.find(item=>item.id===extra.id);if(extra.reachable&&!changed.reachable)expectedExtras.push({cellId:destination.id,actionId:action.actionId,enhancementId:extra.id,requiredRoundsBefore:extra.requiredRounds,requiredRoundsAfter:changed.requiredRounds,budgetAfter:after.budget});}
          }
        }
        const pick=({cellId,actionId,enhancementId,requiredRoundsBefore,requiredRoundsAfter,budgetAfter})=>({cellId,actionId,...(enhancementId?{enhancementId}:{}),requiredRoundsBefore,requiredRoundsAfter,budgetAfter});
        assert.deepEqual(material.blocksAfter.map(pick),expectedContracts,`${s.year}/${actor.id}/${origin.id}/${material.id}`);
        assert.deepEqual(material.enhancementsLostAfter.map(pick),expectedExtras,`${s.year}/${actor.id}/${origin.id}/${material.id}`);
        assert.equal(new Set(material.blocksAfter.map(loss=>`${loss.cellId}:${loss.actionId}`)).size,material.blocksAfter.length);
        losses+=material.blocksAfter.length+material.enhancementsLostAfter.length;readings++;
      }
    }
  }
  assert.ok(readings>300,`actual readings ${readings}`);assert.ok(losses>100,`actual lost alternatives ${losses}`);t.diagnostic(`${readings} actual legal readings; ${losses} newly lost alternatives verified against independent real investigation.`);
});
