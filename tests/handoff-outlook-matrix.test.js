import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {getHandoffOutlook} from '../src/handoff-outlook.js';
function lock(s,actor,c,id){const a=sim.getActions(s,c,actor).find(a=>a.id===id);for(const e of a.requireEvidence)if(!sim.getInvestigation(s,actor,c).evidence.includes(e))sim.investigate(s,actor,c,e);sim.lockTask(s,actor,c,id);}
function next(s){for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);sim.advanceToNextWindow(s);}
for(const seed of [0,1,6])for(const path of ['no-build','joint-successor','joint-maintenance','state-relocate'])test(`30year conditional capability matrix matches actual40: seed${seed}/${path}`,t=>{
 const base=sim.createRun(seed);if(path!=='no-build')lock(base,'protagonist','D4',path==='state-relocate'?'build_state':'build_joint');next(base);
 lock(base,'protagonist','D4',path==='no-build'?'recruit_volunteer':path==='joint-maintenance'?(sim.getActions(base,'D4').some(a=>a.id==='renew_charter')?'renew_charter':'restore_archive'):'recruit_successor');next(base);
 lock(base,'protagonist',path==='state-relocate'?'D4':'F6',path==='state-relocate'?'relocate_teacher':'independent_review');
 if(sim.getActors(base).length>1)lock(base,'linche',path==='no-build'?'D4':path==='state-relocate'?'F6':'E4',path==='no-build'?'free_warning':path==='state-relocate'?'independent_review':'train_network');next(base);
 const choices=actor=>[null,...['D4','E4','D5','B4','F6'].flatMap(c=>sim.getActions(base,c,actor).map(a=>({c,id:a.id})))];
 const actors=sim.getActors(base),b=actors.length>1?choices('linche'):[null];let count=0;
 for(const first of choices('protagonist'))for(const second of b){if(first&&second&&first.c===second.c)continue;const s=structuredClone(base);for(const [actor,choice] of [['protagonist',first],['linche',second]]){if(!actors.some(a=>a.id===actor))continue;if(choice)lock(s,actor,choice.c,choice.id);else sim.passTask(s,actor);}
  const before=JSON.stringify(s),view=getHandoffOutlook(s);if(!sim.getWindowReview(s).ready){assert.equal(view.ready,false);continue;}assert.equal(view.ready,true);assert.equal(JSON.stringify(s),before);const crisis=structuredClone(s.flags.crisis);next(s);const real=sim.getHandoffReadiness(s),ending=sim.getEnding(s);
  for(const key of ['staffCells','authorizedCells','checkCells'])assert.deepEqual([...view.projected[key]].sort(),[...real[key]].sort(),`${key}: ${JSON.stringify([first,second])}`);
  for(const key of ['canShare','canWithdraw','trust'])assert.equal(view.projected[key],real[key],key);for(const key of ['networks','autonomy'])assert.equal(view.projected[key],ending.metrics[key],key);
  assert.deepEqual(s.flags.crisis,crisis);for(const condition of view.conditional)assert.equal(s.events.find(e=>e.sourceActionId===`action:30:${condition.actorId}:${condition.cellId}:complete_review`).status,condition.supported?'success':'cancelled');count++;
 }
 assert.ok(count>=4,`at least four legal options, got ${count}`);t.diagnostic(`${count} legal locked combinations compared with actual40`);
});
