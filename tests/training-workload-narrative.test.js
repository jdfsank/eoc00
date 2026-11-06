import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-training-workload-producer/simulation.js';
import {sceneFor,evidenceFor,characterEpilogue} from '../src/story.js';
import {riverbankHistory} from '../src/riverbank-history.js';
import {getDecadeReview} from '../src/decade-review.js';
import {getEndingRecollection} from '../src/ending-recollection.js';
import {getHandoffOutlook} from '../src/handoff-outlook.js';

function lock(s,cell,id,actor='protagonist',api=sim){
 const action=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(action,`${s.year} ${id}`);
 for(const e of action.requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);
 api.lockTask(s,actor,cell,id);
}
function commit(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);return s;}
function next(s,api=sim){commit(s,api);api.advanceToNextWindow(s);return s;}
function at30(api=sim){const s=api.createRun(0);lock(s,'D4','build_joint','protagonist',api);next(s,api);lock(s,'D4','recruit_successor','protagonist',api);next(s,api);lock(s,'B4','independent_review','protagonist',api);lock(s,'D4','free_warning','linche',api);next(s,api);return s;}
function locked(api=sim){const s=at30(api);lock(s,'E4','authorize_training','linche',api);lock(s,'D4','share_power','protagonist',api);return s;}
function pending(api=sim){return commit(locked(api),api);}
function resolved(cancel=false){const s=pending();if(cancel)s.institutions.find(i=>i.kind==='training'&&i.cellId==='E4').active=false;sim.advanceYear(s);return s;}
function ended(cancel=false){const s=resolved(cancel);sim.advanceToNextWindow(s);return s;}
const history=s=>riverbankHistory(s,'E4',{});
const card=s=>history(s).cards.find(c=>c.id==='training-authorization');
const body=c=>c.paragraphs.join('');
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};

test('free scene discloses the work tradeoff, while testimony preserves trainees agency and is not a signature',()=>{
 const s=at30(),before=structuredClone(s),scene=sceneFor(s,'E4');
 assert.ok(sim.getTrainingAuthorizationPlan(s).workload);
 assert.match(scene.body.join(''),/协商轮值职责与承接权/);
 assert.match(scene.body.join(''),/多做议事与生计协调、提高政治和经济来源.*少排深入教学、降低科学来源.*保留日常读尺/);
 assert.match(scene.body.join(''),/第31年只核对.*原培训点.*目标停运、缺失或已经获得授权.*取消，费用不退/);
 const sceneTerms=scene.body.filter(p=>p.includes('桌前的轮值表')||p.startsWith('第31年只核对'));
 assert.equal(sceneTerms.length,2);assert.ok(sceneTerms.join('').length<180);
 assert.doesNotMatch(sceneTerms.join(''),/政治3、经济2|维护系数|工时比例|净增预测/);
 assert.doesNotMatch(scene.body.join(''),/成功只增加.*不增加.*产出/);
 const e=evidenceFor(s,'resident_testimony','E4','linche');
 assert.match(e.text,/不能把这些工作加在原来的全部课时上/);
 assert.match(e.text,/读过材料不等于已经授权或改排.*不能由主角或林澈代签/);
 assert.equal(card(s),undefined);assert.deepEqual(s,before);
});

test('locked outlook describes a condition and pending visit does not claim the new schedule began',()=>{
 const s=locked(),original=structuredClone(s),outlook=getHandoffOutlook(s);
 assert.ok(outlook.authorizationConditional[0].workload);
 assert.match(outlook.notes.join(''),/若新合同兑现.*减少深入带教.*实际仍乘维护系数/);
 assert.match(outlook.notes.join(''),/授权未兑现.*不执行职责改排/);
 assert.deepEqual(s,original);commit(s);const before=structuredClone(s),c=card(s);
 assert.equal(c.status,'pending');assert.match(body(c),/现在仍待兑现.*没有开始改排/);
 assert.match(body(c),/这项排班尚未执行/);
 assert.doesNotMatch(body(c),/并开始调整轮值|原点目前仍按这份排班/);
 assert.deepEqual(s,before);
});

test('actual31 source-backed schedule retains basic reading and exposes the teaching opportunity cost',()=>{
 const s=resolved(),before=structuredClone(s),c=card(s);
 assert.match(body(c),/第31年.*原东岸学徒.*并开始调整轮值/);
 assert.match(body(c),/保留基本读尺与预警，减少深入带教，承担公开议事和生计协调/);
 assert.match(body(c),/政治、经济较原排班提高，科学降低，宗教不变/);
 assert.match(body(c),/其他学校或南岸读尺班没有因此获得/);
 assert.ok(c.sourceIds.includes('resolved:event:action:30:linche:E4:authorize_training'));
 assert.deepEqual(s,before);
});

test('cancellation recalls the unexecuted proposal without giving it a continuing effect',()=>{
 const s=ended(true),c=card(s),last=getEndingRecollection(s).lastInterventions.find(c=>c.actionId==='authorize_training');
 assert.match(body(c),/本次协商取消，没有新增授权或执行职责改排/);
 assert.match(body(c),/拟议排班没有生效/);
 assert.doesNotMatch(body(c),/并开始调整轮值|原点目前仍按这份排班/);
 assert.equal(last.status,'cancelled');assert.match(last.responsibility,/没有执行拟议的职责改排/);
});

