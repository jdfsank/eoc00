import {getTrainingAuthorizationStatus,validTrainingAuthorizationOrigin} from './training-authorization.js';

// A still life of issued records, not a picture of named people working today.
// Read only public, settled provenance. Drafts, flags and hidden rolls are not
// evidence of a signed mandate or a new teaching institution.
const rows=s=>[...(s.history||[]),...(s.events||[])];
const unique=(s,id)=>{const found=rows(s).filter(r=>r.id===id);return found.length===1?found[0]:null;};
const reality=r=>r&&(r.reality===undefined||r.reality==='R1');
const condition=i=>!i||typeof i.active!=='boolean'||!Number.isFinite(i.maintenance)||i.maintenance<0||i.maintenance>1?'unknown':i.active&&i.maintenance>0?'active':'stopped';
const originalKeys=['id','kind','cellId','startYear','sourceActionId','sourceEventId'];
function originalTraining(s){
 const found=(s.institutions||[]).filter(i=>i.kind==='training'&&i.cellId==='E4');
 if(found.length!==1)return null;
 const target=Object.fromEntries(originalKeys.map(k=>[k,found[0][k]]));
 return validTrainingAuthorizationOrigin(s,target)?found[0]:null;
}
function networkRecords(s){
 const records=[];
 for(const e of s.events||[]){
  if(e.actionId!=='train_network'||e.cellId!=='E4')continue;
  const action=unique(s,e.sourceActionId),outcome=unique(s,`resolved:${e.id}`),actorId=e.sourceActionId?.split(':')[2];
  if(!action||!outcome||unique(s,e.id)!==e||e.kind!=='event'||e.status!=='success'||![21,31].includes(e.year)||e.resolvedYear!==e.year||e.year>s.year||e.parentId!==action.id||e.id!==`event:${action.id}`)continue;
  if(action.id!==`action:${e.year-1}:${actorId}:E4:train_network`||action.kind!=='action'||action.status!=='confirmed'||action.year!==e.year-1||action.cellId!=='E4'||action.sourceActionId!==action.id||action.parentId!==null)continue;
  if(!reality(action)||!reality(e)||!reality(outcome)||outcome.kind!=='outcome'||outcome.status!=='success'||outcome.parentId!==e.id||outcome.sourceActionId!==action.id||outcome.cellId!=='E4'||outcome.year!==e.year)continue;
  if([action,e,outcome].some(r=>r.actorId!==undefined&&r.actorId!==actorId)||[action,outcome].some(r=>r.actionId!==undefined&&r.actionId!=='train_network'))continue;
  if((s.actors||[]).filter(a=>a.id===actorId&&a.availableFrom<=action.year).length!==1)continue;
  const matches=(s.institutions||[]).filter(i=>i.sourceEventId===e.id&&i.sourceActionId===action.id&&i.kind==='school'&&i.cellId==='E4'&&i.startYear===e.year);
  records.push({year:e.year,sourceIds:[action.id,outcome.id],condition:matches.length===1?condition(matches[0]):'unknown'});
 }
 return records;
}
export function getEndingArt(s){
 if(s?.year!==40||s.phase!=='ended')return null;
 const authorization=getTrainingAuthorizationStatus(s),original=originalTraining(s),networks=networkRecords(s);
 const signed=authorization.status==='authorized',network=networks.length>0;
 const networkMentioned=rows(s).some(r=>r.actionId==='train_network'||r.id?.endsWith(':train_network'))||(s.institutions||[]).some(i=>i.kind==='school'&&i.cellId==='E4'&&i.sourceActionId?.endsWith(':train_network'));
 const networkUnknown=networkMentioned&&!network;
 const activeNetwork=networks.some(n=>n.condition==='active'),stoppedNetwork=network&&networks.every(n=>n.condition==='stopped');
 const originalCondition=condition(original);
 let motif='recorded',caption='四十年的已存记录留在这里。未记录的生活，不由末页代写。',facts='一本摊开的旧账册与河岸纸页，没有新增教学器具或签署标记。',sourceIds=[];
 if(signed&&network){motif='both';caption='原学徒的授权页与另行建立的培训记录都在，没有互相替代。';facts='左侧归档授权页有折角与签记，右侧另一册教学记录与便携工具分开放置。';sourceIds=[...authorization.sourceIds,...networks.flatMap(n=>n.sourceIds)];}
 else if(signed){
  motif=originalCondition==='stopped'?'authorized-stopped':'authorized';
  caption=originalCondition==='active'?'第31年，原东岸学徒取得地方承接权；没有另建学校。':originalCondition==='stopped'?'授权页仍在，原培训点已停运；过去的签署不等于今天仍能承接。':'授权记录仍在；原培训点的当前运转状态不能从签署页推定。';
  facts='旧水尺旁是折角、装订并留有签记的授权页，不新增课堂或学员。'+(originalCondition==='stopped'?'水尺与记录工具用束带收起，区别历史授权与当前停运。':'');sourceIds=authorization.sourceIds;
 }
 else if(network){
  motif=stoppedNetwork?'network-stopped':'network';
  caption=activeNetwork?'新培训已经兑现，教学器具另置一席；原有记录没有被覆盖。':stoppedNetwork?'新培训曾经兑现；如今教学载体停运，器具收起，历史仍保留。':'新培训的兑现页仍在；当前教学状态未核实，不借旧记录宣称运行。';
  facts='旧账册旁另放便携记录桌、成组的读尺工具与独立教学册，不画具名教师。'+(stoppedNetwork?'便携工具束起，记录册扣合，表示已知停运。':'');sourceIds=networks.flatMap(n=>n.sourceIds);
 }
 else if(authorization.status==='cancelled'){motif='cancelled';caption='协商合同已取消，卷起的原件留存，没有新增授权。';facts='协商页卷起并用交叉束带收好，没有签署记号；不是焚毁、灾难或人物拒绝的证据。';sourceIds=authorization.sourceIds;}
 else if(networkUnknown||authorization.status==='unknown'||authorization.status==='pending'){motif='unknown';caption=networkUnknown?'培训记录未核实。缺页不等于失败，也不补画已经兑现的工作。':'承接记录未核实。缺页不等于失败，也不替任何人补写签名。';facts='未展开的套页带有虚线缺口，不画已签署、被拒绝或停办。';}
 else if(original&&!original.handoffAuthorization&&!original.localHandoffAuthorization){motif=originalCondition==='active'?'unwritten':'recorded';caption=originalCondition==='active'?'原学徒的工具仍在，未见已兑现的地方承接授权页。':'原培训记录仍在，没有补写新的承接签名。';facts=originalCondition==='active'?'磨损水尺与旧册保留，右侧议事纸页留白；未签署不等于居民拒绝，也不代表培训停止。':facts;sourceIds=[`resolved:${original.sourceEventId}`];}
 if(signed&&network){
  const current=[originalCondition==='stopped'?'原培训点已停运':originalCondition==='unknown'?'原培训状态未核实':null,stoppedNetwork?'后来教学载体已停运':!activeNetwork?'后来教学状态未核实':null].filter(Boolean);
  if(current.length)caption+=` ${current.join('；')}。`;
 }
 return {motif,file:`ending-${motif}.svg`,caption,alt:`书页接向河岸的结局静物示意。${facts}画中没有人物，不表示实际人数、建筑数量或当前任职；当前服务以现场记录为准。`,sourceIds:[...new Set(sourceIds)]};
}
