import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChoiceAgency, navigateActorAgency} from '../src/actor-agency-view.js';
const refusal = {actionId:'relocate_teacher',title:'林澈不亲自执行强制迁任',reason:'不能替她同意。'};
test('agency summary preserves current refusal without inventing its provenance',()=>{
 const input=[{...refusal,sourceEventId:null,sourceRecordId:null}],before=JSON.stringify(input);
 const html=renderChoiceAgency(input);
 assert.match(html,/执行者的立场/);assert.match(html,/林澈不亲自执行强制迁任/);
 assert.match(html,/补充调查不会解除这项执行限制/);assert.match(html,/不替主角作决定/);
 assert.match(html,/回读完整理由/);assert.doesNotMatch(html,/第11年|已存来源|入局承诺|data-action="choose"|disabled/);
 assert.equal(JSON.stringify(input),before);
 assert.equal(renderChoiceAgency([{...refusal,sourceEventId:'event:known'}]),html);
});
test('absent, ambiguous and unsupported refusals produce no position',()=>{
 for(const input of [null,[],[refusal,refusal],[{}],[{...refusal,actionId:'other'}],[{...refusal,title:''}],[{...refusal,reason:null}]])assert.equal(renderChoiceAgency(input),'');
});
test('existing refusal title is escaped, never interpolated as markup',()=>{
 assert.match(renderChoiceAgency([{...refusal,title:'<script>"&\''}]),/&lt;script&gt;&quot;&amp;&#39;/);
});
function fixture(destination='reason') {
 const calls=[];
 const page={querySelectorAll:()=>[target]};
 const origin={closest:()=>page};const region={closest:()=>page};
 const target={closest:()=>region,focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
 const link={dataset:{actorAgencyLink:destination},closest:selector=>selector==='.scene-planning-page'?page:origin};
 return {page,origin,region,target,link,calls};
}
test('both directions focus and scroll within one scene without state or URL changes',()=>{
 for(const destination of ['reason','summary']){
  const f=fixture(destination);assert.equal(navigateActorAgency(f.link),f.target);
  assert.deepEqual(f.calls,[['focus',{preventScroll:true}],['scroll',{block:'start',behavior:'instant'}]]);
 }
});
test('malformed, outside, missing and duplicate destinations do not navigate',()=>{
 for(const link of [null,{}, {dataset:{actorAgencyLink:'world'},closest:()=>({})}])assert.equal(navigateActorAgency(link),null);
 for(const count of [0,2]){const f=fixture();f.page.querySelectorAll=()=>Array(count).fill(f.target);assert.equal(navigateActorAgency(f.link),null);assert.deepEqual(f.calls,[]);}
 const f=fixture();f.origin.closest=()=>({});assert.equal(navigateActorAgency(f.link),null);assert.deepEqual(f.calls,[]);
 const g=fixture();g.region.closest=()=>({});assert.equal(navigateActorAgency(g.link),null);assert.deepEqual(g.calls,[]);
});