test('ending recalls real work rather than just a signature, and later closure removes present benefit claims',()=>{
 const s=ended(),before=structuredClone(s),review=getDecadeReview(s).cards.find(c=>c.actorId==='linche');
 const last=getEndingRecollection(s).lastInterventions.find(c=>c.actionId==='authorize_training');
 assert.match(review.outcome,/留下本地承接签名，并重排原点职责/);
 assert.match(last.outcome,/减少深入带教.*公开议事和生计协调/);
 assert.match(last.responsibility,/议事和生计协调占用了深入带教/);
 assert.match(last.responsibility,/政治、经济来源提高，科学来源降低/);
 assert.match(characterEpilogue(s).find(p=>p.name==='林澈').paragraphs.join(''),/重排原点职责/);
 assert.deepEqual(s,before);
 s.institutions.find(i=>i.localHandoffAuthorization).active=false;
 assert.match(body(card(s)),/原点当前停运，不再提供这份排班/);
 const closed=getEndingRecollection(s).lastInterventions.find(c=>c.actionId==='authorize_training');
 assert.match(closed.responsibility,/原点当前停运.*当前不再提供年度来源/);
 assert.doesNotMatch(closed.responsibility,/当前政治、经济来源提高/);
});

test('a broken contract or unknown operation never becomes proof of a running workload',()=>{
 const unknown=ended();unknown.institutions.find(i=>i.localHandoffAuthorization).maintenance=NaN;
 assert.match(body(card(unknown)),/当前运转情况未知/);
 assert.doesNotMatch(body(card(unknown)),/原点目前仍按这份排班/);
 const s=ended();s.history=s.history.filter(h=>h.id!=='resolved:event:action:30:linche:E4:authorize_training');
 const c=card(s),last=getEndingRecollection(s).lastInterventions.find(c=>c.actorId==='linche');
 assert.equal(c.status,'unknown');assert.deepEqual(c.sourceIds,[]);
 assert.doesNotMatch(body(c),/开始调整轮值|按这份排班提供来源/);
 assert.equal(last.status,'unknown');assert.doesNotMatch(last.outcome,/重排原点职责/);
});

for(const phase of ['pending','success','cancelled'])test(`${phase} narrative is read-only and avoids hidden RNG and investigation inventory`,()=>{
 const s=phase==='pending'?pending():resolved(phase==='cancelled');
 if(phase!=='pending')sim.advanceToNextWindow(s);
 const expectedHistory=history(frozen(structuredClone(s))),expectedReview=getDecadeReview(frozen(structuredClone(s)));
 for(const key of ['seed','drafts','investigations'])Object.defineProperty(s,key,{get(){throw Error(key);}});
 for(const event of s.events)for(const key of ['roll','probability','title','text'])Object.defineProperty(event,key,{get(){throw Error(key);}});
 assert.deepEqual(history(s),expectedHistory);assert.deepEqual(getDecadeReview(s),expectedReview);
});

test('genuine pre-workload producer keeps six phases of complete narrative output byte-for-byte',()=>{
 // Captured before round21 edits from the frozen round20 producer and views.
 // Hash covers all five edited narrative readers plus character epilogues.
 const expected={planning:'e6656304d150acc1be62d08826d40b87d5cbaf31516aa2d7f73cfba6638678f9',locked:'c49e83ff9f11e63a1479f1a245780741a4e4dbc29165c733c860b4100b9089cc',pending:'28c7f1e4b6f22b77fa41542d20ba627672cbf96534082f6d1072b53e2cb884bc',resolved:'43b270c0e975538d936626a1554b9d9de3a22e7208f8e6d0d814fc143a23d180',ended:'ba0c8959796294bd41f9a623ea17ff86965322360cb731268e51c0a3b4071791',stopped:'664c10194380aba7b681d49aff79ad88f2474de3fc520e016dbb1a7bea0c85aa'};
 const inspect=s=>({scene:sceneFor(s,'E4'),evidence:evidenceFor(s,'resident_testimony','E4','linche'),history:history(s),review:getDecadeReview(s),outlook:getHandoffOutlook(s),ending:getEndingRecollection(s),people:characterEpilogue(s)});
 const check=(s,phase)=>{assert.equal(s.trainingWorkloadRulesVersion,undefined);const before=structuredClone(s);assert.equal(createHash('sha256').update(JSON.stringify(inspect(s))).digest('hex'),expected[phase],phase);assert.deepEqual(s,before);};
 const s=at30(previous);check(s,'planning');lock(s,'E4','authorize_training','linche',previous);lock(s,'D4','share_power','protagonist',previous);check(s,'locked');commit(s,previous);check(s,'pending');previous.advanceYear(s);check(s,'resolved');previous.advanceToNextWindow(s);check(s,'ended');s.institutions.find(i=>i.localHandoffAuthorization).active=false;check(s,'stopped');
});
