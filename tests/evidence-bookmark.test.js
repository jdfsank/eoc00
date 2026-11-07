import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {createEvidenceBookmark as create,readEvidenceBookmark as read} from '../src/evidence-bookmark.js';
const context={screen:'choice',actorId:'protagonist',cellId:'D4',actionId:'build_joint'};
test('bookmark requires actual valid material-entry context and follows paid evidence without changing world',()=>{
 const s=sim.createRun(12),before=JSON.stringify(s),b=create(s,context,'independent_flood_records');
 assert.ok(b);assert.equal(JSON.stringify(s),before);
 for(const c of [{...context,screen:'avg'},{...context,actionId:'build_state'},{...context,actorId:'ghost'}])assert.equal(create(s,c,'independent_flood_records'),null);
 assert.equal(create(s,context,'resident_testimony'),null);
 const c={...context,screen:'avg'};
 assert.equal(read(b,s,c).missing.length,2);
 sim.investigate(s,'protagonist','D4','independent_flood_records');sim.investigate(s,'protagonist','D4','unfunded_maintenance');
 assert.deepEqual(read(b,s,c).missing,[]);
 assert.equal(create(s,context,'independent_flood_records'),null);
 assert.equal(read(b,structuredClone(s),c),null);
 for(const x of [{...c,actorId:'linche'},{...c,cellId:'B4'},{...c,screen:'settings'}])assert.equal(read(b,s,x),null);
 const clone=structuredClone(s);assert.equal(read({...b,state:clone,year:10},clone,c),null);
 assert.equal(read(null,s,c),null);
});
test('genuine old producer uses only supplied per-scene evidence and does not migrate world',()=>{
 const s=legacy.createRun(12),before=JSON.stringify(s),b=create(s,context,'independent_flood_records',[]);
 assert.ok(b);assert.equal(read(b,s,{...context,screen:'avg'},[]).missing.length,2);
 assert.deepEqual(read(b,s,{...context,screen:'avg'},['independent_flood_records','unfunded_maintenance']).missing,[]);
 assert.equal(JSON.stringify(s),before);
});
