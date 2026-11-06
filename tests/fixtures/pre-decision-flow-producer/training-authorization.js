import {usesTrainingWorkloadRules, trainingWorkloadMarker, supportsTrainingWorkload, makeTrainingWorkload, validTrainingWorkloadContract} from './training-workload.js';
// Public source facts only. These helpers never read a seed, roll, future prose,
// or simulate time. Returned plans/contracts are detached from the saved world.
// Display proves the issued records. Import/settlement separately verify private
// investigation inventory and the contract's fixed probability; reads need neither.
export const TRAINING_AUTHORIZATION_RULES = Object.freeze({version:'training-authorization-v1',actionId:'authorize_training',dueYear:31,cost:Object.freeze({politics:3,economy:2})});
const R=TRAINING_AUTHORIZATION_RULES, keys=['id','kind','cellId','startYear','sourceActionId','sourceEventId'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>object(a)&&object(b)&&keys.every(k=>a[k]===b[k]);
const snapshot=i=>Object.fromEntries(keys.map(k=>[k,i[k]]));
const unique=(s,id)=>[...s.events,...s.history].filter(e=>e.id===id).length===1;
const goodState=s=>object(s)&&[s.events,s.history,s.institutions,s.actors].every(Array.isArray);
const live=i=>i?.active===true&&Number.isFinite(i.maintenance)&&i.maintenance>0&&i.maintenance<=1;
export const usesTrainingAuthorizationRules=s=>s?.trainingAuthorizationRulesVersion===R.version;
export const trainingAuthorizationMarker=e=>object(e)&&(trainingWorkloadMarker(e)||['trainingAuthorizationRulesVersion','trainingAuthorizationTarget','trainingAuthorizationCancellationReason'].some(k=>k in e)||e.actionId===R.actionId||e.sourceActionId?.endsWith(`:${R.actionId}`)||e.id?.endsWith(`:${R.actionId}`));
function consistent(row,actorId,actionId){return !!row&&(row.actorId===undefined||row.actorId===actorId)&&(row.actionId===undefined||row.actionId===actionId)&&(row.reality===undefined||row.reality==='R1');}
// Prove the original year7 E4 training chain, not a same-kind substitute or an
// anonymous school. Current existence/operation is deliberately checked apart.
export function validTrainingAuthorizationOrigin(s,t){
 if(!goodState(s)||!object(t)||Object.keys(t).length!==keys.length||t.kind!=='training'||t.cellId!=='E4'||t.startYear!==7)return false;
 const [prefix,year,actorId,place,build,extra]=(t.sourceActionId||'').split(':');
 if(prefix!=='action'||year!=='0'||actorId!=='protagonist'||place!=='D4'||!['build_joint','build_state','build_merchant'].includes(build)||extra!==undefined)return false;
 const buildId=`event:${t.sourceActionId}`,trainingId=`${buildId}:training`;
 if(t.sourceEventId!==trainingId||t.id!==`institution:${trainingId}:E4`)return false;
 const action=s.history.find(h=>h.id===t.sourceActionId),event=s.events.find(e=>e.id===buildId),built=s.history.find(h=>h.id===`resolved:${buildId}`),training=s.events.find(e=>e.id===trainingId),taught=s.history.find(h=>h.id===`resolved:${trainingId}`);
 const yearBuilt=build==='build_merchant'?2:3, cost=build==='build_merchant'?{economy:3}:build==='build_state'?{politics:3,economy:4}:{economy:6};
 if(s.actors.filter(a=>a.id===actorId&&a.availableFrom===0).length!==1||s.year<7)return false;
 if(action?.kind!=='action'||action.status!=='confirmed'||action.parentId!==null||action.sourceActionId!==action.id||action.year!==0||action.cellId!=='D4'||!object(action.cost)||Object.keys(action.cost).length!==Object.keys(cost).length||!Object.entries(cost).every(([k,v])=>action.cost[k]===v))return false;
 if(!Array.isArray(action.evidence)||new Set(action.evidence).size!==action.evidence.length||(build==='build_joint'&&!['independent_flood_records','unfunded_maintenance'].every(id=>action.evidence.includes(id))))return false;
 if(event?.kind!=='event'||event.status!=='success'||event.actionId!==build||event.parentId!==action.id||event.sourceActionId!==action.id||event.cellId!=='D4'||event.year!==yearBuilt||event.resolvedYear!==yearBuilt||JSON.stringify(event.evidence)!==JSON.stringify(action.evidence))return false;
 if(built?.kind!=='outcome'||built.status!=='success'||built.parentId!==event.id||built.sourceActionId!==action.id||built.cellId!=='D4'||built.year!==yearBuilt)return false;
 if(training?.kind!=='event'||training.actionId!=='training'||training.status!=='success'||training.parentId!==event.id||training.sourceActionId!==action.id||training.cellId!=='E4'||training.year!==7||training.resolvedYear!==7||training.requiresInstitution!==`institution:${event.id}:D4`)return false;
 if(taught?.kind!=='outcome'||taught.status!=='success'||taught.parentId!==training.id||taught.sourceActionId!==action.id||taught.cellId!=='E4'||taught.year!==7)return false;
 return [action,event,built,training,taught].every(row=>unique(s,row.id)&&consistent(row,actorId,[training,taught].includes(row)?'training':build));
}
function oldMandate(s,i){
 if(i.kind==='school')return s.events.some(e=>e.id===i.sourceEventId&&e.sourceActionId===i.sourceActionId&&e.status==='success'&&['fund_school','train_network'].includes(e.actionId));
 const g=i.handoffAuthorization;
 return i.kind==='training'&&object(g)&&g.sourceActionId===i.sourceActionId&&s.events.some(e=>e.id===g.eventId&&e.actionId==='renew_charter'&&e.status==='success'&&e.resolvedYear===g.year&&e.authorizedTrainingSources?.includes(g.sourceActionId));
}
export function trainingAuthorizationMetadata(target,workload){return {trainingAuthorizationRulesVersion:R.version,trainingAuthorizationTarget:snapshot(target),...(workload?{trainingWorkload:structuredClone(workload)}:{})};}
export function makeTrainingAuthorizationGrant(e){return {version:R.version,eventId:e.id,year:31,sourceActionId:e.sourceActionId,targetId:e.trainingAuthorizationTarget.id,...(e.trainingWorkload?{trainingWorkloadVersion:e.trainingWorkload.version}:{})};}
function grantMatches(g,e){const expected=makeTrainingAuthorizationGrant(e);return object(g)&&Object.keys(g).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>g[k]===v);}
function currentTarget(s,t){const all=s.institutions.filter(i=>i.id===t.id);return all.length===1&&same(all[0],t)?all[0]:null;}
export function trainingAuthorizationFailure(s,target){
 if(!validTrainingAuthorizationOrigin(s,target))return 'target-unavailable';
 const i=currentTarget(s,target);
 if(!i||!live(i))return 'target-unavailable';
 if(i.handoffAuthorization!==undefined||i.localHandoffAuthorization!==undefined||s.institutions.some(other=>other.cellId==='E4'&&live(other)&&oldMandate(s,other)))return 'already-authorized';
 return null;
}
export function validTrainingAuthorizationContract(s,e){return verifyContract(s,e,true);}
function verifyContract(s,e,strict=false){
 if(!trainingAuthorizationMarker(e))return true;
 if(!goodState(s)||e.actionId!==R.actionId||!usesTrainingAuthorizationRules(s)||s.planningRulesVersion!=='tradeoffs-v1'||s.handoffRulesVersion!=='handoff-v1')return false;
 const [prefix,year,actorId,place,actionId,extra]=(e.sourceActionId||'').split(':');
 const target=e.trainingAuthorizationTarget,action=s.history.find(h=>h.id===e.sourceActionId),outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
 if(!validTrainingWorkloadContract(s,e,action,outcome,s.institutions.find(i=>i.id===target?.id)))return false;
 if(prefix!=='action'||year!=='30'||place!=='E4'||actionId!==R.actionId||extra!==undefined||s.actors.filter(a=>a.id===actorId&&a.availableFrom<=30).length!==1)return false;
 if(e.kind!=='event'||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.cellId!=='E4'||e.year!==31||(strict&&e.probability!==1)||e.trainingAuthorizationRulesVersion!==R.version||!validTrainingAuthorizationOrigin(s,target))return false;
 if(action?.kind!=='action'||action.status!=='confirmed'||action.parentId!==null||action.sourceActionId!==action.id||action.year!==30||action.cellId!=='E4'||action.reality!=='R1'||action.trainingAuthorizationRulesVersion!==R.version||action.trainingAuthorizationCancellationReason!==undefined||!same(action.trainingAuthorizationTarget,target)||Object.keys(action.trainingAuthorizationTarget).length!==keys.length)return false;
 if(!object(action.cost)||Object.keys(action.cost).length!==2||action.cost.politics!==3||action.cost.economy!==2)return false;
 if(e.planningRulesVersion!=='tradeoffs-v1'||!Array.isArray(e.evidence)||!e.evidence.includes('resident_testimony')||new Set(e.evidence).size!==e.evidence.length||JSON.stringify(e.evidence)!==JSON.stringify(action.evidence))return false;
 if(strict){
 const inventory=s.investigations?.[`30:${actorId}`];
 if(!Array.isArray(inventory)||!inventory.some(i=>i.cellId==='E4'&&i.evidenceId==='resident_testimony')||!e.evidence.every(id=>inventory.some(i=>i.evidenceId===id&&(i.cellId==='E4'||['independent_flood_records','anomaly_records','evacuation_routes','old_reality_record'].includes(id)))))return false;
 }
 if([action,e,...(outcome?[outcome]:[])].some(row=>!unique(s,row.id)||!consistent(row,actorId,R.actionId)))return false;
 if(s.history.filter(h=>h.kind==='action'&&h.id.startsWith(`action:30:${actorId}:`)).length!==1||s.history.some(h=>h.id===`pass:30:${actorId}`)||s.events.filter(row=>row.actionId===R.actionId).length!==1)return false;
 if(s.institutions.some(i=>i.sourceEventId===e.id||i.sourceActionId===e.sourceActionId))return false;
 const grants=s.institutions.filter(i=>i.localHandoffAuthorization?.eventId===e.id);
 if(e.status==='pending')return e.year>s.year&&(!strict||e.resolvedYear===undefined)&&!outcome&&e.trainingAuthorizationCancellationReason===undefined&&!grants.length;
 if(!['success','cancelled'].includes(e.status)||e.year>s.year||e.resolvedYear!==31||outcome?.year!==31||outcome.parentId!==e.id||outcome.sourceActionId!==action.id||outcome.cellId!=='E4'||outcome.reality!=='R1'||outcome.status!==e.status||outcome.kind!==(e.status==='success'?'outcome':'cancelled')||outcome.trainingAuthorizationRulesVersion!==R.version||!same(outcome.trainingAuthorizationTarget,target)||Object.keys(outcome.trainingAuthorizationTarget).length!==keys.length)return false;
 if(e.status==='cancelled')return ['target-unavailable','already-authorized'].includes(e.trainingAuthorizationCancellationReason)&&outcome.trainingAuthorizationCancellationReason===e.trainingAuthorizationCancellationReason&&!grants.length&&(s.year!==31||trainingAuthorizationFailure(s,target)===e.trainingAuthorizationCancellationReason);
 const i=currentTarget(s,target);
 return e.trainingAuthorizationCancellationReason===undefined&&outcome.trainingAuthorizationCancellationReason===undefined&&grants.length===1&&grants[0]===i&&grantMatches(i.localHandoffAuthorization,e)&&i.handoffAuthorization===undefined&&(s.year!==31||live(i));
}
export function hasTrainingAuthorization(s,i,{strict=true}={}){
 const grant=i?.localHandoffAuthorization;
 if(!object(grant)||!goodState(s))return false;
 const e=s.events.find(e=>e.id===grant.eventId);
 return !!e&&e.actionId===R.actionId&&e.status==='success'&&e.trainingAuthorizationTarget?.id===i.id&&grantMatches(grant,e)&&verifyContract(s,e,strict);
}
export function getTrainingAuthorizationContracts(s){
 if(!goodState(s)||!usesTrainingAuthorizationRules(s))return [];
 return s.events.filter(e=>e.actionId===R.actionId&&verifyContract(s,e)).map(e=>({actionId:e.actionId,status:e.status,cellId:'E4',year:31,eventId:e.id,sourceActionId:e.sourceActionId,recordId:e.status==='pending'?null:`resolved:${e.id}`,target:snapshot(e.trainingAuthorizationTarget),cancellationReason:e.trainingAuthorizationCancellationReason||null,...(e.trainingWorkload?{workload:structuredClone(e.trainingWorkload)}:{})}));
}
export function getTrainingAuthorizationPlan(s,cellId='E4'){
 const enabled=usesTrainingAuthorizationRules(s)&&s.planningRulesVersion==='tradeoffs-v1'&&s.handoffRulesVersion==='handoff-v1';
 const result=(available,reason,target=null)=>({enabled,available,reason,target:target?snapshot(target):null});
 if(s?.trainingWorkloadRulesVersion!==undefined&&!usesTrainingWorkloadRules(s))return result(false,'学徒轮值分工规则版本未知，不能据此提供协商合同。');
 if(!enabled)return result(false,'本局保留原合同，不补发地方承接协商。');
 if(!goodState(s)||cellId!=='E4'||s.year!==30||s.phase!=='planning')return result(false,'承接协商只在第30年东岸安排。');
 if([...s.history,...s.events].some(trainingAuthorizationMarker))return result(false,'本轮承接协商已经提交，不重复收费。');
 if(s.institutions.some(i=>i.cellId==='E4'&&live(i)&&(oldMandate(s,i)||hasTrainingAuthorization(s,i,{strict:false}))))return result(false,'东岸已有实际地方承接授权，无需重复协商。');
 const candidates=s.institutions.filter(i=>i.cellId==='E4'&&i.kind==='training');
 if(candidates.length!==1)return result(false,'东岸原学徒来源缺失或不唯一，不能替不存在或不明的人员签署。');
 const target=snapshot(candidates[0]);
 if(trainingAuthorizationFailure(s,target))return result(false,'原学徒必须仍在运转且来源明确，已有授权或缺失资料不能重签。');
 if(usesTrainingWorkloadRules(s)){
  if(!supportsTrainingWorkload(candidates[0]))return result(false,'原培训点使用自定义年度来源，无法套用这份固定轮值分工；保留当前运作，也可另选新增培训。');
  return {...result(true,'原学徒承接本地职责后，将大部分深入带教时间转入议事与生计协调；不新增人手、预警覆盖、异源校验或河港信任。',target),workload:makeTrainingWorkload(candidates[0])};
 }
 return result(true,'协商只赋予原东岸学徒本地承接权，不新建学校、不增加人手、产出、校验或河港信任。',target);
}
export function getTrainingAuthorizationStatus(s,cellId='E4'){
 const plan=getTrainingAuthorizationPlan(s,cellId),base={...plan,status:plan.available?'available':'unavailable',contracts:[],sourceIds:[]};
 if(cellId!=='E4'||!goodState(s))return base;
 const mentioned=[...s.events,...s.history].some(trainingAuthorizationMarker)||s.institutions.some(i=>i.localHandoffAuthorization!==undefined);
 const contracts=getTrainingAuthorizationContracts(s);
 if(mentioned&&contracts.length!==1)return {...base,status:'unknown',reason:'承接协商的行动、目标或兑现来源缺失或不一致，不能补写授权。'};
 if(!contracts.length)return base;
 const c=contracts[0];
 return {...base,status:c.status==='success'?'authorized':c.status,contracts,target:{...c.target},sourceIds:[`resolved:${c.target.sourceEventId}`,c.sourceActionId,...(c.recordId?[c.recordId]:[])]};
}
