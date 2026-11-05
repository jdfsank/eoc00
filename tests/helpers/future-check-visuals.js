import * as sim from '../../src/simulation.js';
import {lock,submit} from './local-crisis.js';
export function futureVisualDates({staff=true}={}){
 const before=sim.createRun(0);submit(before);sim.advanceToNextWindow(before);
 lock(before,'protagonist','D4','recruit_volunteer');submit(before);sim.advanceToNextWindow(before);
 lock(before,'protagonist','B4','local_veto',['evacuation_routes']);if(staff)lock(before,'linche','E4','train_network');submit(before);sim.advanceToNextWindow(before);
 const locked=structuredClone(before);lock(locked,'linche','B4','establish_future_check');
 const pending=structuredClone(locked);submit(pending);const y33=structuredClone(pending);while(y33.year<33)sim.advanceYear(y33);
 const y34=structuredClone(y33);sim.advanceYear(y34);const y40=structuredClone(y34);sim.advanceToNextWindow(y40);
 return {before,locked,pending,y33,y34,y40};
}
