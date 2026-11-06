// Round-19 independent acceptance oracle. Reachability is checked by actually
// acquiring each required material on a disposable copy, never by duplicating
// the plan module's arithmetic. Fixtures come from the authoritative engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-tradeoffs-simulation.js';
import {getInvestigationPlan} from '../src/investigation-plan.js';
import {getActionPreview} from '../src/action-preview.js';
import {getCrisisOutlook} from '../src/crisis-outlook.js';
import {investigateAndLock} from './helpers/play.js';
const copy=structuredClone, bytes=JSON.stringify;
function next(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function at20({joint=false,api=sim}={}){const s=api.createRun(0);if(joint)investigateAndLock(s,'protagonist','D4','build_joint');next(s,api);if(api===sim)investigateAndLock(s,'protagonist','D4',joint?'recruit_successor':'recruit_volunteer');next(s,api);return s;}
function at30(){return next(at20({joint:true}));}
const action=(p,id)=>p.actions.find(a=>a.actionId===id),material=(p,id)=>p.materials.find(e=>e.id===id);
function canAcquire(s,cell,actor,ids){const c=copy(s);try{for(const id of ids)sim.investigate(c,actor,cell,id);return true;}catch(e){assert.match(e.message,/不足/);return false;}}
function deepFreeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;}
function references(v,set=new Set()){if(v&&typeof v==='object'&&!set.has(v)){set.add(v);Object.values(v).forEach(x=>references(x,set));}return set;}

// Exact local inventory, relevant paths and newly lost paths are observed by
// mutating a second world through the real investigate API, not by plan output.
function audit(s,cell,actor){
 const before=bytes(s),p=getInvestigationPlan(deepFreeze(copy(s)),cell,actor),contracts=sim.getActions(s,cell,actor);
 if(!contracts.length){assert.equal(p,null);return;}
 assert.ok(p?.readOnly);assert.equal(p.budget,sim.getInvestigation(s,actor,cell).budget);assert.equal(p.maxBudget,3);
 assert.deepEqual(p.actions.map(a=>a.actionId),contracts.map(a=>a.id));assert.deepEqual(p.materials.map(m=>m.id),sim.getEvidenceIds(s,cell,actor));
 for(const c of contracts){const a=action(p,c.id),known=sim.getInvestigation(s,actor,cell).evidence;
  assert.deepEqual(a.requiredEvidence.map(e=>e.id),c.requireEvidence);assert.equal(a.reachable,canAcquire(s,cell,actor,c.requireEvidence));
  const missing=c.requireEvidence.filter(id=>!known.includes(id));assert.equal(a.requiredRounds,missing.reduce((n,id)=>n+(['anomaly_records','evacuation_routes'].includes(id)?2:1),0));
  assert.equal(a.budgetAfter,p.budget-a.requiredRounds);
  assert.equal(getActionPreview(s,cell,actor,c.id).investigation.reachable,a.reachable);
 }
 for(const m of p.materials){assert.deepEqual(m.requiredBy,contracts.filter(c=>c.requireEvidence.includes(m.id)).map(c=>c.id));
  const acquired=sim.getInvestigation(s,actor,cell).evidence.includes(m.id);assert.equal(m.acquired,acquired);
  assert.equal(m.canInvestigate,!acquired&&canAcquire(s,cell,actor,[m.id]));
  if(m.canInvestigate){const after=copy(s);sim.investigate(after,actor,cell,m.id);assert.equal(m.budgetAfter,sim.getInvestigation(after,actor,cell).budget);
   assert.deepEqual(m.blocksAfter,contracts.filter(c=>canAcquire(s,cell,actor,c.requireEvidence)&&!canAcquire(after,cell,actor,c.requireEvidence)).map(c=>c.id));
   const veto=contracts.find(c=>c.id==='local_veto');const lost=veto&&s.year===20&&canAcquire(s,cell,actor,[...veto.requireEvidence,'evacuation_routes'])&&!canAcquire(after,cell,actor,[...veto.requireEvidence,'evacuation_routes']);
   assert.deepEqual(m.enhancementsLostAfter,lost?[{actionId:'local_veto',enhancementId:'surveyed_veto'}]:[]);
  }else{assert.deepEqual(m.blocksAfter,[]);assert.deepEqual(m.enhancementsLostAfter,[]);}
 }
 assert.equal(bytes(s),before);
}

