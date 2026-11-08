import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPolicyForkDetail,renderPolicyForkTiming} from '../src/policy-choice-fork-view.js';
const choice={actionId:'share_power',effect:'若有准备，可自治复核。',responsibility:'仍有责任。',current:'现在尚缺校验。'};
test('policy sketches supplement exact text without another interactive control',()=>{
 for(const actionId of ['share_power','central_review','withdraw']){
  const out=renderPolicyForkDetail({...choice,actionId});
  assert.match(out,new RegExp('id="policy-fork-'+actionId+'"'));
  for(const text of [choice.effect,choice.responsibility,choice.current,'方针所求','此刻核对','仍需承担'])assert.ok(out.includes(text));
  assert.equal((out.match(/aria-hidden="true"/g)||[]).length,1);
  assert.doesNotMatch(out,/<(?:button|a|input)|data-action|tabindex|href=/);
 }
});
test('policy text escapes untrusted markup and rejects unknown IDs',()=>{
 const out=renderPolicyForkDetail({...choice,effect:'<img onerror="x">',current:'A&B',responsibility:"'q'"});
 assert.ok(out.includes('&lt;img onerror=&quot;x&quot;&gt;'));assert.ok(out.includes('A&amp;B'));assert.ok(out.includes('&#39;q&#39;'));assert.doesNotMatch(out,/<img/);
 for(const bad of [null,{}, {...choice,actionId:'constructor'},{...choice,actionId:'<script>'},{...choice,effect:''},{...choice,current:null},{...choice,responsibility:null}])assert.equal(renderPolicyForkDetail(bad),'');
});
test('two-date timing keeps signing and assessment separately escaped',()=>{
 const out=renderPolicyForkTiming({timing:'第31年 <签署>',assessment:'第40年 & 核对'});
 assert.ok(out.includes('第31年 &lt;签署&gt;'));assert.ok(out.includes('第40年 &amp; 核对'));
 assert.doesNotMatch(out,/<(?:button|a|input)|data-action|tabindex|href=/);
 for(const bad of [null,{}, {timing:'a'},{assessment:'b'}])assert.equal(renderPolicyForkTiming(bad),'');
});
test('policy view is deterministic with frozen inputs',()=>{
 const c=Object.freeze({...choice}),f=Object.freeze({timing:'31',assessment:'40'}),before=JSON.stringify([c,f]);
 assert.equal(renderPolicyForkDetail(c),renderPolicyForkDetail(c));assert.equal(renderPolicyForkTiming(f),renderPolicyForkTiming(f));assert.equal(JSON.stringify([c,f]),before);
});
