import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,lockTask,passTask,commitWindow} from '../src/simulation.js';
import {getDraftEditContext} from '../src/draft-edit-context.js';
test('draft revision reads real current frozen arrangement without mutation',()=>{
 const s=createRun(0);assert.equal(getDraftEditContext(s,'protagonist'),null);
 lockTask(s,'protagonist','D4','build_merchant',[]);const before=JSON.stringify(s);
 assert.deepEqual(getDraftEditContext(s,'protagonist'),{actorId:'protagonist',actorName:'主角',cellId:'D4',title:'商会独资',status:'locked'});assert.equal(JSON.stringify(s),before);
});
test('passed arrangement is not a contract; invalid contexts fail closed',()=>{
 const s=createRun(0);passTask(s,'protagonist');assert.equal(getDraftEditContext(s,'protagonist').status,'passed');assert.equal(getDraftEditContext(s,'linche'),null);
 for(const change of [{window:10},{actorId:'linche'},{status:'unknown'}]){const bad=structuredClone(s);Object.assign(bad.drafts.protagonist,change);assert.equal(getDraftEditContext(bad,'protagonist'),null);}
 commitWindow(s);assert.equal(getDraftEditContext(s,'protagonist'),null);assert.equal(getDraftEditContext(null,'protagonist'),null);
});
