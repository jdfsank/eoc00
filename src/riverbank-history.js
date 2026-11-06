import {getInstitutionStaffing,getTrainingAuthorizationStatus} from './simulation.js';
import {getFeeHistory} from './fee-history.js';
import {getRelocationHistory, getRelocationDestination} from './relocation-history.js';
import {getLocalCrisisRecord} from './local-crisis-record.js';
import {getCrisisHistory} from './crisis-history.js';

// Return visits read what was paid, what actually resolved, and what remains
// today. They are not a second investigation or a replay of planning dialogue.
const CONTRACTS = {
 build_merchant:{cell:'D4',years:[0],delay:2,cost:{economy:3},title:'商会建站'},
 build_state:{cell:'D4',years:[0],delay:3,cost:{politics:3,economy:4},title:'官署建站'},
 build_joint:{cell:'D4',years:[0],delay:3,cost:{economy:6},evidence:['independent_flood_records','unfunded_maintenance'],title:'联合建站'},
 restore_archive:{cell:'D4',years:[10],delay:2,cost:{economy:5},title:'重建地方测站'},
 renew_charter:{cell:'D4',years:[10],delay:1,cost:{economy:3},title:'续约公开章程'},
 recruit_successor:{cell:'D4',years:[10],delay:1,cost:{economy:5,science:2},evidence:['successor_consent'],title:'邀请林澈并安排继任'},
 recruit_risk:{cell:'D4',years:[10],delay:1,cost:{economy:1},title:'邀请林澈，暂缺继任'},
 recruit_volunteer:{cell:'D4',years:[10],delay:1,cost:{economy:1},title:'邀请林澈自愿同行'},
 free_warning:{cell:'D4',years:[20],delay:1,cost:{economy:4},evidence:['resident_testimony'],title:'河港基本预警'},
 present_archive:{cell:'D4',years:[20],delay:1,cost:{politics:2},evidence:['old_reality_record'],title:'尊重当前的选择'},
 relocate_teacher:{cell:'D4',years:[20],delay:1,cost:{politics:3},title:'执行迁任'},
 share_power:{cell:'D4',years:[30],delay:1,cost:{politics:3,economy:3},title:'共享档案与纠错权'},
 central_review:{cell:'D4',years:[30],delay:1,cost:{politics:4,science:2},title:'集中协调'},
 withdraw:{cell:'D4',years:[30],delay:1,cost:{economy:2},title:'逐步退出独占控制'},
 fund_school:{cell:'E4',years:[10],delay:1,cost:{economy:4},title:'资助东岸夜校'},
 train_network:{cell:'E4',years:[20,30],delay:1,cost:{economy:4,science:2},title:'培育轮值维护者'},
};
const BUILDS=['build_merchant','build_state','build_joint'];
const RECRUIT=['recruit_successor','recruit_risk','recruit_volunteer'];
const KIND={station:'河港测站',archive:'河港档案站',warning:'居民传讯队',training:'东岸学徒培训点',school:'东岸教学载体'};
const same=(r,k,v)=>r[k]===undefined||r[k]===v;
const dated=(r,year)=>Number.isInteger(r?.year)&&r.year>=0&&r.year<=year;
const unique=(items,id)=>{const found=items.filter(r=>r?.id===id);return found.length===1?found[0]:null;};
const activity=i=>typeof i.active!=='boolean'||!Number.isFinite(i.maintenance)||i.maintenance<0||i.maintenance>1
 ? 'unknown':i.active&&i.maintenance>0?'active':'stopped';
const currentText=i=>activity(i)==='unknown'?'当前运转情况未知'
 :activity(i)==='stopped'?'当前停运，原址与旧记录保留'
 :`当前运行中${i.maintenance<1?'，维护不足':''}`;

