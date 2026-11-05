import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {sceneFor} from '../src/story.js';
import {investigateAndLock as lock} from './helpers/play.js';
const next=s=>{for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);sim.advanceToNextWindow(s);return s;};
function recruit(action){const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');next(s);lock(s,'protagonist','D4',action);return next(s);}
const body=(s,c='D4',a='protagonist')=>sceneFor(s,c,a).body.join('\n');
test('Linche voices the real successor agreement, not a generic player memory',()=>{const s=recruit('recruit_successor');assert.match(body(s,'D4','linche'),/第11年.*苏岚同意接班后才入局/);assert.doesNotMatch(body(s),/当年答应让她自己签名/);assert.match(body(s,'D4','linche'),/不是你的亲历记忆/);});
test('Linche remembers a real recruitment without succession without inventing consent',()=>{const s=recruit('recruit_risk');assert.match(body(s,'D4','linche'),/第11年.*没有安排继任/);assert.doesNotMatch(body(s,'D4','linche'),/苏岚同意接班后才入局/);assert.match(body(s,'D4','linche'),/测站的门关着/);});
test('maintained, under-maintained and stopped D4 histories do not collapse into unbuilt',()=>{const s=recruit('recruit_successor');assert.match(body(s),/维护经费不足/);assert.match(body(s),/仍在运转/);const stopped=recruit('recruit_risk');assert.match(body(stopped),/停运告示/);assert.doesNotMatch(body(stopped),/这里没有建成水文站/);});
test('late D5 aid prose separates current support from frozen recorded losses',()=>{const s=sim.createRun(0);next(s);next(s);next(s);assert.match(body(s,'D5'),/第23年的清点册不会重新结算/);lock(s,'protagonist','D5','mutual_aid');next(s);assert.match(body(s,'D5'),/后来的互助轮值正在支持眼前的生计/);assert.match(body(s,'D5'),/没有用新增物资改写过去的损失/);assert.match(body(s,'D5'),/不可逆的地方损失/);});
