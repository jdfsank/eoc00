import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {sceneFor,crisisRecollection} from '../src/story.js';
import {investigateAndLock as lock} from './helpers/play.js';
const next=s=>{for(const actor of sim.getActors(s))if(!s.drafts[actor.id])sim.passTask(s,actor.id);sim.commitWindow(s);sim.advanceToNextWindow(s);};
function renewed(action){const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');next(s);lock(s,'protagonist','D4','renew_charter');next(s);if(action)lock(s,'protagonist','B4',action);next(s);return s;}
const body=s=>sceneFor(s,'D4').body.join('\n');
test('year30 riverport recalls averted, contained and disaster outcomes as different histories',()=>{
 const avoided=renewed('independent_review'),contained=renewed('local_veto'),disaster=renewed();
 assert.equal(avoided.flags.crisis.status,'averted');assert.equal(contained.flags.crisis.status,'contained');assert.equal(disaster.flags.crisis.status,'disaster');
 assert.equal(new Set([body(avoided),body(contained),body(disaster)]).size,3);
 assert.match(body(avoided),/共同失效被拦在错误指令发出之前/);assert.doesNotMatch(body(avoided),/没有人死亡|所有人获救/);
 assert.match(body(contained),/停闸与地方保护减轻了冲击.*剩余损失已经发生/);
 assert.match(body(disaster),/不可逆的地方损失/);
 assert.match(body(avoided),new RegExp(sim.handoffSummary(avoided,'share_power').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('restoring present operation cannot rewrite the remembered crisis',()=>{
 const s=renewed();const original=structuredClone(s.flags.crisis),recall=crisisRecollection(s);
 for(const i of s.institutions){i.active=true;i.maintenance=1;i.open=true;}
 for(const c of s.cells)for(const channel of sim.CHANNELS)c.channels[channel]=100;
 assert.equal(crisisRecollection(s),recall);assert.deepEqual(s.flags.crisis,original);assert.match(body(s),/已经发生的伤害抹去/);
});
test('respect and forced relocation leave different year30 consent voices without placing her back at riverport',()=>{
 const states={};
 for(const action of ['present_archive','relocate_teacher']){
  const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');next(s);lock(s,'protagonist','D4','recruit_successor');next(s);
  lock(s,'protagonist','D4',action);lock(s,'linche','B4','local_veto');next(s);states[action]=s;
 }
 assert.match(body(states.present_archive),/苏岚自己写下的选择/);
 assert.match(body(states.relocate_teacher),/苏岚从东岸寄来的信.*没有替迁任补上同意/);
 assert.doesNotMatch(body(states.relocate_teacher),/她愿意继续核对证据|苏岚愿意讨论下一次交班/);
 assert.match(body(states.relocate_teacher),/河港明确拒绝当前安排/);
});
test('existing training is not described as an interior or an automatically independent method',()=>{
 const s=renewed('independent_review');const scene=sceneFor(s,'E4').body.join('');
 assert.match(scene,/学棚向两侧敞开/);assert.match(scene,/会读尺，不等于.*另一套可靠的记录/);assert.doesNotMatch(scene,/教室没有墙|室内黑板/);
 const stopped=structuredClone(s);for(const i of stopped.institutions.filter(i=>i.cellId==='E4'))i.maintenance=0;
 const closed=sceneFor(stopped,'E4').body.join('');assert.match(closed,/旧学棚和读尺架仍在，课已经停下/);assert.doesNotMatch(closed,/带教者指着轮值表|还没有持续运作的课堂/);
});
test('far-port post-crisis dialogue acknowledges corrected standards and retained losses',()=>{
 const avoided=renewed('independent_review'),damaged=renewed();
 assert.match(sceneFor(avoided,'F6').body.join(''),/改写前后的两条曲线/);assert.doesNotMatch(sceneFor(avoided,'F6').body.join(''),/支流，从来不在那份表里/);
 assert.match(sceneFor(damaged,'F6').body.join(''),/不可逆的地方损失/);
});
test('missing old crisis detail is disclosed rather than inventing an outcome',()=>{
 const s=renewed();delete s.flags.crisis.damage;s.flags.crisis.status='warning';assert.match(crisisRecollection(s),/没有完整记录/);s.flags.crisis.status='averted';assert.match(sceneFor(s,'F6').body.join(''),/没有完整记录/);assert.doesNotMatch(sceneFor(s,'F6').body.join(''),/改写前后的两条曲线/);
});

test('south-bank training uses an open reading circle and retains its trace after closing',()=>{const s=renewed();assert.match(sceneFor(s,'D5').body.join(''),/长凳围在读尺架旁/);for(const i of s.institutions.filter(i=>i.cellId==='D5'))i.active=false;assert.match(sceneFor(s,'D5').body.join(''),/读尺围座还在，带教已经停下/);});