function readSources(state){
 const history=state.history,events=state.events,institutions=state.institutions,actors=state.actors||[],rows=[...history,...events];
 const one=id=>unique(rows,id);
 function actionFor(e){
  const rule=Object.hasOwn(CONTRACTS,e?.actionId)?CONTRACTS[e.actionId]:null;
  if(!rule||unique(events,e.id)!==e||one(e.id)!==e||e.kind!=='event'||e.cellId!==rule.cell||!same(e,'reality','R1'))return null;
  if(typeof e.sourceActionId!=='string')return null;
  const a=one(e.sourceActionId),parts=(e.sourceActionId||'').split(':'),[prefix,y,actorId,cellId,actionId]=parts,year=Number(y);
  const actor=unique(actors,actorId);
  if(parts.length!==5||prefix!=='action'||String(year)!==y||!rule.years.includes(year)||year>state.year
   ||cellId!==rule.cell||actionId!==e.actionId||!['protagonist','linche'].includes(actorId)
   ||year<20&&actorId!=='protagonist'||!actor||!Number.isInteger(actor.availableFrom)||actor.availableFrom>year
   ||!unique(state.cells,cellId)||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==year+rule.delay
   ||!a||!history.includes(a)||a.kind!=='action'||a.status!=='confirmed'||a.reality!=='R1'||a.year!==year||a.cellId!==cellId
   ||a.sourceActionId!==a.id||a.parentId!==null||!Array.isArray(a.evidence)||!(rule.evidence||[]).every(id=>a.evidence.includes(id))
   ||e.evidence!==undefined&&(!Array.isArray(e.evidence)||!(rule.evidence||[]).every(id=>e.evidence.includes(id)))
   ||!a.cost||Object.entries(rule.cost).some(([k,v])=>a.cost[k]!==v)
   ||Object.entries(a.cost).some(([k,v])=>!Number.isFinite(v)||v!==(rule.cost[k]||0))
   ||[a,e].some(r=>!same(r,'actorId',actorId)||!same(r,'actionId',actionId))
   ||history.filter(r=>r.kind==='action'&&typeof r.id==='string'&&r.id.startsWith(`action:${year}:${actorId}:`)).length!==1
   ||history.some(r=>r.id===`pass:${year}:${actorId}`))return null;
  return {action:a,event:e,rule,actorId};
 }
 function resultFor(e){
  const result=one(`resolved:${e.id}`),kind={success:'outcome',failed:'failure',cancelled:'cancelled'}[e.status];
  return kind&&dated(e,state.year)&&e.resolvedYear===e.year&&result&&history.includes(result)
   &&result.kind===kind&&result.status===e.status&&result.year===e.year&&result.cellId===e.cellId
   &&result.parentId===e.id&&result.sourceActionId===e.sourceActionId&&result.reality==='R1'
   &&same(result,'actionId',e.actionId)&&same(result,'actorId',e.sourceActionId?.split(':')[2])?result:null;
 }
 function root(e){
  const source=actionFor(e);if(!source)return null;
  if(e.status==='pending')return e.year>state.year&&e.resolvedYear===undefined&&!rows.some(r=>r.id===`resolved:${e.id}`)
   ?{...source,outcome:null,status:'pending'}:null;
  const outcome=resultFor(e);
  if(!outcome||e.status==='failed'&&!BUILDS.includes(e.actionId)||e.status==='cancelled')return null;
  return {...source,outcome,status:e.status};
 }
 const contracts=events.map(root).filter(Boolean);
 function carrier(i){
  if(unique(institutions,i.id)!==i||!Number.isInteger(i.startYear)||i.startYear>state.year
   ||!same(i,'reality','R1'))return null;
  const e=one(i.sourceEventId);
  if(!e||!events.includes(e)||i.id!==`institution:${e.id}:${i.cellId}`||i.sourceActionId!==e.sourceActionId
   ||i.startYear!==e.year||institutions.filter(other=>other.sourceEventId===e.id&&other.cellId===i.cellId).length!==1)return null;
  if(i.kind==='training'&&i.cellId==='E4'){
   const parent=contracts.find(c=>c.event.id===e.parentId&&c.status==='success'&&BUILDS.includes(c.event.actionId));
   const outcome=resultFor(e);
   if(!parent||e.kind!=='event'||e.actionId!=='training'||e.cellId!=='E4'||e.year!==7
    ||e.id!==`${parent.event.id}:training`||e.sourceActionId!==parent.action.id||e.status!=='success'||!outcome
    ||e.requiresInstitution!==`institution:${parent.event.id}:D4`||!same(e,'reality','R1')
    ||!same(e,'actorId',parent.actorId)||!same(i,'actorId',parent.actorId)||!same(i,'actionId','training'))return null;
   const station=unique(institutions,e.requiresInstitution);
   if(!station||station.kind!=='station'||station.cellId!=='D4'||station.sourceEventId!==parent.event.id
    ||station.sourceActionId!==parent.action.id||station.startYear!==parent.event.year||!carrier(station))return null;
   return {source:parent,event:e,outcome,ids:[parent.action.id,parent.outcome.id,outcome.id]};
  }
  const c=contracts.find(c=>c.event===e&&c.outcome);if(!c)return null;
  const expected=BUILDS.includes(e.actionId)?c.status==='success'?'station':'archive'
   :e.actionId==='restore_archive'?'station':e.actionId==='free_warning'?'warning'
    :['fund_school','train_network','relocate_teacher'].includes(e.actionId)?'school':null;
  const place=e.actionId==='relocate_teacher'?'E4':e.cellId;
  if(i.kind!==expected||i.cellId!==place||!same(i,'actorId',c.actorId)||!same(i,'actionId',e.actionId))return null;
  return {source:c,event:e,outcome:c.outcome,ids:[c.action.id,c.outcome.id]};
 }
 // A displayed destination must remain safe through the existing tracer, not
 // merely have a unique leaf ID. Unknown, future and R0 parents are withheld.
 function safeTrace(id){
  const seen=new Set();let r=one(id),childYear=Infinity;
  if(!r||!history.includes(r))return false;
  while(r){
   if(seen.has(r.id)||!dated(r,state.year)||r.year>childYear||!same(r,'reality','R1')
    ||history.includes(r)&&r.reality!=='R1')return false;
   if(events.includes(r)&&(r.kind!=='event'||!['success','failed','cancelled'].includes(r.status)||r.resolvedYear!==r.year))return false;
   if(r.kind==='action'&&(r.status!=='confirmed'||r.sourceActionId!==r.id||r.parentId!==null))return false;
   if(r.sourceActionId){const a=one(r.sourceActionId);if(!a||a.kind!=='action'||a.status!=='confirmed'||a.year>r.year
    ||!same(r,'actorId',r.sourceActionId.split(':')[2]))return false;}
   if(r.id==='crisis-warning'&&(r.kind!=='warning'||r.year!==14||r.cellId!=='D4'||r.status!=='confirmed'||r.sourceActionId!==null))return false;
   seen.add(r.id);childYear=r.year;if(r.parentId===null)return true;r=one(r.parentId);
  }
  return false;
 }
 return {contracts,carrier,safeTrace,one};
}

