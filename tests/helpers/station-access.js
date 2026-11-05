import * as sim from '../../src/simulation.js';
import {investigateAndLock as lock} from './play.js';
export {lock};
export function submit(s){for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);return s;}
export function until(s,year){while(s.year<year)sim.advanceYear(s);return s;}
export function stationAt10(funding='build_merchant',seed=funding==='build_merchant'?1:0){const s=sim.createRun(seed);lock(s,'protagonist','D4',funding);submit(s);until(s,10);if(!s.institutions.some(i=>i.kind==='station'))throw Error('Fixture station did not build');return s;}
export function stationRenewal(s=stationAt10()){lock(s,'protagonist','D4','renew_charter');submit(s);return s;}
export function stationAt20(funding='build_merchant',choice='renew_charter'){const s=stationAt10(funding);if(choice)lock(s,'protagonist','D4',choice);submit(s);until(s,20);return s;}
