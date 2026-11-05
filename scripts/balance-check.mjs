import fs from 'node:fs/promises';
import * as sim from '../src/simulation.js';
const lock=(s,actor,cell,id)=>{for(const e of sim.getActions(s,cell,actor).find(a=>a.id===id).requireEvidence)sim.investigate(s,actor,cell,e);sim.lockTask(s,actor,cell,id);};
const next=s=>{for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);sim.advanceToNextWindow(s);};
const report={rules:'tradeoffs-v1',seeds:'0–99',scope:'Deterministic regression sample, not human-playtest balance certification. Costs remain local capability burdens; no blanket price increase.',routes:{}};
for(const [name,records,action,survey] of [['unprepared_review',false,'independent_review',false],['archive_review',true,'independent_review',false],['basic_veto',false,'local_veto',false],['surveyed_veto',false,'local_veto',true]]){
 const losses=[],endings={};
 for(let seed=0;seed<100;seed++){
  const s=sim.createRun(seed);if(records)lock(s,'protagonist','B4','preserve_records');next(s);lock(s,'protagonist','D4','recruit_volunteer');next(s);
  if(survey)sim.investigate(s,'protagonist','F6','evacuation_routes');lock(s,'protagonist','F6',action);lock(s,'linche','D4','free_warning');next(s);
  lock(s,'protagonist','D4','share_power');lock(s,'linche','E4','train_network');next(s);
  losses.push(s.flags.crisis.damage);const title=sim.getEnding(s).title;endings[title]=(endings[title]||0)+1;
 }
 report.routes[name]={zeroLossRuns:losses.filter(x=>x===0).length,meanLoss:Number((losses.reduce((a,b)=>a+b,0)/100).toFixed(4)),minLoss:Math.min(...losses),maxLoss:Math.max(...losses),endings};
}
await fs.mkdir('playtest-output',{recursive:true});await fs.writeFile('playtest-output/balance-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
