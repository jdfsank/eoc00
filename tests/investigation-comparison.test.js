import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {getInvestigationComparison} from '../src/investigation-comparison.js';
import {getCrisisOutlook} from '../src/crisis-outlook.js';
import {investigateAndLock as lock} from './helpers/play.js';

const copy=structuredClone;
function finish(s){for(const actor of sim.getActors(s))if(!s.drafts[actor.id])sim.passTask(s,actor.id);}
function decade(s){finish(s);sim.commitWindow(s);sim.advanceToNextWindow(s);return s;}
function route({seed=12,records=false,build=null}={}){
  const s=sim.createRun(seed);
  if(records)lock(s,'protagonist','B4','preserve_records');
  if(build)lock(s,'protagonist','D4',`build_${build}`);
  decade(s);lock(s,'protagonist','D4',build?'recruit_successor':'recruit_volunteer');decade(s);return s;
}
function option(view,id){return view.options.find(row=>row.id===id);}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const value of Object.values(x))freeze(value);Object.freeze(x);}return x;}
function lockOption(s,row,actorId='protagonist',cellId='B4'){
  for(const e of row.evidence)if(!e.acquired)sim.investigate(s,actorId,cellId,e.id);
  sim.lockTask(s,actorId,cellId,row.actionId);return s;
}
function consequence(s){sim.commitWindow(s);while(s.year<23)sim.advanceYear(s);return s.flags.crisis;}
function sameConsequences(row,actual){
  const branch=actual.damage===0?row.outlook.success:row.outlook.fallback;
  assert.equal(branch.available??branch.possible,true);
  assert.equal(actual.damage,branch.damage);assert.deepEqual(actual.damageByCell,branch.damageByCell);
}

test('comparison is scoped to regional, tradeoff year20 planning and does not migrate old rules',()=>{
  const s=route();sim.passTask(s,'linche');
  assert.ok(getInvestigationComparison(s,'B4'));assert.ok(getInvestigationComparison(s,'F6'));
  for(const id of ['D4','E4','D5','A1'])assert.equal(getInvestigationComparison(s,id),null);
  for(const change of [{year:0},{year:10},{year:30},{phase:'playback'},{planningRulesVersion:undefined},{crisisRulesVersion:undefined}])assert.equal(getInvestigationComparison({...s,...change},'B4'),null);
  const earlier=copy(s);delete earlier.aftermathRulesVersion;delete earlier.staffingRulesVersion;
  const view=getInvestigationComparison(earlier,'B4');assert.ok(view.options.every(row=>row.ready));
  for(const row of view.options)sameConsequences(row,consequence(lockOption(copy(earlier),row)));
});

test('three alternatives disclose remaining research, public terms, real other assignment and documented rounded consequences',()=>{
  for(const [settings,p,loss,veto,basic] of [[{seed:1,records:true},.8,.9431,.1886,.283],[{},.55,.9431,.1886,.283],[{build:'joint'},1,.6195,.1239,.1859]]){
    const s=route(settings);lock(s,'linche','D4','free_warning');
    const before=JSON.stringify(s),view=getInvestigationComparison(s,'B4');
    assert.equal(view.hypothetical,true);assert.equal(view.budget,3);assert.deepEqual(view.options.map(row=>row.id),['review','surveyed_veto','basic_veto']);
    assert.deepEqual(view.retained.map(({actorId,status,actionId})=>({actorId,status,actionId})),[{actorId:'linche',status:'locked',actionId:'free_warning'}]);
    const review=option(view,'review'),surveyed=option(view,'surveyed_veto'),normal=option(view,'basic_veto');
    assert.equal(review.probability,p);assert.deepEqual(review.cost,{science:3,economy:4});assert.equal(review.dueYear,22);
    assert.equal(review.investigationCost,2);assert.equal(review.budgetAfter,1);assert.equal(review.outlook.fallback.damage,loss);
    assert.equal(review.outlook.fallback.possible,p<1);assert.equal(review.outlook.success.available,true);
    assert.equal(surveyed.investigationCost,2);assert.equal(surveyed.probability,1);assert.equal(surveyed.dueYear,21);assert.deepEqual(surveyed.cost,{politics:4});
    assert.equal(normal.investigationCost,0);assert.equal(normal.budgetAfter,3);
    assert.equal(surveyed.outlook.fallback.damage,veto);assert.equal(normal.outlook.fallback.damage,basic);
    for(const row of view.options){assert.equal(row.ready,true);sameConsequences(row,consequence(lockOption(copy(s),row)));}
    assert.equal(JSON.stringify(s),before);
  }
});