test('audit genuine0→10→20 D4 anomaly2 then old record1 forecloses the local resident warning',()=>{
 const s=at20(),p=getInvestigationPlan(s,'D4');assert.equal(s.year,20);assert.ok(sim.validateState(s).valid);
 assert.equal(action(p,'free_warning').requiredRounds,1);assert.equal(action(p,'free_warning').reachable,true);
 assert.deepEqual(material(p,'anomaly_records').requiredBy,[]);assert.equal(material(p,'anomaly_records').portable,true);
 sim.investigate(s,'protagonist','D4','anomaly_records');const one=getInvestigationPlan(s,'D4');assert.equal(one.budget,1);
 assert.ok(material(one,'old_reality_record').blocksAfter.includes('free_warning'));assert.equal(material(one,'resident_testimony').requiredBy.includes('free_warning'),true);
 const before=bytes(s);getInvestigationPlan(s,'D4');getActionPreview(s,'D4','protagonist','free_warning');assert.equal(bytes(s),before);
 sim.investigate(s,'protagonist','D4','old_reality_record');const zero=getInvestigationPlan(s,'D4');assert.equal(zero.budget,0);assert.equal(action(zero,'free_warning').requiredRounds,1);assert.equal(action(zero,'free_warning').reachable,false);
 assert.equal(getActionPreview(s,'D4','protagonist','free_warning').investigation.reachable,false);assert.throws(()=>sim.investigate(s,'protagonist','D4','resident_testimony'),/不足/);
 assert.equal(action(zero,'relocate_teacher').requiredRounds,0);assert.equal(action(zero,'relocate_teacher').reachable,true);assert.equal(action(zero,'local_veto'),undefined);audit(s,'D4','protagonist');
});

test('audit one actor shares a window budget across places, never with another actor; local testimony never travels',()=>{
 const s=at20();sim.investigate(s,'protagonist','D4','resident_testimony');sim.investigate(s,'protagonist','D4','anomaly_records');
 assert.equal(getInvestigationPlan(s,'B4').budget,0);assert.equal(getInvestigationPlan(s,'D4','linche').budget,3);
 assert.equal(material(getInvestigationPlan(s,'D4'),'resident_testimony').acquired,true);assert.equal(material(getInvestigationPlan(s,'B4'),'resident_testimony').acquired,false);
 assert.equal(material(getInvestigationPlan(s,'B4'),'anomaly_records').acquired,true);assert.equal(material(getInvestigationPlan(s,'B4','linche'),'anomaly_records').acquired,false);
 audit(s,'B4','protagonist');audit(s,'D4','linche');
});

test('audit natural30 B4 future check needs three rounds and D4 old record closes it without a fictional fallback',()=>{
 const s=at30(),p=getInvestigationPlan(s,'B4'),a=action(p,'establish_future_check');assert.ok(sim.validateState(s).valid);assert.equal(a.requiredRounds,3);assert.equal(a.reachable,true);assert.equal(a.budgetAfter,0);
 sim.investigate(s,'protagonist','D4','old_reality_record');const blocked=getInvestigationPlan(s,'B4');assert.equal(blocked.budget,2);assert.equal(action(blocked,'establish_future_check').requiredRounds,3);assert.equal(action(blocked,'establish_future_check').budgetAfter,-1);assert.equal(action(blocked,'establish_future_check').reachable,false);
 assert.equal(blocked.actions.length,1);assert.equal(action(blocked,'local_veto'),undefined);assert.equal(getActionPreview(s,'B4','protagonist','establish_future_check').investigation.reachable,false);audit(s,'B4','protagonist');
});

