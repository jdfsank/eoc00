import * as sim from '../../src/simulation.js';
import * as legacy from '../fixtures/legacy-simulation.js';
import {investigateAndLock} from './play.js';
export const lock=investigateAndLock;
export function submit(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);return s;}
export function decade(s,api=sim){submit(s,api);api.advanceToNextWindow(s);return s;}
export function localAt20({teaching=true,aid=true}={}){
 const s=sim.createRun(0);if(teaching)lock(s,'protagonist','D4','build_joint');decade(s);
 if(aid)lock(s,'protagonist','D5','mutual_aid');decade(s);return s;
}
export function localAt30({zero=false,...options}={}){
 const s=localAt20(options);if(zero)lock(s,'protagonist','F6','independent_review');decade(s);return s;
}
export function legacyLocalAt30(){const s=legacy.createRun(0);decade(s,legacy);legacy.lockTask(s,'protagonist','D5','mutual_aid',[]);decade(s,legacy);decade(s,legacy);return s;}
