import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {captureWithDiagnostic,collectScreenshotDiagnostic} from '../scripts/helpers/screenshot-diagnostic.mjs';

test('successful capture forwards exact options/result without renderer observation',async()=>{
  const records=[],options={path:'unchanged.png'},result=Buffer.from('png');let calls=0;
  const page={screenshot:async actual=>{calls++;assert.equal(actual,options);return result},evaluate:()=>assert.fail('no success-path observation')};
  assert.equal(await captureWithDiagnostic(page,options,records,{label:'390-200-selected-role'}),result);
  assert.equal(calls,1);assert.equal(records[0].status,'captured');assert.ok(records[0].captureElapsedMs>=0);
});
for(const name of ['Error','TimeoutError'])test(`${name} remains the same rejection, never a pass or retry`,async()=>{
  const original=new Error('injected screenshot failure');original.name=name;
  const records=[];let calls=0;
  const page={screenshot:async()=>{calls++;await new Promise(r=>setTimeout(r,5));throw original},evaluate:async()=>({status:'observed'})};
  await assert.rejects(captureWithDiagnostic(page,{path:'required.png'},records,{label:'required'}),e=>e===original);
  assert.equal(calls,1);assert.equal(records.length,1);assert.equal(records[0].status,'failed');assert.equal(records[0].error.stack,original.stack);assert.ok(records[0].captureElapsedMs>=0);
});
test('hung and rejecting renderer diagnostics are bounded and cannot hide capture failure',async()=>{
  const original=new Error('original');const records=[];const start=performance.now();
  await assert.rejects(captureWithDiagnostic({screenshot:async()=>{throw original},evaluate:()=>new Promise(()=>{})},{path:'required.png'},records,{diagnosticOptions:{timeoutMs:25}}),e=>e===original);
  assert.equal(records[0].diagnostic.status,'unavailable');assert.match(records[0].diagnostic.reason,/host deadline 25ms/);assert.ok(performance.now()-start<1000);
  assert.match((await collectScreenshotDiagnostic({evaluate:async()=>{throw new Error('closed')}})).reason,/closed/);
  assert.match((await collectScreenshotDiagnostic({evaluate:()=>{throw new Error('sync closed')}})).reason,/sync closed/);
});
test('uncaught injected screenshot timeout exits nonzero',()=>{
  const code=`import {captureWithDiagnostic} from './scripts/helpers/screenshot-diagnostic.mjs'; const error=new Error('injected 12000ms screenshot timeout'); error.name='TimeoutError'; await captureWithDiagnostic({screenshot:async()=>{throw error},evaluate:async()=>({status:'observed'})},{path:'not-written.png'},[]);`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:2000});
  assert.equal(child.status,1);assert.match(child.stderr,/TimeoutError.*injected 12000ms screenshot timeout/);
});
test('each attempt is fresh and a later supplemental image cannot replace failure',async()=>{
  const records=[],original=new Error('required failed');let calls=0;
  const page={screenshot:async()=>{calls++;if(calls===1)throw original;return Buffer.from('supplemental')},evaluate:async()=>({status:'observed'})};
  await assert.rejects(captureWithDiagnostic(page,{path:'required.png'},records,{label:'required'}),e=>e===original);
  await captureWithDiagnostic(page,{path:'failure.png'},records,{label:'post-failure-diagnostic-only',purpose:'supplemental-not-a-retry-or-pass'});
  assert.equal(calls,2);assert.equal(records.length,2);assert.notEqual(records[0],records[1]);
  assert.equal(records[0].status,'failed');assert.equal(records[0].error.message,original.message);
  assert.equal(records[0].purpose,'required');assert.equal(records[1].purpose,'supplemental-not-a-retry-or-pass');
  assert.equal(records[1].diagnostic,undefined);assert.equal(records[1].error,undefined);
});
