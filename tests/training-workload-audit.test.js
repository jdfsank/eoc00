import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as current from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import {getTrainingChoiceComparison} from '../src/training-choice-comparison.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import {restoreSave as oldRestore} from './fixtures/pre-training-workload-producer/save.js';
import {copy, bytes, lock, commit, ready, checkpoints, finalLocks} from './fixtures/pre-training-workload-scenarios.js';

test('round21 audit freezes every genuine round20 producer dependency, including board and restore', () => {
  const base = new URL('./fixtures/pre-training-workload-producer/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', base)));
  assert.equal(manifest.sourceCommit, 'd7a25c5965c13f78ebadf9bcab033325137e816a');
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = fs.readFileSync(new URL(name, base));
    assert.equal(createHash('sha256').update(file).digest('hex'), expected, name);
    if (name.endsWith('.js')) assert.doesNotMatch(file.toString(), /from\s*['"](?:\.\.\/|\/)/, `${name}: no live production dependency`);
  }
});

const routes = [
  {name:'joint', seed:0, build:'build_joint'},
  {name:'state', seed:0, build:'build_state'},
  {name:'merchant', seed:1, build:'build_merchant'},
  {name:'failed-review', seed:2, build:'build_merchant'},
  {name:'no-check', seed:0, build:'build_joint', review:false},
  {name:'no-trust', seed:0, build:'build_joint', warning:false},
];

for (const route of routes) for (const support of ['authorize_training','train_network']) for (const policy of ['share_power','withdraw','central_review']) {
  test(`round21 old ${route.name}/${support}/${policy}: six genuine restore phases and every subsequent year retain all state bytes`, () => {
    const options = {...route, support, policy};
    for (const [phase, source] of Object.entries(checkpoints(old, options))) {
      assert.equal(Object.hasOwn(source, 'trainingWorkloadRulesVersion'), false);
      assert.equal(old.validateState(source).valid, true, phase);
      const baseline = oldRestore({state:copy(source), ui:{screen:'ending', selected:'E4'}}).state;
      const restored = restoreSave({state:copy(source), ui:{screen:'ending', selected:'E4'}}, {imported:true});
      const actual = restored.state;
      assert.equal(restored.ui.screen, 'world');
      assert.equal(bytes(actual), bytes(baseline), `${phase}: restore cannot migrate state`);
      if (phase === 'planning') {
        const before = bytes(actual);
        getTrainingChoiceComparison(actual, 'E4', 'linche');
        assert.equal(bytes(actual), before, 'read-only comparison cannot retag the old world');
        finalLocks(baseline, old, options); finalLocks(actual, current, options);
        assert.equal(bytes(actual), bytes(baseline), `${phase}: investigation and locking`);
      }
      if (actual.phase === 'planning') {
        commit(baseline, old); commit(actual, current);
        assert.equal(bytes(actual), bytes(baseline), `${phase}: exact original payment and contract`);
      }
      while (actual.year < 40) {
        old.advanceYear(baseline); current.advanceYear(actual);
        assert.equal(bytes(actual), bytes(baseline), `${phase}: entire year ${actual.year}, including snapshots and history`);
        assert.equal(current.validateState(actual).valid, true);
        assert.equal(bytes(restoreSave({state:copy(actual)}).state), bytes(actual), `${phase}: year ${actual.year} reload`);
      }
      assert.deepEqual(current.getEnding(actual), old.getEnding(baseline), `${phase}: exact ending, metrics and handoff`);
    }
  });
}

for (const support of ['authorize_training','train_network']) test(`round21 old protagonist ${support}: actor order cannot activate new workload rules`, () => {
  // Policy is protagonist-only; when they take the E4 job, Linche passes.
  const options = {actor:'protagonist', support, policy:null};
  const snapshots = checkpoints(old, options);
  for (const phase of ['planning','locked','committed','settled','ended']) {
    const a = copy(snapshots[phase]), b = restoreSave({state:copy(a)}).state;
    if (phase === 'planning') {finalLocks(a, old, options); finalLocks(b, current, options);}
    if (a.phase === 'planning') {commit(a, old); commit(b, current);}
    while (a.year < 40) {old.advanceYear(a); current.advanceYear(b); assert.equal(bytes(b), bytes(a), `${phase}/year${a.year}`);}
  }
});

