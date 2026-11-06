import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportRequestGuard} from '../src/import-request-guard.js';

test('import guard begins idle and rejects absent or fabricated tokens',()=>{
  const guard=createImportRequestGuard();
  for(const token of [undefined,null,{},0,'',false])assert.equal(guard.isCurrent(token),false);
});
test('each actual request receives a new immutable identity, not a counter',()=>{
  const guard=createImportRequestGuard(),seen=new Set();
  for(let i=0;i<10000;i++){
    const token=guard.begin();
    assert.equal(typeof token,'object');assert.ok(Object.isFrozen(token));
    assert.ok(!seen.has(token));assert.ok(guard.isCurrent(token));
    if(seen.size)assert.equal(guard.isCurrent([...seen].at(-1)),false);
    seen.add(token);
  }
});
test('newer pending request invalidates the older request before either read completes',()=>{
  const guard=createImportRequestGuard(),a=guard.begin(),b=guard.begin();
  assert.equal(guard.isCurrent(a),false);assert.equal(guard.isCurrent(b),true);
});
test('new-world or local-change invalidation makes all pending callbacks stale',()=>{
  const guard=createImportRequestGuard(),a=guard.begin();guard.invalidate();
  assert.equal(guard.isCurrent(a),false);assert.equal(guard.isCurrent(null),false);
  guard.invalidate();assert.equal(guard.isCurrent(a),false);
});
test('invalidation never revives an older token when another request begins',()=>{
  const guard=createImportRequestGuard(),a=guard.begin();guard.invalidate();const b=guard.begin();
  assert.equal(guard.isCurrent(a),false);assert.equal(guard.isCurrent(b),true);
});
test('a file chooser cancel with no begin call leaves an existing request eligible',()=>{
  const guard=createImportRequestGuard(),a=guard.begin();
  // The caller has no file, so it intentionally does not start or invalidate a request.
  assert.ok(guard.isCurrent(a));assert.ok(guard.isCurrent(a));
});
test('guard instances do not share or accept each other’s tokens',()=>{
  const one=createImportRequestGuard(),two=createImportRequestGuard(),a=one.begin(),b=two.begin();
  assert.equal(one.isCurrent(b),false);assert.equal(two.isCurrent(a),false);
  one.invalidate();assert.equal(two.isCurrent(b),true);
});
test('methods can be destructured without losing request ownership',()=>{
  const {begin,isCurrent,invalidate}=createImportRequestGuard();const token=begin();
  assert.ok(isCurrent(token));invalidate();assert.equal(isCurrent(token),false);
});
test('out-of-order promises can discard stale successful reads and read failures',async()=>{
  const guard=createImportRequestGuard(),events=[];let releaseA,rejectC;
  const a=guard.begin(),pendingA=new Promise(resolve=>{releaseA=resolve;}).then(value=>{if(guard.isCurrent(a))events.push(value);});
  const b=guard.begin();if(guard.isCurrent(b))events.push('B');releaseA('A');await pendingA;
  const c=guard.begin(),pendingC=new Promise((_,reject)=>{rejectC=reject;}).catch(()=>{if(guard.isCurrent(c))events.push('C error');});
  guard.invalidate();rejectC(new Error('delayed read failure'));await pendingC;
  assert.deepEqual(events,['B']);
});
