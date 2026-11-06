import {getTrainingAuthorizationStatus} from './training-authorization.js';

// A current-place illustration never establishes provenance or named activity.
// Unknown stored fields have a neutral image, distinct from a closed classroom.
const condition=i=>!Number.isInteger(i.startYear)||i.startYear<0||typeof i.active!=='boolean'||!Number.isFinite(i.maintenance)||i.maintenance<0||i.maintenance>1?'unknown':i.active&&i.maintenance>0?'active':'stopped';
const words={active:'运行中',stopped:'已停运，原址保留',unknown:'运转状态未核实'};
const describe=(status,name)=>status==='active'?`${name}的敞开遮雨棚没有围墙，旧水尺、记录桌与无名学员呈现教学仍在进行。`:status==='stopped'?`${name}的旧水尺和长凳仍在，记录桌用木条封起，没有正在上课的人。`:`${name}只保留无名场所与工具示意；记录桌没有封条，画面没有正在上课的人，不将未知画成停办。`;
export function eastBankVisitArt(state){
 const local=(state?.institutions||[]).filter(i=>i.cellId==='E4'&&['training','school'].includes(i.kind)&&(!Number.isFinite(i.startYear)||!Number.isFinite(state.year)||i.startYear<=state.year));
 const group=kind=>{const rows=local.filter(i=>i.kind===kind),conditions=rows.map(condition);return rows.length?conditions.includes('active')?'active':conditions.includes('unknown')?'unknown':'stopped':null;};
 const training=group('training'),school=group('school');
 if(!training&&!school)return {file:'open-shore.svg',alt:'E4当前可见的河岸、芦苇与临时记录桌；尚无已到设立年份的教学载体，不画未来课堂或学员。',caption:'场景示意 · 东岸河堤，未见已设立教学载体',captionBelow:true};
 if(training&&school)return {file:`east-bank-teaching-${training}-${school}.svg`,alt:`E4两类教学载体的上下分栏示意，并非两张不同时期照片，也不是精确地理布局。上栏：${describe(training,'学徒培训点')}下栏：${describe(school,'学校')}各栏代表载体类别，不表示机构或人数统计，不指认任何具名教师。`,caption:`第 ${state.year} 年 · 上栏：学徒培训点${words[training]}；下栏：学校${words[school]}。同一时点分别记述，不用后来学校替代原培训点。`,captionBelow:true,composite:true};
 const status=training||school,name=training?'学徒培训点':'学校';
 return {file:status==='active'?'local-classroom.svg':status==='stopped'?'closed-classroom.svg':'east-bank-teaching-unknown.svg',alt:`E4${describe(status,name)}不指认任何具名教师，也不表示异源校验已经成功。`,caption:`场景示意 · ${name}${words[status]}`,captionBelow:true};
}
export function eastBankAuthorizationArt(state){
 const authorization=getTrainingAuthorizationStatus(state,'E4'),status=authorization.status;
 if(!['pending','authorized','cancelled','unknown'].includes(status))return null;
 const labels={pending:'已提交，等待第31年核对原培训点',authorized:'第31年地方授权已经兑现，记录保留',cancelled:'协商合同已取消，没有新增授权',unknown:'授权来源未核实，不补写签署结果'};
 const facts={pending:'议事桌上只有尚未签署的空白文书与空白轮值板；没有授权印记。',authorized:'议事桌上摊开已归档的地方授权文书，轮值板留下条目，以不同物件形状表示已兑现记录。',cancelled:'原协商文书卷起捆好，轮值板由斜木条封住；保留取消的合同，不画成从未提交或已经获权。',unknown:'议事桌为空，轮值板悬着问号记号；没有签署文书，也不把记录不足画成失败或停办。'};
 return {file:`east-bank-mandate-${status}.svg`,alt:`E4地方承接议事的文书近景。${facts[status]}没有具名人物、新学校、测站或新增服务；教学载体当前是否运转由现场另行说明。`,caption:`${labels[status]}。这份文书不是新学校，也不代替异源校验或河港信任。`,status};
}