test('audit30 E4 irrelevant portable research closes local authorization but cannot close zero-evidence training',()=>{
 const s=at30();assert.deepEqual(material(getInvestigationPlan(s,'E4'),'anomaly_records').requiredBy,[]);
 sim.investigate(s,'protagonist','E4','anomaly_records');const p=getInvestigationPlan(s,'E4'),m=material(p,'old_reality_record');
 assert.ok(m.blocksAfter.includes('authorize_training'));assert.ok(!m.blocksAfter.includes('train_network'));sim.investigate(s,'protagonist','E4','old_reality_record');
 const z=getInvestigationPlan(s,'E4');assert.equal(action(z,'authorize_training').reachable,false);assert.equal(action(z,'train_network').reachable,true);assert.equal(action(z,'train_network').requiredRounds,0);audit(s,'E4','protagonist');
});

test('audit optional surveyed veto loss is never reported as loss of the basic veto action',()=>{
 const s=at20(),p=getInvestigationPlan(s,'B4'),m=material(p,'anomaly_records');assert.deepEqual(m.blocksAfter,[]);assert.deepEqual(m.enhancementsLostAfter,[{actionId:'local_veto',enhancementId:'surveyed_veto'}]);
 assert.deepEqual(material(p,'evacuation_routes').requiredBy,[]);assert.deepEqual(material(p,'evacuation_routes').enhances,[{actionId:'local_veto',enhancementId:'surveyed_veto'}]);
 sim.investigate(s,'protagonist','B4','anomaly_records');const spent=getInvestigationPlan(s,'B4');assert.equal(action(spent,'local_veto').reachable,true);assert.equal(action(spent,'local_veto').requiredRounds,0);assert.equal(action(spent,'local_veto').optionalEnhancements[0].reachable,false);audit(s,'B4','protagonist');
});

test('audit newly acquired optional evidence and repeated plan reads do not rewrite the already locked snapshot',()=>{
 const s=at20();investigateAndLock(s,'linche','D4','free_warning');sim.lockTask(s,'protagonist','B4','local_veto');const locked=bytes(s.drafts.protagonist),outlook=getCrisisOutlook(s);assert.equal(outlook.vetoBase,.3);
 sim.investigate(s,'protagonist','B4','evacuation_routes');const after=bytes(s);for(let i=0;i<5;i++){audit(s,'B4','protagonist');getActionPreview(s,'B4','protagonist','local_veto');}
 assert.equal(bytes(s),after);assert.equal(bytes(s.drafts.protagonist),locked);assert.equal(getCrisisOutlook(s).vetoBase,.3);sim.lockTask(s,'protagonist','B4','local_veto');assert.equal(getCrisisOutlook(s).vetoBase,.2);
});

test('audit read, acquire, and lock remain unpaid; real unified submit pays the exact contract once',()=>{
 const s=at30(),before=copy(s),cost=sim.getActions(s,'B4').find(a=>a.id==='establish_future_check').cost;
 for(let i=0;i<4;i++)audit(s,'B4','protagonist');assert.deepEqual(s,before);investigateAndLock(s,'protagonist','B4','establish_future_check');assert.deepEqual(s.cells,before.cells);
 sim.passTask(s,'linche');sim.commitWindow(s);const c=s.cells.find(c=>c.id==='B4'),orig=before.cells.find(c=>c.id==='B4');for(const key of Object.keys(orig.channels))assert.equal(c.channels[key],orig.channels[key]-(cost[key]||0));
 const paid=bytes(s);assert.throws(()=>sim.commitWindow(s));assert.equal(bytes(s),paid);assert.equal(s.history.filter(e=>e.id==='action:30:protagonist:B4:establish_future_check').length,1);
});

