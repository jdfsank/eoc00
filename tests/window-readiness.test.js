import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import {lock,next} from './fixtures/pre-training-workload-scenarios.js';
import {getWindowReadinessContext} from '../src/window-readiness-context.js';
import {renderWindowReadiness,navigateWindowReadiness} from '../src/window-readiness-view.js';
const context=s=>getWindowReadinessContext(s,api.getWindowReview(s));
function pair(producer=api){const s=producer.createRun(12);next(s,producer);lock(s,'protagonist','D4','recruit_volunteer',producer);next(s,producer);return s;}
function conflict(producer=api){const s=pair(producer);lock(s,'protagonist','D4','free_warning',producer);lock(s,'linche','D4','present_archive',producer);return s;}
function frozen(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}return value;}

test('readiness preserves authoritative issue text and independent unassigned destinations',()=>{
 const s=pair(),review=api.getWindowReview(s),view=getWindowReadinessContext(s,review);
 assert.deepEqual(view.issues,review.issues);assert.notEqual(view.issues,review.issues);
 assert.deepEqual(view.routes.map(r=>r.links[0].target),['actor:protagonist','actor:linche']);
 assert.ok(view.routes.every(r=>r.kind==='unassigned'));
});
test('explicit pass is assigned, never a missing-person blocker',()=>{
 const s=pair();api.passTask(s,'protagonist');assert.deepEqual(context(s).routes.map(r=>r.links[0].target),['actor:linche']);
 api.passTask(s,'linche');assert.equal(api.getWindowReview(s).ready,true);assert.equal(context(s),null);
});
for(const [name,producer] of [['current',api],['genuine old producer',old]])test(`${name} natural conflict gives both people, without choosing a loser`,()=>{
 const s=conflict(producer),before=JSON.stringify(s),view=context(s);
 assert.equal(api.validateState(s).valid,true);assert.deepEqual(view.issues,api.getWindowReview(s).issues);
 assert.deepEqual(view.routes,[{kind:'conflict',label:'D4 · 同地安排需要重排',links:[{target:'actor:protagonist',label:'核对主角的安排'},{target:'actor:linche',label:'核对林澈的安排'}]}]);
 assert.equal(JSON.stringify(s),before);
});
test('detached low-balance boundary aggregates both costs, not a claimed natural play route',()=>{
 const s=pair();lock(s,'protagonist','E4','train_network',api);lock(s,'linche','E4','train_network',api);
 // Deliberately synthetic unit-only boundary: each 4/2 contract fits, their 8/4 sum does not.
 const cell=s.cells.find(c=>c.id==='E4');cell.channels.economy=6;cell.channels.science=3;
 const review=api.getWindowReview(s),view=getWindowReadinessContext(s,review);
 assert.deepEqual(review.costs.E4,{economy:8,science:4});assert.equal(review.ready,false);
 assert.deepEqual(view.routes.map(r=>r.kind),['conflict','cost']);
 assert.deepEqual(view.routes[1].links.map(l=>l.target),['cost:E4','actor:protagonist','actor:linche']);
 assert.deepEqual(view.issues,review.issues);
});
test('detached single-contract shortfall preserves simultaneous missing-person blocker',()=>{
 const s=pair();lock(s,'protagonist','E4','train_network',api);s.cells.find(c=>c.id==='E4').channels.economy=1;
 const view=context(s);assert.deepEqual(view.routes.map(r=>r.kind),['unassigned','cost']);
 assert.deepEqual(view.routes[1].links.map(l=>l.target),['cost:E4','actor:protagonist']);
});
test('detached exact affordability boundary never adds a cost route',()=>{
 const s=pair();lock(s,'protagonist','E4','train_network',api);s.cells.find(c=>c.id==='E4').channels.economy=4;s.cells.find(c=>c.id==='E4').channels.science=2;
 assert.deepEqual(context(s).routes.map(r=>r.kind),['unassigned']);
});
test('unrecognized or stale authoritative issues retain text without guessed destinations',()=>{
 const s=pair();for(const issues of [['unknown integrity condition'],[...api.getWindowReview(s).issues,'unknown condition'],api.getWindowReview(s).issues.slice().reverse()]){
 const v=getWindowReadinessContext(s,{ready:false,issues});assert.deepEqual(v,{issues,routes:[]});
 }
});
test('damaged public facts preserve issues without routing',()=>{
 const s=pair(),review=api.getWindowReview(s);s.cells=null;
 assert.deepEqual(getWindowReadinessContext(s,review),{issues:review.issues,routes:[]});
});
test('integrity failure outside public planning facts never nominates a person',()=>{
 const s=pair();s.version='unknown-version';const review=api.getWindowReview(s);
 assert.equal(review.ready,false);assert.deepEqual(getWindowReadinessContext(s,review),{issues:review.issues,routes:[]});
});
test('invalid draft contract is not falsely labelled unassigned or a collision',()=>{
 const s=conflict();s.drafts.linche.actionId='not-an-action';const review=api.getWindowReview(s),view=getWindowReadinessContext(s,review);
 assert.equal(review.ready,false);assert.deepEqual(view.issues,review.issues);assert.deepEqual(view.routes,[]);
});
test('valid warning-only and all-pass reviews create no blocker component',()=>{
 const s=pair();lock(s,'protagonist','B4','local_veto',api);lock(s,'linche','F6','local_veto',api);
 const review=api.getWindowReview(s);assert.equal(review.ready,true);assert.ok(review.warnings.length);assert.equal(getWindowReadinessContext(s,review),null);
 const p=pair();for(const a of api.getActors(p))api.passTask(p,a.id);assert.ok(api.getWindowReview(p).warnings.length);assert.equal(context(p),null);assert.equal(renderWindowReadiness(null),'');
});
test('nonplanning and empty/ready inputs have no blocker component',()=>{
 const s=api.createRun();for(const review of [null,{ready:true,issues:['x']},{ready:false,issues:[]},{ready:false,issues:null}])assert.equal(getWindowReadinessContext(s,review),null);
 api.passTask(s,'protagonist');api.commitWindow(s);assert.equal(getWindowReadinessContext(s,{ready:false,issues:['stale']}),null);
 assert.equal(getWindowReadinessContext(null,{ready:false,issues:['x']}),null);
});
test('context and rendering do not mutate frozen state, review, or view',()=>{
 const s=frozen(conflict()),review=frozen(api.getWindowReview(s)),before=JSON.stringify({s,review});const view=frozen(getWindowReadinessContext(s,review));
 assert.ok(renderWindowReadiness(view).includes('data-window-readiness'));assert.equal(JSON.stringify({s,review}),before);
});
test('renderer escapes issue text, route labels and attribute targets',()=>{
 const attack='\"><img src=x onerror=alert(1)> & \'',view={issues:[attack],routes:[{kind:attack,label:attack,links:[{target:attack,label:attack}]}]};
 const html=renderWindowReadiness(view);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&quot;'));assert.ok(html.includes('&#39;'));
 assert.equal((html.match(/role="status"/g)||[]).length,1);assert.ok(html.includes('定位只供核对'));
});
test('navigation targets only an exact existing heading and never an arbitrary selector',()=>{
 const calls=[],node={dataset:{reviewTarget:'actor:linche'},focus:o=>calls.push(['focus',o]),scrollIntoView:o=>calls.push(['scroll',o])};
 const root={querySelectorAll:selector=>{assert.equal(selector,'[data-review-target]');return [node];}};
 assert.equal(navigateWindowReadiness(root,'actor:linche'),node);assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start',behavior:'instant'}]]);
 assert.equal(navigateWindowReadiness(root,'actor:protagonist'),null);assert.equal(navigateWindowReadiness(root,'[data-action="commit"]'),null);assert.equal(calls.length,2);
});