export function riverbankHistory(state,cellId,art){
 const reader=readSources(state),{contracts,carrier,safeTrace}=reader;
 const kinds=cellId==='D4'?['station','archive','warning']:['training','school'];
 const local=state.institutions.filter(i=>i.cellId===cellId&&kinds.includes(i.kind)
  &&(!Number.isInteger(i.startYear)||i.startYear<=state.year));
 const summary=[],cards=[];
 const add=(id,title,paragraphs,sourceIds=[],status='recorded')=>cards.push({id,title,paragraphs:paragraphs.filter(Boolean),
  sourceIds:[...new Set(sourceIds)].filter(safeTrace),status});
 const groups=kinds.map(kind=>({kind,items:local.filter(i=>i.kind===kind)})).filter(g=>g.items.length);
 if(!groups.length)summary.push(cellId==='D4'?'河港旧档案室仍是阅读与协商的地方，目前没有已存的测站、档案站或居民传讯队；待办不会提前成为服务。'
  :'东岸仍是开放河岸，目前没有已存的持续教学载体；待办不会提前成为课堂。');
 for(const {kind,items} of groups){
  const live=items.filter(i=>activity(i)==='active'),unknown=items.some(i=>activity(i)==='unknown');
  summary.push(`${KIND[kind]}：${live.length?`${live.length}处运行中${live.some(i=>i.maintenance<1)?'，其中仍有维护缺口':''}`:unknown?'当前运转情况未知':'当前均已停运，原址保留'}。`);
 }
 summary.push(cellId==='D4'?'画面里的建筑、准入与当前维护分开阅读；有记录不等于有预警，有公开告示也不等于每个家庭都已收到消息。'
  :'学徒培训、夜校与后来安排的教学各有来处；有课堂不等于已获得地方承接授权，也不证明已完成异源指令校验。');
 for(const i of local){
  const proof=carrier(i),label=KIND[i.kind],paragraphs=[`${label}：${currentText(i)}。`];
  if(activity(i)==='active'&&i.kind==='station')paragraphs.push(i.open===true?'基本预警现在公开准入；覆盖仍取决于维护和值守。':i.open===false?'基本预警仍有收费门槛；这不是整个测站停运。':'准入情况缺页，不能推定公开或收费。');
  if(activity(i)==='active'&&['station','archive'].includes(i.kind)&&getInstitutionStaffing(state,i).outputReducedNow)paragraphs.push('当前仍有接班人手缺口，不能把亮灯等同于值班已经齐备。');
  if(i.kind==='archive')paragraphs.push('档案保管不是测站、教学或居民传讯；旧纸页没有因此变成预警服务。');
  if(i.kind==='warning')paragraphs.push('这是居民轮值传讯，不是新测站，也不恢复原档案岗位或补回旧培训链。');
  if(proof){
   const action=proof.event.actionId;
   const origin=action==='training'?'第7年，D4原建站链的培训抵达E4；原始建站仍归D4，培训结果仍归E4。'
    :action==='relocate_teacher'?'这处教学载体来自第21年D4迁任合同；学校运转不是苏岚今天仍授课或同意迁任的证明。'
     :action==='fund_school'?`第${proof.event.year}年，东岸夜校的资助合同兑现。`
      :action==='train_network'?`第${proof.event.year}年，新的轮值维护教学安排兑现；新增的是这份教学合同，不是替既有学徒签署承接授权。`
       :action==='restore_archive'?`第${proof.event.year}年，新的维护小组重建测站；没有补回原培训链，也没有指定林澈或苏岚任职。`
        :action==='free_warning'?`第${proof.event.year}年，居民传讯合同兑现；过去的缺岗记录仍保留。`
         :proof.source.status==='failed'?`第${proof.event.year}年，建站未成，留下小型档案站；这不是曾建成又停运的测站。`
          :`第${proof.event.year}年，${proof.source.rule.title}合同兑现，河港测站启用。`;
   paragraphs.push(origin);
   const grant=i.handoffAuthorization,renewal=contracts.find(c=>c.event.actionId==='renew_charter'&&c.status==='success');
   if(i.kind==='training'&&grant&&renewal&&grant.eventId===renewal.event.id&&grant.year===renewal.event.year
    &&grant.sourceActionId===i.sourceActionId&&renewal.event.authorizedTrainingSources?.includes(i.sourceActionId)){
    paragraphs.push(`第${renewal.event.year}年的原章程记录了这批学徒的地方承接授权；这不是今天新增的一份签名，当前是否仍有人工作另看运转状态。`);
    proof.ids.push(renewal.action.id,renewal.outcome.id);
   }
  }else paragraphs.push('当前载体的原始行动、兑现或机构来源缺失或不一致。保留已存形态与状态，来源经过未知，不从名称补写成功或个人任职。');
  add(`carrier:${i.id}`,`${label} · 现在与来处`,paragraphs,proof?.ids||[],proof?'current':'unknown');
 }
 const localContracts=contracts.filter(c=>c.rule.cell===cellId);
 for(const c of localContracts.filter(c=>c.status==='pending'))add(`contract:${c.action.id}`,`${c.rule.title} · 已提交待兑现`,[
  `第${c.action.year}年已提交并记录了成本，约定第${c.event.year}年兑现；目前没有这份合同的完成结果。`,
  '现有服务单独显示，待办不是新机构、个人已经到任或新的同意；这里只读回已提交的安排。',
 ],[c.action.id],'pending');
 if(cellId==='E4')for(const c of contracts.filter(c=>c.event.actionId==='relocate_teacher'&&c.status==='pending'))add(`contract:${c.action.id}`,'河港迁任 · 尚未到达的安排',[
  `这份已支付成本的迁任行动记在D4，约定第${c.event.year}年兑现；E4现在没有由它产生的新学校。`,
  '待办不是本人同意或已经到任的证明。原行动仍归河港，不复制成东岸的新行动。',
 ],[c.action.id],'pending');
 if(cellId==='D4'){
  const completed=localContracts.filter(c=>c.outcome),recruit=completed.find(c=>RECRUIT.includes(c.event.actionId));
  const personal=[],personalIds=[];
  if(recruit){
   personal.push(`第${recruit.event.year}年，林澈完成自愿入局；这份同行决定不等于河港所有工作已经有人接住。`);
   personalIds.push(recruit.action.id,recruit.outcome.id);
   if(recruit.event.actionId==='recruit_successor')personal.push('原继任合同保留苏岚当时同意接班的记录；承诺与实际岗位来源须分别核对，也不能写成她今天仍在原岗位工作。');
   else if(recruit.event.actionId==='recruit_risk')personal.push('这份合同没有另行安排继任。是否发生停运，以实际年度记录为准，不能把旧版通用风险当作每项制度已经停运。');
   else personal.push('这份自愿同行合同不指定苏岚接班，不补建机构，也不制造一个不存在的空岗。');
  }
  for(const c of completed){
   if(c.event.actionId==='present_archive'){personal.push(`第${c.event.year}年的兑现保留苏岚决定当前生活的权利；今天的机构不能替她作出下一次同意。`);personalIds.push(c.action.id,c.outcome.id);}
   if(c.event.actionId==='renew_charter'){personal.push(`第${c.event.year}年的章程留下林澈带教与长期维护的约定；这是已存约定，不是她终身在岗的证明，也没有指定苏岚任职。`);personalIds.push(c.action.id,c.outcome.id);}
  }
  if(personal.length)add('personal-records','名字与制度分开记',personal,personalIds);
  const warning=completed.find(c=>c.event.actionId==='free_warning');
  if(warning)add(`contract:${warning.action.id}`,'基本预警 · 兑现与当前服务',[
   `第${warning.event.year}年的基本预警合同已有兑现记录；它只针对河港，不自动开放其他地区或修正共同标准。`,
   '当年的兑现与今天仍有服务是两件事。当前的测站、传讯队和维护状态逐项列在上方，不能用合作记录补写个人任职。',
  ],[warning.action.id,warning.outcome.id]);
  const relocation=getRelocationHistory(state);
  if(relocation){const paid=completed.some(c=>c.event.actionId==='relocate_teacher');
   const objection=['苏岚拒绝把这称为被拯救。','苏岚反对自己的意愿被一份旧履历替代。'].find(t=>relocation.original?.text?.includes(t));
   add('relocation',relocation.title,paid?[relocation.summary,objection?`原迁任记录仍记着：${objection}`:'原迁任记录没有保留可核对的个人证词，不能补写苏岚的态度。',relocation.context,relocation.processNote]
    :['迁任的已付行动与兑现来源缺失或不一致，经过未知；不能从当前停运反推迁任或个人去向。'],
    paid?[relocation.original?.id,...relocation.sources.map(r=>r.id)].filter(Boolean):[],paid&&relocation.status==='recorded'?'recorded':'unknown');}
  const fees=getFeeHistory(state);
  if(fees){const paid=contracts.some(c=>c.outcome?.id===fees.origin?.recordId),known=fees.status!=='unknown'&&paid;
   add('maintenance-history',fees.title,[known?fees.summary:'第16年经费变化的原测站或已付建站来源缺失、不一致，具体经过未知；不从今天的收费牌补写。','后来的开放、恢复或停运不删除这一页；费用与人手问题也不能替苏岚补写任职。'],
    known?['charter-lapsed',...fees.sources.map(r=>r.id)]:[],known?'recorded':'unknown');}
  for(const r of state.history.filter(r=>r.cellId==='D4'&&['station-unattended','archive-unattended'].includes(r.id))){
   const role=local.find(i=>i.sourceEventId===r.parentId&&i.kind===(r.id==='station-unattended'?'station':'archive'));
   if(role&&carrier(role)&&r.kind==='maintenance'&&r.year===16&&r.status==='confirmed'&&r.sourceActionId===null&&safeTrace(r.id))
    add(`maintenance:${r.id}`,'第16年的停运记录仍在',[`第16年已记录${KIND[role.kind]}无人接班而停运。今天的运行或恢复不会删掉那段空缺。`],[r.id]);
  }
  for(const c of completed.filter(c=>['share_power','central_review','withdraw'].includes(c.event.actionId)))add(`contract:${c.action.id}`,'方针已经签署，责任仍在',[
   `第${c.event.year}年，「${c.rule.title}」方针已签署。它不是一项新增的测站、学校或校验服务。`,
   '实际承接人手、地方授权、校验与信任仍须分别核对，不能仅凭宣言推定交班成功。',
  ],[c.action.id,c.outcome.id]);
 }else{
  const relocation=getRelocationDestination(state,'E4');
  if(relocation){const paid=contracts.some(c=>c.event.actionId==='relocate_teacher'&&c.outcome);
   add('relocation',relocation.title,paid?relocation.paragraphs
    :['迁任的已付行动与兑现来源缺失或不一致，经过未知；不能从教学机构补写苏岚的去向或同意。'],
    paid?relocation.sources.map(r=>r.recordId):[],paid&&relocation.status==='recorded'?'recorded':'unknown');}
  const authorization=getTrainingAuthorizationStatus(state,'E4'),c=authorization.contracts[0];
  if(c){
   const target=local.find(i=>i.id===c.target.id),pending=c.status==='pending',cancelled=c.status==='cancelled',workload=c.workload;
   const result=workload ? (pending ? '第30年已支付协商、公开轮值与记录工作的成本，约定第31年核对原学徒并协商轮值职责与承接权。议事和生计协调将占用部分深入带教时段，基本读尺与预警保留；现在仍待兑现，读到条件不等于已经取得他们的签名，也没有开始改排。' : cancelled ? `第31年，${c.cancellationReason==='already-authorized'?'原学徒已有授权或本地已有实际承接授权':'原学徒目标缺失、替换或不再有效运转'}，本次协商取消，没有新增授权或执行职责改排；已付成本不退。` : '第31年，原东岸学徒按已协商的条件留下本地承接签名，并开始调整轮值：保留基本读尺与预警，减少深入带教，承担公开议事和生计协调。经费支付的是会议、公开轮值与记录工作，签名不是买来的，也不是介入员替他们签署。') : pending?'第30年已支付协商、公开轮值与记录工作的成本，约定第31年核对原学徒。现在仍待兑现，读到条件不等于已经取得他们的签名。'
    :cancelled?`第31年，${c.cancellationReason==='already-authorized'?'原学徒已有授权或本地已有实际承接授权':'原学徒目标缺失、替换或不再有效运转'}，本次协商取消，没有新增授权；已付成本不退。`
     :'第31年，原东岸学徒按已协商的条件留下本地承接签名。经费支付的是会议、公开轮值与记录工作，签名不是买来的，也不是介入员替他们签署。';
   add('training-authorization',workload?'原学徒的承接签名与轮值分工':'原学徒的承接签名',[
    result,
    `对象始终是第7年原建站链留下的E4学徒，${target?currentText(target):'今天的目标载体已无法核实'}；其他学校或南岸读尺班没有因此获得这份授权。`,
    workload ? (pending ? '合同拟提高原点的政治、经济年度来源，降低科学来源，宗教不变；这项排班尚未执行。' : cancelled ? '这份拟议排班没有生效，不能把旧签名或其他学校当作已经完成改排。' : !target || activity(target)==='unknown' ? '改排的历史记录仍在，但原点当前运转情况未知，不能从签署页推定今天仍有来源。' : activity(target)==='stopped' ? '改排的历史记录仍在；原点当前停运，不再提供这份排班的年度来源。' : `原点目前仍按这份排班提供来源：政治、经济较原排班提高，科学降低，宗教不变；实际仍乘维护系数${target.maintenance}，不是通道净增预测。`) + '不新建学校、不增加人手、预警覆盖或异源校验，也不附送河港信任和交班方针。第23年的清点留在原页。' : '这项协商不新建学校、不增加人手、年度产出、预警覆盖或异源校验，也不附送河港信任和交班方针。第23年的清点留在原页。',
   ],authorization.sourceIds,pending?'pending':'recorded');
  }else if(authorization.status==='unknown')add('training-authorization','承接签名的来源待核对',[
   authorization.reason,'不能从课堂、姓名或今天的能力补写已经签署；当前服务与授权来源分开记录。',
  ],[],'unknown');
 }
 const mentioned=state.history.filter(r=>r.cellId===cellId&&r.kind==='action'&&dated(r,state.year)
  &&typeof r.id==='string'&&Object.hasOwn(CONTRACTS,r.id.split(':').at(-1)));
 if(mentioned.some(r=>!localContracts.some(c=>c.action===r)))add('source-gaps','留下未能核实的页码',[
  '部分已存行动的成本、日期、执行者或兑现来源缺失、不唯一或互相矛盾。结果未知，不把缺页写成成功、失败、取消或没有行动。',
 ],[],'unknown');
 let historical=getLocalCrisisRecord(state,cellId);
 if(historical?.recordId){
  const crisis=getCrisisHistory(state,historical.recordId);
  const destinations=[historical.recordId,...(crisis?.discovery||[]).map(r=>r.id),...(crisis?.responses||[]).flatMap(r=>[r.eventId,r.recordId,...r.chain.map(x=>x.id)])];
  // Event links in the detail panel are also checked through a past outcome.
  const safe=id=>safeTrace(id)||state.events.some(e=>e.id===id)&&safeTrace(`resolved:${id}`);
  if(!crisis||!destinations.every(safe))historical={...historical,recordId:null,
   detail:[...historical.detail,'清点来源链缺失、不唯一或不一致，不提供未经核实的跳转；已存清点与当前服务仍分开阅读。']};
 }
 return {summary,cards,sourceIds:[...new Set(cards.flatMap(c=>c.sourceIds))],
  art:{...art,...(historical?{history:historical}:{})}};
}
