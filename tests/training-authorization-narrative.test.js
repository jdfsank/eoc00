import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-archive-upgrade-simulation.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {sceneFor,evidenceFor,characterEpilogue} from '../src/story.js';
import {getDecadeReview} from '../src/decade-review.js';

function lock(s,cell,id,actor='protagonist',api=sim){
 const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a,`${s.year} ${actor} ${cell} ${id}`);
 for(const e of a.requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);
 api.lockTask(s,actor,cell,id,a.requireEvidence);
}
function submit(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);return s;}
function next(s,api=sim){submit(s,api);api.advanceToNextWindow(s);return s;}
function at30(api=sim){
 const s=api.createRun(0);lock(s,'D4','build_joint','protagonist',api);next(s,api);
 lock(s,'D4','recruit_successor','protagonist',api);next(s,api);
 lock(s,'D4','present_archive','protagonist',api);lock(s,'B4','independent_review','linche',api);next(s,api);return s;
}
function pending(){const s=at30();lock(s,'E4','authorize_training','linche');lock(s,'D4','share_power');return submit(s);}
function resolved(cancel=false){const s=pending();if(cancel)s.institutions.find(i=>i.cellId==='E4'&&i.kind==='training').active=false;sim.advanceYear(s);return s;}
const auth=s=>getSceneVisit(s,'E4').cards.find(c=>c.id==='training-authorization');
const body=c=>c.paragraphs.join('\n');
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
test('eligible E4 scene compares extending teaching with negotiating existing trainees own bounded responsibility',()=>{
 const s=at30(),before=structuredClone(s),scene=sceneFor(s,'E4');
 assert.match(scene.body.join(''),/原学徒仍在工作.*还没有本地承接授权/);
 assert.match(scene.body.join(''),/政治3、经济2.*会议、公开轮值与记录工作.*1轮E4居民证词/);
 assert.match(scene.body.join(''),/第31年.*目标停运、缺失或已经获得授权.*取消，费用不退/);
 assert.match(scene.question,/新增教学.*已有学徒/);assert.match(scene.body.join(''),/签名不是买来的/);
 const e=evidenceFor(s,'resident_testimony','E4','linche');assert.match(e.title,/原学徒的承接条件/);
 assert.match(e.text,/记录公开.*拒绝不安全指令.*责任必须有边界/);assert.match(e.text,/主角或林澈代签/);
 assert.notEqual(evidenceFor(s,'resident_testimony','D4','linche').title,e.title);
 assert.equal(auth(s),undefined);assert.deepEqual(s,before);
});
test('reading or locking an offer never exposes its unpurchased testimony, signs it, or charges again',()=>{
 const s=at30(),before=getSceneVisit(s,'E4'),state=structuredClone(s);
 assert.doesNotMatch(JSON.stringify(before),/可以拒绝不安全指令|值守责任必须有边界/);
 assert.deepEqual(s,state);lock(s,'E4','authorize_training','linche');
 assert.deepEqual(getSceneVisit(s,'E4'),before);assert.equal(auth(s),undefined);
});
test('submitted30 reads paid costs and frozen original target without promising a signature or new classroom',()=>{
 const s=pending(),before=structuredClone(s),card=auth(s);assert.equal(card.status,'pending');
 assert.match(body(card),/已支付.*第31年核对原学徒.*仍待兑现/);assert.match(body(card),/不等于已经取得.*签名/);
 assert.match(body(card),/其他学校或南岸读尺班没有因此获得/);assert.match(body(card),/不新建学校、不增加人手/);
 assert.ok(card.sourceIds.includes('action:30:linche:E4:authorize_training'));
 assert.ok(card.sourceIds.includes('resolved:event:action:0:protagonist:D4:build_joint:training'));
 assert.ok(!card.sourceIds.some(id=>id==='resolved:event:action:30:linche:E4:authorize_training'));
 assert.deepEqual(s,before);
});
test('the actual31 signatures remain a local mandate, not purchased consent, extra people or Sulan employment',()=>{
 const s=resolved(),before=structuredClone(s),card=auth(s);assert.equal(card.status,'recorded');
 assert.match(body(card),/第31年.*原东岸学徒.*本地承接签名/);assert.match(body(card),/签名不是买来的.*不是介入员替他们签署/);
 assert.match(body(card),/不新建学校、不增加人手、年度产出、预警覆盖或异源校验/);assert.doesNotMatch(body(card),/苏岚/);
 assert.ok(card.sourceIds.includes('resolved:event:action:30:linche:E4:authorize_training'));
 for(const id of card.sourceIds){const r=s.history.find(r=>r.id===id);assert.ok(r);assert.ok(r.year<=31);assert.ok(sim.traceEvent(s,id).every(row=>row.year<=31));}
 assert.deepEqual(s,before);sim.advanceToNextWindow(s);
 const review=getDecadeReview(s).cards.find(c=>c.actorId==='linche');assert.match(review.outcome,/第31年.*原东岸学徒.*签名/);
 assert.match(review.responsibility,/不是购买或代签同意/);assert.doesNotMatch(review.outcome,/新的轮值维护网络/);
 const coda=characterEpilogue(s).find(c=>c.name==='林澈').paragraphs.join('');assert.match(coda,/原东岸学徒.*本地承接签名/);
});
test('cancelled31 keeps paid costs and no grant, both in return visit and40 recollection',()=>{
 const s=resolved(true),card=auth(s);assert.equal(card.status,'recorded');assert.match(body(card),/本次协商取消，没有新增授权.*已付成本不退/);
 assert.match(body(card),/原学徒目标缺失、替换或不再有效运转/);assert.doesNotMatch(body(card),/按已协商的条件留下本地承接签名/);
 assert.equal(s.institutions.some(i=>i.localHandoffAuthorization),false);const impact=structuredClone(s.flags.crisis);
 sim.advanceToNextWindow(s);const c=getDecadeReview(s).cards.find(c=>c.actorId==='linche');assert.match(c.outcome,/第31年.*取消，没有新增授权/);
 assert.match(c.responsibility,/成本不退.*不能替原学徒履约/);assert.deepEqual(s.flags.crisis,impact);
});
test('a later service closure preserves the completed signature without claiming active teaching',()=>{
 const s=resolved();sim.advanceToNextWindow(s);const target=s.institutions.find(i=>i.localHandoffAuthorization);target.active=false;
 const card=auth(s);assert.equal(card.status,'recorded');assert.match(body(card),/第31年.*留下本地承接签名/);assert.match(body(card),/当前停运，原址与旧记录保留/);
 assert.doesNotMatch(body(card),/当前运行中/);
});
for(const status of ['pending','success','cancelled'])test(`${status}: views and recollection do not read RNG, unpublished evidence sessions or future prose`,()=>{
 const s=status==='pending'?pending():resolved(status==='cancelled');if(status!=='pending')sim.advanceToNextWindow(s);
 const expected=getSceneVisit(freeze(structuredClone(s)),'E4'),expectedReview=getDecadeReview(freeze(structuredClone(s)));
 for(const key of ['seed','drafts','investigations'])Object.defineProperty(s,key,{get(){throw Error(key);}});
 for(const e of s.events)for(const key of ['roll','probability','title','text'])Object.defineProperty(e,key,{get(){throw Error(key);}});
 assert.deepEqual(getSceneVisit(s,'E4'),expected);assert.deepEqual(getDecadeReview(s),expectedReview);
});
const corruptions={
 'missing-outcome':(s,a,e,r)=>s.history=s.history.filter(h=>h!==r),
 'duplicate-outcome':(s,a,e,r)=>s.history.push(structuredClone(r)),
 'cross-table-outcome':(s,a,e,r)=>s.events.push({id:r.id,kind:'event',year:39,cellId:'F6',status:'pending',parentId:null,sourceActionId:null,title:'FUTURE SECRET'}),
 'wrong-cost':(s,a)=>a.cost.economy=0,
 'wrong-target':(s,a,e,r)=>r.trainingAuthorizationTarget.id='not-the-original-group',
 'R0-outcome':(s,a,e,r)=>r.reality='R0',
 'wrong-result-year':(s,a,e,r)=>r.year=32,
 'grant-missing':s=>delete s.institutions.find(i=>i.localHandoffAuthorization).localHandoffAuthorization,
};
for(const [name,change] of Object.entries(corruptions))test(`${name}: a broken authorization chain does not become a recorded signature`,()=>{
 const s=resolved(),e=s.events.find(e=>e.actionId==='authorize_training'),a=s.history.find(r=>r.id===e.sourceActionId),r=s.history.find(r=>r.id===`resolved:${e.id}`);change(s,a,e,r);
 const before=structuredClone(s),card=auth(s);assert.equal(card.status,'unknown');assert.deepEqual(card.sourceIds,[]);
 assert.doesNotMatch(body(card),/按已协商的条件留下本地承接签名|FUTURE SECRET/);assert.deepEqual(s,before);
 s.year=40;s.phase='ended';const c=getDecadeReview(s).cards.find(c=>c.actorId==='linche');assert.match(c.outcome,/缺失或不一致.*未知/);
});
test('genuine previous engine has no new offer, new testimony or invented grant',()=>{
 const s=at30(previous),before=structuredClone(s);assert.equal(s.trainingAuthorizationRulesVersion,undefined);
 assert.doesNotMatch(sceneFor(s,'E4').body.join(''),/政治3、经济2|签名不是买来的/);
 assert.notEqual(evidenceFor(s,'resident_testimony','E4').title,'听取原学徒的承接条件');
 assert.equal(auth(s),undefined);assert.deepEqual(s,before);
});