test('round21 true old year0 producer follows every decision and settlement without retagging or retroactive snapshots', () => {
  const a = old.createRun(0), b = restoreSave({state:copy(a)}).state;
  const actions = {
    0: [['protagonist','D4','build_joint']],
    10: [['protagonist','D4','recruit_successor']],
    20: [['protagonist','B4','independent_review'], ['linche','D4','free_warning']],
    30: [['protagonist','D4','share_power'], ['linche','E4','authorize_training']],
  };
  for (const year of [0,10,20,30]) {
    for (const choice of actions[year]) {lock(a,...choice,old); lock(b,...choice,current); assert.equal(bytes(b),bytes(a), `year${year} decision ${choice[2]}`);}
    commit(a,old); commit(b,current); assert.equal(bytes(b),bytes(a),`year${year} commit`);
    for (let n=0;n<10;n++) {old.advanceYear(a); current.advanceYear(b); assert.equal(bytes(b),bytes(a),`year${a.year} exact continuation`);}
  }
});

const BEFORE={politics:.1,economy:.25,science:.7,religion:.1};
const AFTER={politics:.5,economy:.45,science:.1,religion:.1};
const DELTA={politics:.4,economy:.2,science:-.6,religion:0};
const round=n=>Math.round(n*1e4)/1e4;
const original=s=>s.institutions.find(i=>i.kind==='training'&&i.cellId==='E4');
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function refs(v,result=new Set()){if(v&&typeof v==='object'&&!result.has(v)){result.add(v);Object.values(v).forEach(x=>refs(x,result));}return result;}

test('round21 independent source ledger: only a fulfilled contract changes actual year31 work, not retained base or crisis history',()=>{
 const fresh=checkpoints(current),prior=checkpoints(old),targetId=original(fresh.planning).id;
 assert.equal(fresh.planning.trainingWorkloadRulesVersion,'training-workload-v1');
 for(const phase of ['planning','locked','committed']){
  const s=fresh[phase];assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,original(s)),BEFORE,phase);
  assert.deepEqual(original(s).annualSource,BEFORE);
 }
 const s=fresh.settled,i=original(s),contract=current.getTrainingAuthorizationContracts(s)[0];
 assert.deepEqual(contract.workload,{version:'training-workload-v1',targetId,before:BEFORE,after:AFTER});
 assert.equal(i.localHandoffAuthorization.trainingWorkloadVersion,'training-workload-v1');
 assert.deepEqual(i.annualSource,BEFORE);assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,i),AFTER);
 assert.equal(s.institutions.length,fresh.committed.institutions.length);
 assert.deepEqual(s.flags.crisis,fresh.planning.flags.crisis);
 for(const [year,snapshot] of Object.entries(fresh.planning.snapshots))assert.deepEqual(s.snapshots[year],snapshot,`no rewriting year${year}`);
 // These are separate real producers, not current states with their tag deleted.
 for(const channel of current.CHANNELS){
  const difference=s.cells.find(c=>c.id==='E4').channels[channel]-prior.settled.cells.find(c=>c.id==='E4').channels[channel];
  assert.equal(round(difference),DELTA[channel],`real first-year settlement ${channel}`);
 }
 for(const c of s.cells.filter(c=>c.id!=='E4'))assert.deepEqual(c,prior.settled.cells.find(p=>p.id===c.id),`year31 no arbitrary global bonus ${c.id}`);
 for(const other of s.institutions.filter(x=>x!==i))assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,other),other.annualSource);
});

for(const maintenance of [.1,.5,1])test(`round21 independent maintenance ${maintenance}: actual settlement scales reassigned work without adding coverage`,()=>{
 const a=ready(current),b=ready(old);original(a).maintenance=maintenance;original(b).maintenance=maintenance;
 finalLocks(a,current);finalLocks(b,old);commit(a,current);commit(b,old);current.advanceYear(a);old.advanceYear(b);
 assert.deepEqual(current.getInstitutionEffectiveAnnualSource(a,original(a)),AFTER);
 for(const channel of current.CHANNELS)assert.equal(round(a.cells.find(c=>c.id==='E4').channels[channel]-b.cells.find(c=>c.id==='E4').channels[channel]),round(DELTA[channel]*maintenance),channel);
 assert.deepEqual(current.getWarningCoverage(a),old.getWarningCoverage(b));assert.deepEqual(a.flags.crisis,b.flags.crisis);
});

