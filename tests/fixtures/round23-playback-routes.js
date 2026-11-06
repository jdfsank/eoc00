// Natural witnesses only. All world changes go through the supplied real engine.
// Genuine producer identities and hashes remain in their existing manifests.
import assert from 'node:assert/strict';
export const ROUTES = {
  success: { seed: 0, tasks: {
    0: [['protagonist','D4','build_joint']],
    10: [['protagonist','D4','recruit_successor']],
    20: [['protagonist','B4','independent_review'],['linche','D4','free_warning']],
    30: [['protagonist','D4','share_power'],['linche','E4','authorize_training']],
  } },
  'failure-cancellation': { seed: 6, tasks: {
    0: [], 10: [['protagonist','D4','recruit_volunteer']],
    20: [['protagonist','B4','independent_review'],['linche','D4','free_warning']],
    30: [['protagonist','D4','central_review'],['linche','B4','complete_review']],
  } },
  maintenance: { seed: 0, tasks: {
    0: [['protagonist','D4','build_joint']],
    10: [['protagonist','D4','recruit_risk']],
    20: [['protagonist','B4','local_veto']],
    30: [['protagonist','D4','withdraw']],
  } },
};
export function lock(api, state, actor, cell, id) {
  const action=api.getActions(state,cell,actor).find(a=>a.id===id);
  assert.ok(action,`Natural action ${state.year}/${actor}/${cell}/${id}`);
  for(const evidence of action.requireEvidence)if(!api.getInvestigation(state,actor,cell).evidence.includes(evidence))api.investigate(state,actor,cell,evidence);
  api.lockTask(state,actor,cell,id,action.requireEvidence);
}
export function commit(api,state) {
  for(const actor of api.getActors(state))if(!state.drafts[actor.id])api.passTask(state,actor.id);
  api.commitWindow(state);
}
export function makeRoute(api,name) {
  const route=ROUTES[name],state=api.createRun(route.seed),years={0:structuredClone(state)},committed={};
  for(const year of [0,10,20,30]) {
    assert.equal(state.year,year);
    for(const task of route.tasks[year])lock(api,state,...task);
    commit(api,state);committed[year]=structuredClone(state);
    while(state.phase==='playback'){api.advanceYear(state);years[state.year]=structuredClone(state);}
  }
  assert.equal(state.year,40);
  if(name==='success')assert.equal(state.events.find(e=>e.actionId==='independent_review').status,'success');
  if(name==='failure-cancellation') {
    assert.equal(state.events.find(e=>e.actionId==='independent_review').status,'failed');
    assert.equal(state.events.find(e=>e.actionId==='complete_review').status,'cancelled');
    assert.ok(state.flags.crisis.damage>0);
  }
  if(name==='maintenance')assert.ok(state.history.some(h=>h.id==='station-unattended'&&h.year===16));
  return {name,seed:route.seed,tasks:route.tasks,years,committed,ended:structuredClone(state)};
}
// Independent stopping oracle: an actual new historical outcome or milestone.
// No future event, seed, probability, snapshot or UI implementation is inspected.
export function importantHistory(state,afterYear) {
  return state.history.filter(h=>h.year>afterYear&&h.year<=state.year&&['outcome','failure','cancelled','warning','maintenance','crisis','reality','choice','ending'].includes(h.kind));
}
export function nextRecordedYear(api,state) {
  const before=state.year;
  do {api.advanceYear(state);} while(state.phase==='playback'&&!importantHistory(state,before).length);
  return state.year;
}
