import test from 'node:test';
import assert from 'node:assert/strict';
import {navigateDraftComparison} from '../src/draft-comparison-navigation.js';
import {renderDraftChoiceComparison} from '../src/draft-choice-comparison-view.js';
function fixture(key,open=true,exists=true){
 const calls=[];
 const target={focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
 const details={open,querySelector:selector=>{calls.push(['query',selector]);return exists?target:null;}};
 const link={dataset:{draftComparisonLink:key},closest:selector=>{assert.equal(selector,'[data-draft-choice-comparison]');return details;}};
 return {link,details,target,calls};
}
for(const key of ['cost','time','reward','risk','responsibility','index'])test(`reading ${key} focuses exact local heading without closing the ledger`,()=>{
 const f=fixture(key);assert.equal(navigateDraftComparison(f.link),f.target);assert.equal(f.details.open,true);
 assert.deepEqual(f.calls,[['query',`#draft-comparison-${key}`],['focus',{preventScroll:true}],['scroll',{block:'start',behavior:'instant'}]]);
});
test('closing returns to the same native summary without replacing the reading tree',()=>{
 const f=fixture('close');assert.equal(navigateDraftComparison(f.link),f.target);assert.equal(f.details.open,false);
 assert.deepEqual(f.calls,[['query',':scope > summary'],['focus',{preventScroll:true}],['scroll',{block:'start',behavior:'instant'}]]);
});
test('absent, closed, unknown and missing targets do not navigate or close',()=>{
 assert.equal(navigateDraftComparison(null),null);assert.equal(navigateDraftComparison({}),null);
 for(const key of ['commit','lock','risk\"]','__proto__','']){const f=fixture(key);assert.equal(navigateDraftComparison(f.link),null);assert.deepEqual(f.calls,[]);assert.equal(f.details.open,true);}
 const closed=fixture('risk',false);assert.equal(navigateDraftComparison(closed.link),null);assert.deepEqual(closed.calls,[]);
 const absent=fixture('close',true,false);assert.equal(navigateDraftComparison(absent.link),null);assert.equal(absent.details.open,true);
});
test('index gives all five full contract rows equal access and keeps every original word',()=>{
 const rows=['cost','time','reward','risk','responsibility'].map(id=>({id,label:`label-${id}`,original:`original-${id}`,candidate:`candidate-${id}`}));
 const view={actorName:'主角',original:{title:'商会',location:'D4'},candidate:{title:'官署',location:'D4'},evidenceNote:'原快照',rows};const before=JSON.stringify(view),html=renderDraftChoiceComparison(view);
 assert.ok(html.indexOf('账页目录')<html.indexOf('逐项看，再决定是否替换'));
 for(const row of rows){assert.ok(html.includes(`href="#draft-comparison-${row.id}"`));assert.ok(html.includes(`aria-label="定位：${row.label}"`));assert.ok(html.includes(`id="draft-comparison-${row.id}" tabindex="-1"`));assert.ok(html.includes(row.original));assert.ok(html.includes(row.candidate));}
 assert.equal((html.match(/data-draft-comparison-link="index"/g)||[]).length,5);
 assert.equal((html.match(/data-draft-comparison-link="close"/g)||[]).length,1);
 assert.doesNotMatch(html,/<button|data-action=|<input|\sopen[\s>]/);assert.equal(JSON.stringify(view),before);
});
