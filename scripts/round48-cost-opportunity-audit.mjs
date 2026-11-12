// Bounded natural player-API sampling, not exhaustive balance certification.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import {getInvestigationPlan} from '../src/investigation-plan.js';
const seeds=[0,1,2,3,5,8,12,21,34,55,89,144];
const hash=async p=>createHash('sha256').update(await fs.readFile(new URL(p,import.meta.url))).digest('hex');
const before=await hash('../src/simulation.js');
let rng=481123;const pick=a=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return a[rng%a.length];};
const rows=[],routes=[],lossExamples=[];
function options(s,actor){return [null,...s.cells.flatMap(c=>sim.getActions(s,c.id,actor).map(a=>({cell:c.id,id:a.id,required:a.requireEvidence})))];}
function acquireLock(s,actor,o){if(!o){sim.passTask(s,actor);return;}for(const id of o.required)if(!sim.getInvestigation(s,actor,o.cell).evidence.includes(id))sim.investigate(s,actor,o.cell,id);sim.lockTask(s,actor,o.cell,o.id);}
function optional(s,actor,count){const buys=[];for(let n=0;n<count;n++){const available=s.cells.flatMap(c=>{const p=getInvestigationPlan(s,c.id,actor);return p?p.materials.filter(m=>m.canInvestigate).map(m=>({cell:c.id,...m})):[];});if(!available.length)break;const m=pick(available);sim.investigate(s,actor,m.cell,m.id);buys.push({cell:m.cell,id:m.id,cost:m.cost});}return buys;}
for(const seed of seeds)for(let route=0;route<8;route++){
 let state=sim.createRun(seed);const path=[];
 for(const year of sim.WINDOWS){
  assert.equal(state.year,year);const actors=sim.getActors(state).map(a=>a.id);
  // Keep uninvestigated, one-read and budget-consuming branches separate.
  for(const variant of [0,1,3]){
   const sample=structuredClone(state),buys={};for(const actor of actors)buys[actor]=optional(sample,actor,variant);
   const opts=actors.map(actor=>options(sample,actor));
   const row={seed,route,year,variant,buys,arrangements:0,ready:0,conflict:0,costShortage:0,investigationBlocked:0,minRatio:null,minReadyRatio:null,unreachable:[]};
   for(const actor of actors)for(const c of sample.cells){const p=getInvestigationPlan(sample,c.id,actor);if(p)for(const a of p.actions)if(!a.reachable)row.unreachable.push({actor,cell:c.id,action:a.actionId,required:a.requiredRounds,budget:p.budget});}
   if(row.unreachable.length&&lossExamples.length<20)lossExamples.push({seed,route,year,variant,buys,unreachable:row.unreachable});
   for(const first of opts[0])for(const second of opts[1]||[null]){
    const s=structuredClone(sample),choices=[first,second];try{actors.forEach((a,i)=>acquireLock(s,a,choices[i]));}catch(e){assert.match(e.message,/调查轮次不足/);row.investigationBlocked++;continue;}
    const review=sim.getWindowReview(s);row.arrangements++;if(review.ready)row.ready++;if(review.issues.some(x=>x.includes('同格')))row.conflict++;if(review.issues.some(x=>x.includes('能力不足')))row.costShortage++;
    for(const [cell,cost]of Object.entries(review.costs))for(const [channel,amount]of Object.entries(cost))if(amount>0){const ratio=s.cells.find(c=>c.id===cell).channels[channel]/amount;const detail={ratio,cell,channel,balance:s.cells.find(c=>c.id===cell).channels[channel],amount,choices:choices.filter(Boolean).map(o=>({cell:o.cell,id:o.id})),issues:review.issues};if(!row.minRatio||ratio<row.minRatio.ratio)row.minRatio=detail;if(review.ready&&(!row.minReadyRatio||ratio<row.minReadyRatio.ratio))row.minReadyRatio=detail;}
   }
   rows.push(row);
  }
  // The carried-forward path is also public API only. Half prioritise recruitment;
  // other paths sample all contracts, never mutate balances, flags or institutions.
  const selected=[];for(const actor of actors){let opts=options(state,actor);if(year===10&&route%2===0){const recruit=opts.filter(o=>o?.id.startsWith('recruit_'));if(recruit.length)opts=recruit;}
   const remaining=[...opts];let chosen=false;while(remaining.length){const o=pick(remaining);remaining.splice(remaining.indexOf(o),1);const test=structuredClone(state);try{acquireLock(test,actor,o);}catch{continue;}if(o&&selected.some(x=>x.cell===o.cell))continue;acquireLock(state,actor,o);selected.push(o||{id:'pass'});chosen=true;break;}assert.ok(chosen);
  }path.push({year,selected});assert.equal(sim.getWindowReview(state).ready,true);sim.commitWindow(state);sim.advanceToNextWindow(state);assert.equal(sim.validateState(state).valid,true);
 }
 routes.push({seed,route,path,ending:sim.getEnding(state).title});
}
const min=key=>rows.filter(r=>r[key]).reduce((a,r)=>!a||r[key].ratio<a[key].ratio?r:a,null);
const summary={scope:'96 sampled four-window natural trajectories, three investigation variants at each planning checkpoint. Enumerated all lockable one/two-role arrangements within each sample; not all possible histories, seeds or investigation inventories. No low-balance injection.',balanced:false,seeds,trajectories:routes.length,planningSamples:rows.length,arrangements:rows.reduce((n,r)=>n+r.arrangements,0),ready:rows.reduce((n,r)=>n+r.ready,0),conflict:rows.reduce((n,r)=>n+r.conflict,0),costShortage:rows.reduce((n,r)=>n+r.costShortage,0),investigationBlockedCombinations:rows.reduce((n,r)=>n+r.investigationBlocked,0),samplesWithUnreachableContract:rows.filter(r=>r.unreachable.length).length,minRatio:min('minRatio'),minReadyRatio:min('minReadyRatio'),simulationHashBefore:before,simulationHashAfter:await hash('../src/simulation.js')};
assert.equal(summary.simulationHashBefore,summary.simulationHashAfter);
await fs.mkdir(new URL('../round48-work/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../round48-work/audit-cost-opportunity.json',import.meta.url),JSON.stringify({summary,lossExamples,routes,rows},null,2));console.log(JSON.stringify(summary,null,2));
