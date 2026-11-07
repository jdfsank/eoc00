import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {performance} from 'node:perf_hooks';
import {observeReloadEvents,collectReloadDiagnostic,reloadWithDiagnostic} from '../scripts/helpers/reload-diagnostic.mjs';

test('reload diagnostics call the operation once and do not inspect a successful DOM',async()=>{
 let invocations=0,observations=0;const result={original:true},records=[];
 const page={evaluate(){observations++;throw Error('Must not inspect success');}};
 assert.equal(await reloadWithDiagnostic(page,async()=>{invocations++;return result;},records,{label:'partial'}),result);
 assert.equal(invocations,1);assert.equal(observations,0);assert.equal(records.length,1);assert.equal(records[0].status,'completed');assert.equal(records[0].diagnostic,undefined);
});

test('reload failure preserves the original rejection identity and invokes no retry',async()=>{
 let invocations=0,observations=0;const original=Object.assign(new Error('Original canvas timeout'),{code:'ORIGINAL_TIMEOUT'}),records=[];
 const page={async evaluate(){observations++;return {status:'observed',hasAfterwave:false};}};
 await assert.rejects(reloadWithDiagnostic(page,async()=>{invocations++;throw original;},records,{label:'390px partial'}),error=>error===original);
 assert.equal(invocations,1);assert.equal(observations,1);assert.equal(records[0].status,'failed');assert.equal(records[0].error.message,original.message);assert.equal(records[0].diagnostic.hasAfterwave,false);
});

test('a diagnostic evaluation failure cannot replace the original rejection',async()=>{
 let invocations=0;const original=new Error('Original reload failure'),records=[];
 const page={async evaluate(){throw Error('Browser already disconnected');}};
 await assert.rejects(reloadWithDiagnostic(page,()=>{invocations++;throw original;},records),error=>error===original);
 assert.equal(invocations,1);assert.equal(records[0].diagnostic.status,'unavailable');assert.match(records[0].diagnostic.reason,/Browser already disconnected/);
});

test('a hung diagnostic has a host deadline and preserves the original rejection',async()=>{
 let invocations=0,observations=0;const original=new Error('Original canvas timeout'),records=[];
 const page={evaluate(){observations++;return new Promise(()=>{});}};
 const started=performance.now();
 await assert.rejects(reloadWithDiagnostic(page,async()=>{invocations++;throw original;},records,{diagnosticOptions:{timeoutMs:25}}),error=>error===original);
 assert.ok(performance.now()-started<1000,'Hung page observation must not hang the test');
 assert.equal(invocations,1);assert.equal(observations,1);assert.equal(records[0].diagnostic.status,'unavailable');assert.equal(records[0].diagnostic.reason,'host deadline 25ms exceeded');
});

test('late diagnostic rejection after the deadline is handled',async()=>{
 let rejectObservation;const page={evaluate(){return new Promise((_,reject)=>{rejectObservation=reject;});}};
 const result=await collectReloadDiagnostic(page,{timeoutMs:5});
 assert.equal(result.status,'unavailable');rejectObservation(Error('Late disconnected page'));
 await new Promise(resolve=>setImmediate(resolve));
});

test('loading observers cover source failures, stay bounded and do not mutate existing errors',()=>{
 const browser=new EventEmitter(),page=new EventEmitter();page.context=()=>({browser:()=>browser});
 const originalErrors=[],{diagnostics,dispose}=observeReloadEvents(page,{maxEvents:3});
 page.emit('requestfailed',{url:()=>'/src/main.js',resourceType:()=> 'script',failure:()=>({errorText:'net::ERR_FAILED'})});
 page.emit('response',{url:()=>'/node_modules/.vite/deps/phaser.js',status:()=>504});
 page.emit('console',{type:()=> 'error',text:()=> 'Failed to load resource',location:()=>({url:'/src/main.js'})});
 assert.deepEqual(diagnostics.events.map(x=>x.event),['requestfailed','http-failure','console']);assert.equal(diagnostics.events[1].status,504);
 page.emit('crash');browser.emit('disconnected');assert.equal(diagnostics.events.length,3);assert.equal(diagnostics.droppedEvents,2);assert.equal(diagnostics.events.at(-1).event,'browser-disconnected');assert.deepEqual(originalErrors,[]);
 dispose();page.emit('close');browser.emit('disconnected');assert.equal(diagnostics.events.length,3);assert.equal(diagnostics.droppedEvents,2);assert.equal(page.listenerCount('requestfailed'),0);assert.equal(browser.listenerCount('disconnected'),0);
});

test('diagnostic listener errors cannot escape or change an operation outcome',()=>{
 const page=new EventEmitter();page.context=()=>({browser:()=>null});const {diagnostics,dispose}=observeReloadEvents(page);
 assert.doesNotThrow(()=>page.emit('requestfailed',{url(){throw Error('Unavailable request');}}));assert.deepEqual(diagnostics.events,[]);dispose();
});
