import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/legacy-simulation.js';
import * as before from './fixtures/pre-staffing-simulation.js';
import {institutionVisual} from '../src/board-visuals.js';
import {sceneArt} from '../src/scene-art.js';
function at11(api,seed){const s=api.createRun(seed);for(const id of ['build_joint','recruit_risk']){const a=api.getActions(s,'D4','protagonist').find(a=>a.id===id);if(api.usesTradeoffs?.(s))for(const e of a.requireEvidence)api.investigate(s,'protagonist','D4',e);api.lockTask(s,'protagonist','D4',id,a.requireEvidence);api.commitWindow(s);if(id==='build_joint')api.advanceToNextWindow(s);else api.advanceYear(s);}return s;}
for(const [name,api,archiveGap] of [['original',old,false],['current',sim,true],['untagged-coverage',before,true]])test(`${name}: map and actual staffing use same policy without changing original roles`,()=>{const s=at11(api,6),snapshot=structuredClone(s),archive=s.institutions.find(i=>i.kind==='archive');assert.equal(institutionVisual(s,'D4').staffingGap,archiveGap);assert.equal(sim.getInstitutionStaffing(s,archive).outputReducedNow,archiveGap);assert.equal(sim.recruitmentRolesAtDeparture(s,s.events.find(e=>e.actionId==='recruit_risk')).some(i=>i.id===archive.id),true);assert.deepEqual(s,snapshot);});
for(const [name,api] of [['original',old],['current',sim],['untagged-coverage',before]])test(`${name}: operating station missing-duty art follows actual shared rule`,()=>{const s=at11(api,0);assert.equal(institutionVisual(s,'D4').staffingGap,true);assert.equal(sceneArt(s,'D4').file,'river-station-understaffed.svg');s.institutions.find(i=>i.kind==='station').active=false;assert.equal(institutionVisual(s,'D4').staffingGap,false);assert.equal(sceneArt(s,'D4').file,'river-station-stopped.svg');});
test('original archive explicit current policy changes only presentation of mechanical vacancy',()=>{const s=at11(old,6),before=structuredClone(s);s.staffingRulesVersion='river-carriers-v1';assert.equal(institutionVisual(s,'D4').staffingGap,true);delete s.staffingRulesVersion;assert.deepEqual(s,before);});
