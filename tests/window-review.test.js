import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,investigate,passTask,commitWindow,advanceToNextWindow,getWindowReview} from '../src/simulation.js';
import { investigateAndLock as lockTask } from './helpers/play.js';
function twoActors(){const s=createRun(12);lockTask(s,'protagonist','D4','build_joint');commitWindow(s);advanceToNextWindow(s);lockTask(s,'protagonist','D4','recruit_successor');commitWindow(s);advanceToNextWindow(s);return s;}
test('review is read-only and exposes local costs without future random results',()=>{const s=createRun(12);lockTask(s,'protagonist','D4','build_joint');const before=JSON.stringify(s),r=getWindowReview(s);assert.equal(r.ready,true);assert.deepEqual(r.costs,{D4:{economy:6}});assert.equal(JSON.stringify(s),before);assert.equal(s.events.length,0);assert.ok(!JSON.stringify(r).includes('roll'));r.tasks[0].d.evidence=[];assert.equal(s.drafts.protagonist.evidence.length,2);});
test('review names missing actor and same-cell conflict before commit is attempted',()=>{const s=twoActors();lockTask(s,'protagonist','D4','free_warning');assert.match(getWindowReview(s).issues.join(' '),/林澈.*尚未安排/);lockTask(s,'linche','D4','present_archive');const before=JSON.stringify(s),r=getWindowReview(s);assert.equal(r.ready,false);assert.match(r.issues.join(' '),/D4同格任务冲突/);assert.throws(()=>commitWindow(s),/同格任务冲突/);assert.equal(JSON.stringify(s),before);});
test('review explains insufficient local channel and refuses all writes',()=>{const s=createRun();lockTask(s,'protagonist','D4','build_joint');s.cells.find(c=>c.id==='D4').channels.economy=2;const before=JSON.stringify(s),r=getWindowReview(s);assert.equal(r.ready,false);assert.match(r.issues.join(' '),/D4的经济能力不足：现有2.0，需支付6/);assert.throws(()=>commitWindow(s),/不足/);assert.equal(JSON.stringify(s),before);});
test('duplicate global protection warns while distinct local station benefits stay possible',()=>{const s=twoActors();lockTask(s,'protagonist','B4','independent_review');lockTask(s,'linche','F6','independent_review');const r=getWindowReview(s);assert.equal(r.ready,true);assert.match(r.warnings.join(' '),/只生效一次.*各自产出知识/);commitWindow(s);advanceToNextWindow(s);assert.equal(s.flags.crisis.damage,0);assert.equal(s.institutions.filter(i=>i.kind==='independent').length,2);});
test('duplicate veto and overlapping review/veto warn without silently changing player choices',()=>{const s=twoActors();lockTask(s,'protagonist','B4','local_veto');lockTask(s,'linche','F6','local_veto');assert.match(getWindowReview(s).warnings.join(' '),/不叠加/);lockTask(s,'protagonist','B4','independent_review');assert.match(getWindowReview(s).warnings.join(' '),/不再额外降低第23年损失/);});
test('explicit all-pass warns and stays a valid zero-cost choice',()=>{const s=createRun();passTask(s,'protagonist');const r=getWindowReview(s);assert.equal(r.ready,true);assert.deepEqual(r.costs,{});assert.match(r.warnings.join(' '),/所有棋子都明确放弃/);commitWindow(s);assert.equal(s.phase,'playback');});


test('unprepared review and veto are complementary fallback rather than redundant protection',()=>{
  const s=createRun(12);
  passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);
  lockTask(s,'protagonist','D4','recruit_risk');commitWindow(s);advanceToNextWindow(s);
  lockTask(s,'protagonist','B4','independent_review');
  lockTask(s,'linche','F6','local_veto');
  const before=JSON.stringify(s),r=getWindowReview(s);
  assert.equal(r.ready,true);
  assert.equal(r.tasks.find(t=>t.a.id==='independent_review').a.probability,.55);
  assert.match(r.warnings.join(' '),/后备.*失败时停闸仍确定减伤/);
  assert.doesNotMatch(r.warnings.join(' '),/不再额外降低/);
  assert.equal(JSON.stringify(s),before);
});

test('two unprepared review attempts disclose separate determinations without stacking success',()=>{
  const s=createRun(12);
  passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);
  lockTask(s,'protagonist','D4','recruit_risk');commitWindow(s);advanceToNextWindow(s);
  lockTask(s,'protagonist','B4','independent_review');
  lockTask(s,'linche','F6','independent_review');
  const r=getWindowReview(s);
  assert.equal(r.ready,true);
  assert.deepEqual(r.tasks.map(t=>t.a.probability),[.55,.55]);
  assert.match(r.warnings.join(' '),/分别判定.*任一成功.*不叠加/);
  commitWindow(s);
  const pending=s.events.filter(e=>e.actionId==='independent_review');
  assert.equal(new Set(pending.map(e=>e.id)).size,2);
  assert.deepEqual(pending.map(e=>e.probability),[.55,.55]);
});

test('surveyed and basic veto keep the stronger protection without multiplying it',()=>{
  const s=twoActors();
  lockTask(s,'protagonist','B4','local_veto');
  investigate(s,'linche','F6','evacuation_routes');
  lockTask(s,'linche','F6','local_veto');
  const r=getWindowReview(s);
  assert.equal(r.ready,true);
  assert.match(r.warnings.join(' '),/不叠加/);
  commitWindow(s);advanceToNextWindow(s);
  assert.equal(s.flags.vetoMitigation,.2);
});


test('later route evidence does not silently alter a locked veto and review explains how to incorporate it',()=>{
 const s=twoActors();lockTask(s,'protagonist','B4','local_veto');passTask(s,'linche');
 investigate(s,'protagonist','B4','evacuation_routes');
 const review=getWindowReview(s);assert.match(review.tasks[0].a.reward,/0.30/);assert.doesNotMatch(review.tasks[0].a.reward,/0.20/);
 assert.match(review.warnings.join(' '),/尚未纳入.*0.30.*修改并重新锁定.*0.20/);assert.deepEqual(s.drafts.protagonist.evidence,[]);
 const original=structuredClone(s);commitWindow(original);advanceToNextWindow(original);assert.equal(original.flags.vetoMitigation,.3);
 lockTask(s,'protagonist','B4','local_veto');assert.match(getWindowReview(s).tasks[0].a.reward,/0.20/);assert.ok(!getWindowReview(s).warnings.some(w=>w.includes('尚未纳入')));
 commitWindow(s);advanceToNextWindow(s);assert.equal(s.flags.vetoMitigation,.2);
});
