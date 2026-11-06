import assert from 'node:assert/strict';
export const copy=structuredClone;
export function lock(state,api,actor,cell,id){
 const action=api.getActions(state,cell,actor).find(a=>a.id===id);assert.ok(action,`${state.year}/${actor}/${cell}/${id}`);
 for(const evidence of action.requireEvidence)if(api.investigate&&!api.getInvestigation(state,actor,cell).evidence.includes(evidence))api.investigate(state,actor,cell,evidence);
 api.lockTask(state,actor,cell,id,action.requireEvidence);return action;
}
export function commit(state,api){for(const actor of api.getActors(state))if(!state.drafts[actor.id])api.passTask(state,actor.id);api.commitWindow(state);}
export function next(state,api){commit(state,api);api.advanceToNextWindow(state);return state;}
// Genuine producers generate their own saves. No deleting version fields or
// inventing institutions, evidence, events, outcomes, or per-scene budgets.
export function routes(api,seed=0){
 const state=api.createRun(seed),states={0:copy(state)};
 lock(state,api,'protagonist','D4','build_joint');next(state,api);states[10]=copy(state);
 lock(state,api,'protagonist','D4',api.getActions(state,'D4').some(a=>a.id==='recruit_successor')?'recruit_successor':'recruit_volunteer');next(state,api);states[20]=copy(state);
 lock(state,api,'protagonist','D4','free_warning');lock(state,api,'linche','E4','train_network');next(state,api);states[30]=copy(state);
 return states;
}

export function relocationRoutes(api){
 const result={active:routes(api)[20]};
 for(const [branch,build,recruit]of [['none',null,'recruit_volunteer'],['stopped','build_joint','recruit_risk']]){const s=api.createRun(0);if(build)lock(s,api,'protagonist','D4',build);next(s,api);lock(s,api,'protagonist','D4',recruit);next(s,api);result[branch]=copy(s);}
 return result;
}
