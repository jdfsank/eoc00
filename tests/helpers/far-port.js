import * as sim from '../../src/simulation.js';
import {investigateAndLock} from './play.js';
export const lock=investigateAndLock;
export function submit(s){for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);return s;}
export function next(s){submit(s);sim.advanceToNextWindow(s);return s;}
export function portAt20(seed=6,branch=true){const s=sim.createRun(seed);if(branch)lock(s,'protagonist','D4','build_state');next(s);lock(s,'protagonist','D4',branch?'recruit_successor':'recruit_volunteer');next(s);return s;}
export function portAt30(seed=6,branch=true){const s=portAt20(seed,branch);lock(s,'protagonist','F6','independent_review');lock(s,'linche',branch?'E4':'D4',branch?'train_network':'free_warning');next(s);return s;}
export function portRecovery(s=portAt30()){lock(s,'protagonist','F6','complete_review');submit(s);return s;}
