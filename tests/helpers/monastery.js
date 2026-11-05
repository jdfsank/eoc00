import * as sim from '../../src/simulation.js';
import {investigateAndLock as lock} from './play.js';
export {lock};
export function submit(s){for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);return s;}
export function next(s){submit(s);sim.advanceToNextWindow(s);return s;}
export function monasteryAt20(seed=0,{preserve=true,secondPreserve=false,recruit=true}={}){
 const s=sim.createRun(seed);if(preserve)lock(s,'protagonist','B4','preserve_records');next(s);
 if(secondPreserve)lock(s,'protagonist','B4','preserve_records');else if(recruit)lock(s,'protagonist','D4','recruit_volunteer');next(s);return s;
}
export function monasteryAt30(seed=0,{preserve=true,train=true}={}){
 const s=monasteryAt20(seed,{preserve});lock(s,'protagonist','B4','independent_review');
 if(train)lock(s,'linche','E4','train_network');next(s);return s;
}
export function monasteryRecovery(s=monasteryAt30(2)){lock(s,'protagonist','B4','complete_review');submit(s);return s;}
