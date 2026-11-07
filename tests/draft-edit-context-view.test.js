import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDraftEditContext as render} from '../src/draft-edit-context-view.js';
test('reading slip distinguishes the retained plan, prospective replacement and nonrefundable research',()=>{
 const view=Object.freeze({actorId:'protagonist',actorName:'主角',cellId:'D4',title:'商会独资',status:'locked'});
 const html=render(view);assert.match(html,/主角 · D4 · 商会独资/);assert.match(html,/重选中 · 原安排仍保留/);assert.match(html,/明确重新锁定，才会替换原安排/);assert.match(html,/实际调查仍消耗轮次，已用轮次不退回/);assert.match(html,/data-action="draft-edit-return"/);assert.doesNotMatch(html,/已提交|已兑现|保证成功/);
});
test('passed slot names the actual abstention, without inventing a location or contract',()=>{
 const html=render({actorId:'protagonist',actorName:'主角',cellId:null,title:'本窗口明确放弃',status:'passed'});assert.match(html,/主角 · 本窗口明确放弃/);assert.doesNotMatch(html,/null|undefined/);
});
test('absent context renders nothing and literal names cannot become HTML',()=>{
 assert.equal(render(null),'');const html=render({actorId:'" onclick="bad',actorName:'<script>',cellId:'D4',title:'<img src=x>'});assert.doesNotMatch(html,/<script>|<img| onclick="/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot; onclick=&quot;bad/);
});
