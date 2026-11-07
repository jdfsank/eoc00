import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDraftChoiceComparison} from '../src/draft-choice-comparison-view.js';
test('comparison is a collapsed native ledger, pairs every term and keeps boundaries',()=>{
 const v={actorName:'主角',original:{title:'原合同',location:'D4'},candidate:{title:'备选合同',location:'B4'},evidenceNote:'使用原证据',rows:[{id:'cost',label:'当地成本',original:'经济3',candidate:'宗教2'}]};
 const before=JSON.stringify(v),html=renderDraftChoiceComparison(v);
 assert.match(html,/<details class="draft-choice-comparison" data-draft-choice-comparison><summary>/);
 assert.doesNotMatch(html,/<details[^>]*\sopen/);
 for(const text of ['保留原安排','若改为此方案','原合同','备选合同','当地成本','经济3','宗教2','不是叠加支付','不是全图通用的钱','整轮余额、名额和冲突','不预测随机结局','已用轮次不退回'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/data-draft-comparison-value=/g)||[]).length,2);assert.equal(JSON.stringify(v),before);
 assert.doesNotMatch(html,/<button|data-action=|<input/);
 assert.equal(renderDraftChoiceComparison(null),'');
});
test('comparison escapes all supplied labels, terms and attributes',()=>{
 const text='<img src=x onerror="bad">&\'';
 const html=renderDraftChoiceComparison({actorName:text,original:{title:text,location:text},candidate:{title:text,location:text},evidenceNote:text,rows:[{id:text,label:text,original:text,candidate:text}]});
 assert.doesNotMatch(html,/<img|onerror="bad"/);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&quot;bad&quot;'));assert.ok(html.includes('&amp;&#39;'));
});
