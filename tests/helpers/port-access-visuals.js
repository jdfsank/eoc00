import * as sim from '../../src/simulation.js';
import {investigateAndLock as lock} from './play.js';
import {next,submit} from './far-port.js';
export {lock,submit};
export function paidPortAt30(seed=1,{review=true}={}){
 const s=sim.createRun(seed);lock(s,'protagonist','D4','build_merchant');next(s);
 lock(s,'protagonist','D4','recruit_successor');next(s);
 lock(s,'protagonist','D4','free_warning');if(review)lock(s,'linche','F6','independent_review');next(s);return s;
}
export function portOpening(s=paidPortAt30()){lock(s,'protagonist','F6','open_port_warning');submit(s);return s;}