test('audit all reachable materials across natural windows agree with authoritative acquisition, including already acquired paths',t=>{
 const s0=sim.createRun(0),s10=next(sim.createRun(0)),s20=at20({joint:true}),s30=at30();let checked=0;
 for(const s of [s0,s10,s20,s30])for(const actor of sim.getActors(s))for(const cell of ['D4','B4','E4','D5','F6']){
  audit(s,cell,actor.id);checked++;if(!sim.getActions(s,cell,actor.id).length)continue;
  for(const id of sim.getEvidenceIds(s,cell,actor.id)){const after=copy(s);sim.investigate(after,actor.id,cell,id);audit(after,cell,actor.id);checked++;
   for(const second of sim.getEvidenceIds(after,cell,actor.id)){if(!canAcquire(after,cell,actor.id,[second]))continue;const twice=copy(after);sim.investigate(twice,actor.id,cell,second);audit(twice,cell,actor.id);checked++;}
  }
 }
 assert.ok(checked>300,`Only ${checked} natural candidate states checked`);t.diagnostic(`${checked} natural actor/site/material candidate states checked against real acquisition`);
});

test('audit plans are detached and never read RNG, unread material bodies, future results, or history text',()=>{
 for(const s of [at20({joint:true}),at30()]){
  const expected=Object.fromEntries(['D4','B4','E4'].map(c=>[c,getInvestigationPlan(s,c)])),refs=references(s),before=bytes(s);
  for(const p of Object.values(expected))for(const ref of references(p))assert.equal(refs.has(ref),false);
  for(const key of ['seed','snapshots','baseline','promises'])Object.defineProperty(s,key,{enumerable:true,configurable:true,get(){throw Error(`Forbidden state read: ${key}`);}});
  for(const e of [...s.events,...s.history])for(const key of ['roll','text','description','hiddenText'])Object.defineProperty(e,key,{configurable:true,get(){throw Error(`Forbidden narrative/RNG read: ${key}`);}});
  for(const entries of Object.values(s.investigations))for(const e of entries)Object.defineProperty(e,'text',{get(){throw Error('Unread evidence body');}});
  for(const cell of ['D4','B4','E4'])assert.deepEqual(getInvestigationPlan(s,cell),expected[cell]);
  assert.doesNotMatch(bytes(expected),/"(?:seed|roll|snapshots|baseline|promises|text|hiddenText)":/);assert.ok(before.length);
 }
});

test('audit unsupported sites, years, and phases return no plan and genuine old saves retain exact old rules',()=>{
 const legacy=at20({api:old}),before=bytes(legacy);assert.equal(getInvestigationPlan(legacy,'B4'),null);assert.equal(bytes(legacy),before);assert.equal(getActionPreview(legacy,'B4','protagonist','independent_review',['anomaly_records']).investigation,undefined);
 const a=copy(legacy),b=copy(legacy);old.lockTask(a,'protagonist','B4','independent_review',['anomaly_records']);sim.lockTask(b,'protagonist','B4','independent_review',['anomaly_records']);old.commitWindow(a);sim.commitWindow(b);assert.deepEqual(b,a);
 // Exact known pre-round19 wording correction, restricted to one verified
 // success record. Every other byte/field, including all other prose, compares.
 const normalized=s=>{const c=copy(s),r=c.history.find(h=>h.id==='resolved:event:action:20:protagonist:B4:independent_review');if(r?.text==='两个独立来源揭示了共同标准的偏差。第23年的水位冲击仍会到来，但错误不再同步传播。')r.text='交叉校验在冲击前确认了共同标准的偏差。第23年的水位冲击仍会到来，但错误不再同步传播。';return c;};
 while(a.year<30){old.advanceYear(a);sim.advanceYear(b);assert.deepEqual(b,normalized(a));}
 const current=at20();assert.equal(getInvestigationPlan(current,'A1'),null);assert.equal(getInvestigationPlan(current,'B4','unknown'),null);for(const actor of sim.getActors(current))sim.passTask(current,actor.id);sim.commitWindow(current);assert.equal(getInvestigationPlan(current,'B4'),null);
});

