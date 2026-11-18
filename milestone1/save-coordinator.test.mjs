import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveCoordinator} from './save-coordinator.js';
function fixture(overrides={}) {
  let disk='old', writes=0, readFault=false, writeFault=false, readbackFault=false;
  const timers=new Map();let next=0;
  const clock={setTimeout(fn){timers.set(++next,fn);return next;},clearTimeout(id){timers.delete(id);}};
  const calls=[];
  const acquire=(name,options,fn)=>new Promise((resolve,reject)=>calls.push({name,options,fn,resolve,reject}));
  const read=()=>{if(readFault||readbackFault&&writes)throw Error('unavailable');return disk;};
  const write=value=>{if(writeFault)throw Error('quota');writes++;disk=value;};
  const api=createSaveCoordinator({initialRaw:'old',read,write,acquire,clock,timeoutMs:10,...overrides});
  return {api,calls,timers,get disk(){return disk;},set disk(v){disk=v;},get writes(){return writes;},set readFault(v){readFault=v;},set writeFault(v){writeFault=v;},set readbackFault(v){readbackFault=v;},grant(i=0){calls[i].fn();calls[i].resolve();},tick(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};
}
test('success is byte exact, ordered, and tied to each request',async()=>{
 const f=fixture();const a=f.api.save('A'),b=f.api.save('B');assert.equal(f.calls.length,1);f.grant();assert.equal((await a).ok,true);assert.equal(f.disk,'A');f.grant(1);assert.equal((await b).ok,true);assert.equal(f.disk,'B');assert.equal(f.writes,2);assert.equal(f.api.snapshot().pending,0);assert.equal(f.timers.size,0);
});
test('cooperating instances compare shared original bytes inside lock',async()=>{
 const f=fixture();const other=createSaveCoordinator({initialRaw:'old',read:()=>f.disk,write:v=>{f.disk=v;},acquire:(n,o,cb)=>Promise.resolve(cb())});
 const pending=f.api.save('A');assert.equal((await other.save('B')).ok,true);f.grant();assert.equal((await pending).reason,'conflict');assert.equal(f.disk,'B');assert.equal(f.writes,0);assert.equal((await f.api.save('C')).reason,'conflict');
});
test('comparison is raw bytes, not equivalent parsed data',async()=>{const f=fixture();f.disk=' old';const p=f.api.save('new');f.grant();assert.equal((await p).reason,'conflict');assert.equal(f.writes,0);});
test('own and delayed event notifications re-read current bytes',async()=>{const f=fixture();const p=f.api.save('A');f.grant();await p;assert.deepEqual(f.api.observeExternal('stale payload'),{ok:true});assert.equal(f.api.snapshot().conflicted,false);});
for(const external of ['external',null]) test(`external ${external} cancels all and conflict is sticky`,async()=>{const f=fixture();const a=f.api.save('A'),b=f.api.save('B');f.disk=external;assert.equal(f.api.observeExternal().reason,'conflict');assert.equal((await a).reason,'conflict');assert.equal((await b).reason,'conflict');f.grant();assert.equal(f.writes,0);f.disk='old';assert.equal((await f.api.save('C')).reason,'conflict');});
test('timeout invalidates late lock callback, following request can succeed',async()=>{const f=fixture();const a=f.api.save('A');f.tick();assert.equal((await a).reason,'timeout');const b=f.api.save('B');f.grant(0);assert.equal(f.writes,0);f.grant(1);assert.equal((await b).ok,true);assert.equal(f.disk,'B');});
test('cancel invalidates before synchronous abort delivery, cancels queue, allows retry',async()=>{const f=fixture();const a=f.api.save('A'),b=f.api.save('B');f.calls[0].options.signal.addEventListener('abort',()=>f.calls[0].fn());f.api.cancelPending();assert.equal((await a).reason,'cancelled');assert.equal((await b).reason,'cancelled');f.grant();assert.equal(f.writes,0);f.api.cancelPending();const c=f.api.save('C');f.grant(1);assert.equal((await c).ok,true);});
test('close is permanent and safe against late callbacks and repeated close',async()=>{const f=fixture();const a=f.api.save('A');f.api.close();f.api.close();f.grant();assert.equal((await a).reason,'closed');assert.equal((await f.api.save('B')).reason,'closed');assert.equal(f.writes,0);});
test('cancel cannot undo already committed synchronous transaction',async()=>{const f=fixture();const a=f.api.save('A');f.grant();f.api.cancelPending();assert.equal((await a).ok,true);assert.equal(f.disk,'A');});
test('quota failure retains baseline and permits explicit retry',async()=>{const f=fixture();f.writeFault=true;const a=f.api.save('A');f.grant();assert.equal((await a).reason,'write-failed');assert.equal(f.disk,'old');f.writeFault=false;const b=f.api.save('B');f.grant(1);assert.equal((await b).ok,true);});
test('prewrite read failure performs no write and retry revalidates',async()=>{const f=fixture();f.readFault=true;const a=f.api.save('A');f.grant();assert.equal((await a).reason,'read-failed');assert.equal(f.writes,0);f.readFault=false;f.disk='other';const b=f.api.save('B');f.grant(1);assert.equal((await b).reason,'conflict');});
test('readback failure is sticky uncertain, queued saves never run',async()=>{const f=fixture();f.readbackFault=true;const a=f.api.save('A'),b=f.api.save('B');f.grant();assert.equal((await a).reason,'uncertain');assert.equal((await b).reason,'uncertain');assert.equal(f.disk,'A');f.readbackFault=false;assert.equal((await f.api.save('C')).reason,'uncertain');assert.equal(f.writes,1);});
test('readback mismatch preserves external bytes and blocks',async()=>{let disk='old';const f=fixture({read:()=>disk,write:()=>{disk='external';}});const p=f.api.save('A');f.grant();assert.equal((await p).reason,'uncertain');assert.equal(disk,'external');});
test('adapter throwing after mutation is uncertain, never safe retry',async()=>{let disk='old';const f=fixture({read:()=>disk,write:v=>{disk=v;throw Error('late');}});const p=f.api.save('A');f.grant();assert.equal((await p).reason,'uncertain');assert.equal(disk,'A');});
test('external observation read failure blocks conservatively',async()=>{const f=fixture();f.readFault=true;assert.equal(f.api.observeExternal().reason,'uncertain');assert.equal((await f.api.save('A')).reason,'uncertain');});
test('no lock capability is readonly',async()=>{const f=fixture({acquire:undefined});assert.equal((await f.api.save('A')).reason,'unsupported');assert.equal(f.writes,0);});
test('lock rejection and callback omission produce failures, late callback cannot write',async()=>{const f=fixture();const a=f.api.save('A');f.calls[0].reject(Error('denied'));assert.equal((await a).reason,'lock-failed');f.calls[0].fn();assert.equal(f.writes,0);const b=f.api.save('B');f.calls[1].resolve();assert.equal((await b).reason,'lock-no-callback');});
test('fresh instance requires an explicit matching baseline after lifecycle closure',async()=>{const f=fixture();f.api.close();f.disk='new';const next=createSaveCoordinator({initialRaw:'new',read:()=>f.disk,write:v=>{f.disk=v;},acquire:(n,o,fn)=>Promise.resolve(fn())});assert.equal((await next.save('next')).ok,true);assert.equal(f.disk,'next');});
test('legacy unlocked writer remains outside the guarantee',async()=>{const f=fixture();const a=f.api.save('A');f.grant();await a;f.disk='legacy-overwrite';assert.equal(f.disk,'legacy-overwrite');assert.equal(f.api.observeExternal().reason,'conflict');assert.equal(f.disk,'legacy-overwrite');});
test('invalid values and snapshots cannot mutate coordination state',async()=>{const f=fixture();assert.equal((await f.api.save(null)).reason,'invalid-value');assert.throws(()=>{f.api.snapshot().closed=true;},TypeError);assert.equal(f.api.snapshot().closed,false);});
test('timeout invalidates before synchronous abort callback',async()=>{const f=fixture();const a=f.api.save('A');f.calls[0].options.signal.addEventListener('abort',()=>f.calls[0].fn());f.tick();assert.equal((await a).reason,'timeout');assert.equal(f.writes,0);});
test('null initial bytes can create a save but deletion after that conflicts',async()=>{let disk=null;const f=fixture({initialRaw:null,read:()=>disk,write:v=>{disk=v;}});const a=f.api.save('A');f.grant();assert.equal((await a).ok,true);disk=null;assert.equal(f.api.observeExternal().reason,'conflict');});
test('synchronous lock provider failure never writes',async()=>{const f=fixture({acquire:()=>{throw Error('denied');}});assert.equal((await f.api.save('A')).reason,'lock-failed');assert.equal(f.writes,0);});