test('round21 nonstandard uncontracted source stays valid, is not overwritten, and retains real new-training option',()=>{
 const s=ready(current);original(s).annualSource={politics:.13,economy:.29,science:.9,religion:.11};
 const source=copy(original(s).annualSource);assert.equal(current.validateState(s).valid,true);
 assert.equal(current.getTrainingAuthorizationPlan(s).available,false);assert.equal(getTrainingChoiceComparison(s,'E4','linche'),null);
 assert.ok(!current.getActions(s,'E4','linche').some(a=>a.id==='authorize_training'));
 assert.ok(current.getActions(s,'E4','linche').some(a=>a.id==='train_network'));
 assert.equal(bytes(restoreSave({state:copy(s)}).state),bytes(s));
 finalLocks(s,current,{support:'train_network'});commit(s,current);current.advanceYear(s);
 assert.deepEqual(original(s).annualSource,source);assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,original(s)),source);
 assert.equal(current.validateState(s).valid,true);
});

for(const mode of ['stopped','zero-maintenance','missing','replacement'])test(`round21 ${mode}: cancelled frozen target cannot get a reassigned source or replacement grant`,()=>{
 const s=checkpoints(current).committed,t=original(s),savedBase=copy(t.annualSource);
 if(mode==='stopped')t.active=false;
 else if(mode==='zero-maintenance')t.maintenance=0;
 else {s.institutions=s.institutions.filter(i=>i!==t);if(mode==='replacement')s.institutions.push({...t,id:'synthetic-replacement-training'});}
 assert.equal(current.validateState(s).valid,true,'explicit legal import boundary, not a natural player shutdown');
 current.advanceYear(s);assert.equal(current.validateState(s).valid,true);
 assert.equal(current.getTrainingAuthorizationStatus(s).status,'cancelled');assert.ok(s.institutions.every(i=>!i.localHandoffAuthorization));
 for(const i of s.institutions.filter(i=>i.kind==='training'&&i.cellId==='E4'))assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,i),savedBase);
 const paid=s.history.find(h=>h.id.endsWith(':authorize_training')&&h.kind==='action');assert.deepEqual(paid.cost,{politics:3,economy:2});
});

for(const phase of ['committed','settled','year35'])test(`round21 ${phase}: forged vectors, source chain, grant identity and incompatible version reject atomically`,()=>{
 const good=checkpoints(current)[phase];
 for(const mode of ['unknown-version','removed-version','before','after','wrong-target','outcome','base-change','grant-version','orphan-metadata','mismatched-history']){
  if((mode==='outcome'||mode==='grant-version')&&phase==='committed')continue;
  const s=copy(good),event=s.events.find(e=>e.actionId==='authorize_training'),action=s.history.find(h=>h.id===event.sourceActionId),outcome=s.history.find(h=>h.id===`resolved:${event.id}`),i=original(s);
  if(mode==='unknown-version')s.trainingWorkloadRulesVersion='training-workload-future';
  if(mode==='removed-version')delete s.trainingWorkloadRulesVersion;
  if(mode==='before')event.trainingWorkload.before.science=.1;
  if(mode==='after')event.trainingWorkload.after.science=9;
  if(mode==='wrong-target')event.trainingWorkload.targetId='forged-target';
  if(mode==='outcome')delete outcome.trainingWorkload;
  if(mode==='base-change')i.annualSource.science=.8;
  if(mode==='grant-version')i.localHandoffAuthorization.trainingWorkloadVersion='forged';
  if(mode==='orphan-metadata')s.history.find(h=>h.kind==='crisis').trainingWorkload=copy(event.trainingWorkload);
  if(mode==='mismatched-history')action.trainingWorkload.after.economy=.9;
  assert.equal(current.validateState(s).valid,false,mode);
  const before=bytes(s);assert.throws(()=>restoreSave({state:s}),/不兼容|损坏/,mode);assert.throws(()=>current.advanceYear(s),/损坏/,mode);assert.equal(bytes(s),before,`${mode}: no partial settlement`);
 }
});

test('round21 stopped-after-success does not claim live reassigned work and later continuation remains valid',()=>{
 const s=checkpoints(current).year35,i=original(s);i.active=false;
 assert.equal(current.validateState(s).valid,true);assert.deepEqual(current.getInstitutionEffectiveAnnualSource(s,i),BEFORE);
 const fact=current.getTrainingAuthorizationContracts(s)[0];assert.deepEqual(fact.workload.after,AFTER,'historical contract remains a historical fact');
 while(s.year<40)current.advanceYear(s);assert.equal(current.validateState(s).valid,true);
});