test('already spent research never refunds, portable evidence travels, and actual lock still needs evidence',()=>{
  const s=route();sim.passTask(s,'linche');
  assert.throws(()=>sim.lockTask(s,'protagonist','B4','independent_review'),/必要证据/);
  const before=JSON.stringify(s);getInvestigationComparison(s,'B4');assert.equal(JSON.stringify(s),before);
  assert.throws(()=>sim.lockTask(s,'protagonist','B4','independent_review'),/必要证据/);
  sim.investigate(s,'protagonist','F6','anomaly_records');
  let view=getInvestigationComparison(s,'B4');
  assert.equal(view.budget,1);assert.equal(option(view,'review').investigationCost,0);assert.equal(option(view,'review').ready,true);
  assert.equal(option(view,'surveyed_veto').reachable,false);assert.equal(option(view,'surveyed_veto').outlook,null);assert.match(option(view,'surveyed_veto').issues.join(' '),/已花轮次不退/);
  assert.equal(option(view,'basic_veto').ready,true);
  const local=route();sim.passTask(local,'linche');sim.investigate(local,'protagonist','B4','resident_testimony');
  view=getInvestigationComparison(local,'B4');assert.equal(view.budget,2);assert.equal(option(view,'review').investigationCost,2);assert.equal(option(view,'review').budgetAfter,0);
});

test('post-lock investigation preserves the other actor snapshot and basic versus surveyed strongest protection',()=>{
  const s=route();sim.lockTask(s,'linche','F6','local_veto');
  sim.investigate(s,'linche','F6','evacuation_routes');
  let view=getInvestigationComparison(s,'B4');
  assert.deepEqual(s.drafts.linche.evidence,[]);assert.equal(option(view,'review').outlook.vetoBase,.3);
  assert.equal(option(view,'basic_veto').outlook.vetoBase,.3);assert.equal(option(view,'surveyed_veto').outlook.vetoBase,.2);
  sim.lockTask(s,'linche','F6','local_veto');view=getInvestigationComparison(s,'B4');assert.equal(option(view,'review').outlook.vetoBase,.2);
  for(const row of view.options)sameConsequences(row,consequence(lockOption(copy(s),row)));
  const own=route();sim.passTask(own,'linche');sim.lockTask(own,'protagonist','B4','local_veto');sim.investigate(own,'protagonist','B4','evacuation_routes');
  view=getInvestigationComparison(own,'B4');assert.equal(option(view,'surveyed_veto').investigationCost,0);assert.equal(option(view,'basic_veto').available,false);assert.equal(option(view,'basic_veto').outlook,null);
  assert.equal(getCrisisOutlook(own).vetoBase,.3);assert.deepEqual(own.drafts.protagonist.evidence,[]);
});

test('same-round training does not inflate review probability and two reviews never gain a combined probability',()=>{
  const s=route();lock(s,'linche','E4','train_network');
  let view=getInvestigationComparison(s,'B4'),review=option(view,'review');
  assert.equal(review.probability,.55);assert.equal(review.outlook.regions.find(r=>r.cellId==='E4').coverage,.55);
  sameConsequences(review,consequence(lockOption(copy(s),review)));
  lock(s,'linche','F6','independent_review');view=getInvestigationComparison(s,'B4');review=option(view,'review');
  assert.deepEqual(review.outlook.attempts.map(a=>a.probability),[.55,.55]);
  assert.doesNotMatch(JSON.stringify(view),/combinedProbability|reviewSuccessProbability|reviewFailureProbability/);
  sameConsequences(review,consequence(lockOption(copy(s),review)));
});

test('missing, conflicting, unavailable, unaffordable and unresolved contracts yield no whole-round numbers',()=>{
  const cases=[
    s=>{},
    s=>lock(s,'linche','B4','local_veto'),
    s=>{lock(s,'linche','D4','free_warning');s.cells.find(c=>c.id==='D4').channels.economy=0;},
    s=>{sim.passTask(s,'linche');s.cells.find(c=>c.id==='B4').channels.science=0;s.cells.find(c=>c.id==='B4').channels.politics=0;},
    s=>{lock(s,'linche','F6','independent_review');s.investigations['20:linche']=[];},
    s=>{sim.passTask(s,'linche');s.events.push({id:'exceptional',status:'pending',year:22,actionId:'unknown'});},
    s=>{lock(s,'linche','F6','local_veto');s.drafts.linche.actionId='not_available';},
  ];
  for(const edit of cases){const s=route();edit(s);const before=JSON.stringify(s),view=getInvestigationComparison(s,'B4');assert.ok(view.options.every(row=>!row.ready&&row.outlook===null));assert.equal(JSON.stringify(s),before);}
});

