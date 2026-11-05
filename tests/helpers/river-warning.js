import * as sim from '../../src/simulation.js';
import {investigateAndLock} from './play.js';
export const lock=investigateAndLock;
export function submit(s){for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);return s;}
export function decade(s){submit(s);sim.advanceToNextWindow(s);return s;}
export function warningAt20(kind='unbuilt'){
 const s=sim.createRun(kind==='archive'?6:0);
 if(kind!=='unbuilt')lock(s,'protagonist','D4','build_joint');
 decade(s);lock(s,'protagonist','D4',kind==='unbuilt'?'recruit_volunteer':'recruit_risk');decade(s);return s;
}
export function warningPending(s=warningAt20()){lock(s,'protagonist','D4','free_warning');return submit(s);}
export function warningAt30(kind='unbuilt'){const s=warningPending(warningAt20(kind));sim.advanceToNextWindow(s);return s;}