test('round21 public plan, comparison, contract and effective-source readers are detached, frozen-safe and cannot inspect hidden evidence or future',()=>{
 for(const phase of ['planning','locked','committed','settled','ended']){
  const s=checkpoints(current)[phase];
  const read=state=>({plan:current.getTrainingAuthorizationPlan(state),contracts:current.getTrainingAuthorizationContracts(state),comparison:getTrainingChoiceComparison(state,'E4','linche'),source:current.getInstitutionEffectiveAnnualSource(state,original(state))});
  const expected=read(s),before=bytes(s),sourceRefs=refs(s),frozen=freeze(copy(s));assert.deepEqual(read(frozen),expected);
  for(const r of refs(expected))assert.equal(sourceRefs.has(r),false,`${phase}: detached output`);
  const trapped=copy(s),deny=(obj,key)=>Object.defineProperty(obj,key,{get(){throw Error(`Private field ${key}`);},configurable:true});
  for(const k of ['seed','baseline','snapshots','investigations','drafts','promises'])deny(trapped,k);
  for(const row of [...trapped.events,...trapped.history])for(const k of ['roll','probability','text','description','title'])deny(row,k);
  assert.deepEqual(read(trapped),expected,phase);assert.equal(bytes(s),before,`${phase}: no write`);
 }
});

test('round21 natural-route sample proves real non-dominance, not an artificial low-balance claim or a changed ending requirement',()=>{
 let pairs=0;
 for(const route of routes){
  const a=checkpoints(current,{...route,support:'authorize_training'}),b=checkpoints(current,{...route,support:'train_network'});
  const x=a.ended.cells.find(c=>c.id==='E4').channels,y=b.ended.cells.find(c=>c.id==='E4').channels;
  assert.ok(x.politics>y.politics&&x.economy>y.economy&&x.science<y.science&&x.religion<y.religion,route.name);
  assert.equal(current.getEnding(a.ended).title,current.getEnding(b.ended).title,route.name);
  assert.deepEqual(a.ended.flags.crisis,b.ended.flags.crisis);
  const coverage=s=>Object.fromEntries(Object.entries(current.getWarningCoverage(s)).map(([cell,row])=>[cell,{coverage:row.coverage,protection:row.protection}]));
  assert.deepEqual(coverage(a.ended),coverage(b.ended));
  pairs++;
 }
 assert.equal(pairs,6);
});

for(const maintenance of [.1,.5,1])test(`round21 independent comparison ${maintenance}: both contracts disclose actual scaled sources while preserving new-institution meaning`,()=>{
 const s=ready(current);original(s).maintenance=maintenance;
 const view=getTrainingChoiceComparison(s,'E4','linche'),[authorization,training]=view.options;
 assert.equal(authorization.workload.mode,'reassign');assert.equal(training.workload.mode,'expand');
 assert.deepEqual(authorization.workload.before,BEFORE);assert.deepEqual(authorization.workload.after,AFTER);
 assert.deepEqual(training.workload.before,BEFORE);assert.deepEqual(training.workload.after,BEFORE);
 assert.deepEqual(authorization.annualSourceAdded,{politics:0,economy:0,science:0,religion:0});
 assert.deepEqual(training.annualSourceAdded,{politics:.1,economy:.25,science:.65,religion:.2});
 for(const channel of current.CHANNELS){
  assert.equal(round(authorization.workload.scaledBefore[channel]),round(BEFORE[channel]*maintenance));
  assert.equal(round(authorization.workload.scaledAfter[channel]),round(AFTER[channel]*maintenance));
  assert.equal(round(authorization.annualSourceChange[channel]),round(DELTA[channel]*maintenance));
  assert.equal(training.annualSourceChange[channel],training.annualSourceAdded[channel]);
 }
 assert.equal(authorization.newInstitutions,0);assert.equal(training.newInstitutions,1);
 assert.equal(authorization.investigationRounds,1);assert.equal(training.investigationRounds,0);
 assert.deepEqual(authorization.cost,{politics:3,economy:2});assert.deepEqual(training.cost,{economy:4,science:2});
 for(const row of view.options){const actual=copy(s);finalLocks(actual,current,{support:row.actionId});commit(actual,current);current.advanceYear(actual);const readiness=current.getHandoffReadiness(actual);for(const k of ['staffCells','authorizedCells','checkCells','canShare','canWithdraw'])assert.deepEqual(readiness[k],view.conditional[k]);assert.equal(current.getWarningCoverage(actual).E4.coverage,row.coverage.ifFulfilled);}
 const legacy=ready(old);original(legacy).maintenance=maintenance;
 const legacyOption=getTrainingChoiceComparison(legacy,'E4','linche').options[0];assert.equal(legacyOption.workload.mode,'authorize-only');assert.deepEqual(legacyOption.annualSourceChange,{politics:0,economy:0,science:0,religion:0});
});