test('malformed public budget, draft and identity stay unknown instead of bypassing real validation',()=>{
  const cases=[
    s=>s.actors.push({...s.actors[0]}),
    s=>{s.drafts.linche.actorId='protagonist';},
    s=>{s.investigations['20:protagonist']=[{cellId:'B4',evidenceId:'anomaly_records'},{cellId:'B4',evidenceId:'evacuation_routes'}];},
    s=>{s.investigations['20:protagonist']=[{cellId:'B4',evidenceId:'anomaly_records'},{cellId:'F6',evidenceId:'anomaly_records'}];},
    s=>{s.flags.vetoMitigation=.05;},
    s=>{s.events[0].status='unknown';},
    s=>{s.events[0].year=40;},
    s=>{s.events[0].probability=1.1;},
    s=>{s.history[0].year=21;},
    s=>{s.history[0].cellId='Q99';},
    s=>{s.committedWindows=[0];},
  ];
  for(const edit of cases){const s=route();sim.passTask(s,'linche');edit(s);const view=getInvestigationComparison(s,'B4');assert.ok(view.issues.length);assert.ok(view.options.every(row=>!row.ready));}
});

test('strict purity: frozen input, private getter traps, seed independence and no return aliases',()=>{
  const s=route({records:true,seed:1});lock(s,'linche','D4','free_warning');
  const before=JSON.stringify(s),expected=getInvestigationComparison(freeze(copy(s)),'B4');assert.ok(expected.options.every(row=>row.ready));
  const hidden=copy(s),trap=(target,key)=>Object.defineProperty(target,key,{enumerable:true,configurable:true,get(){throw new Error(`Private field read: ${key}`);}});
  for(const key of ['seed','random','roll','snapshots','baseline','privateEvidence','hiddenEvidenceBody'])trap(hidden,key);
  for(const key of ['crisis','futureOutcome','privateEvidence'])trap(hidden.flags,key);
  for(const event of hidden.events)for(const key of ['roll','text','hiddenEvidenceBody'])trap(event,key);
  for(const history of hidden.history)for(const key of ['text','privateBody'])trap(history,key);
  for(const institution of hidden.institutions)for(const key of ['name','annualSource','privateBody'])trap(institution,key);
  for(const entries of Object.values(hidden.investigations))for(const entry of entries)trap(entry,'body');
  assert.deepEqual(getInvestigationComparison(hidden,'B4'),expected);
  for(const seed of ['other',999,''])assert.deepEqual(getInvestigationComparison({...s,seed},'B4'),expected);
  const stateObjects=new Set(),walk=(value,visit)=>{if(value&&typeof value==='object'){visit(value);for(const child of Object.values(value))walk(child,visit);}};
  walk(s,value=>stateObjects.add(value));const returned=getInvestigationComparison(s,'B4');walk(returned,value=>assert.equal(stateObjects.has(value),false));
  returned.options[0].cost.science=900;returned.options[0].outlook.regions[0].coverage=900;returned.retained[0].actorName='Changed';returned.options[0].evidence[0].acquired=true;
  assert.equal(JSON.stringify(s),before);assert.deepEqual(getInvestigationComparison(s,'B4'),expected);
  assert.doesNotMatch(JSON.stringify(expected),/"(?:seed|roll|drafts|resolvedYear|requireEvidence|window|conditionVersion)"/);
});

test('public comparison branches agree with real engine across fixed seeds, preparation and both locations',()=>{
  const seen=new Set();
  for(let seed=0;seed<16;seed++)for(const records of [false,true]){
    const s=route({seed,records});lock(s,'linche','D4','free_warning');
    for(const cellId of ['B4','F6'])for(const row of getInvestigationComparison(s,cellId).options){
      assert.equal(row.ready,true);const actual=consequence(lockOption(copy(s),row,'protagonist',cellId));
      sameConsequences(row,actual);if(row.id==='review')seen.add(actual.damage===0?'success':'fallback');
    }
  }
  assert.deepEqual([...seen].sort(),['fallback','success']);
});
