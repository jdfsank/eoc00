import {FLOOD_REGIONS} from './simulation.js';
import {getCrisisHistory} from './crisis-history.js';
const coefficient=value=>Number.isFinite(value)&&value>=0&&value<=1;
const names={D4:'河港',E4:'东岸',D5:'南岸',F6:'远港'};
const markers={loss:'crisis-tally-loss.svg',zero:'crisis-tally-zero.svg',unknown:'crisis-tally-unknown.svg'};

// Presentation of frozen, local settlement data only. Current services, global
// outcome labels, later contracts and random inputs cannot supply a missing
// local result. The record is a historical annotation, not damaged scenery.
export function getLocalCrisisRecord(state,cellId){
 if(!FLOOD_REGIONS.includes(cellId)||!Number.isInteger(state.year))return null;
 const base={cellId,year:23,title:`${cellId} ${names[cellId]} · 第23年清点`,recordId:null,damage:null,coverage:null};
 if(state.year<23)return {...base,status:'pending',summary:'第23年尚未结算，地域清点结果未知。',detail:['不读取未来结果，不把当前机构或待兑现合同当作已发生的损失。'],markerFile:null,markerAlt:''};
 const view=getCrisisHistory(state,'crisis-impact'),impact=view?.impact;
 // The engine stores this shared world milestone at D4. Its affectedCells
 // scope, not its storage coordinate, establishes that it also concerns D5.
 const original=impact&&impact.parentId==='crisis-warning'&&impact.cellId==='D4'
  &&impact.sourceActionId===null&&impact.status==='confirmed'&&impact.reality==='R1';
 const crisis=state.flags?.crisis,scope=original&&crisis?.warningYear===14&&crisis?.irreversibleYear===23
  &&Array.isArray(crisis.affectedCells)&&crisis.affectedCells.includes(cellId);
 const damage=scope&&coefficient(crisis.damageByCell?.[cellId])?crisis.damageByCell[cellId]:null;
 const coverage=scope&&coefficient(crisis.coverageByCell?.[cellId])?crisis.coverageByCell[cellId]:null;
 const status=damage===null?'unknown':damage===0?'zero':'loss';
 const summary=status==='loss'?`第23年清点记有${names[cellId]}损失；当前服务仍须另看。`
  :status==='zero'?`第23年${names[cellId]}已存损失系数为0；这不等于没有洪水或以后不会受损。`
   :original?`第23年原始清点仍在，但${names[cellId]}逐地损失明细未知。`:`第23年原始清点缺失或不一致，${names[cellId]}历史结果未知。`;
 const detail=[`已存损失系数：${damage===null?'未知':String(damage)}；当年覆盖系数：${coverage===null?'未知':String(coverage)}。`];
 if(damage===null||coverage===null)detail.push('缺项保留为未知，不从整体结果、当前机构或后来互助倒推。');
 detail.push('这里只标记已存的历史清点。系数是原型结算，不是人口或伤亡统计，也不证明建筑毁损。');
 detail.push('当前教学、互助与维护状态另列；后来的运行、停运或重启不会改写这页记录。');
 return {...base,status,summary,detail,recordId:original?'crisis-impact':null,damage,coverage,
  markerFile:markers[status],markerAlt:status==='loss'?'历史清点页签：实心菱形与断开的账行，表示记录中有损失，不表示现场建筑损毁。'
   :status==='zero'?'历史清点页签：空心圆与完整账行，表示已存损失系数为0，不表示没有洪水。'
    :'历史清点页签：虚线纸页与问号，表示逐地结果未知，不作零损失或有损失推断。'};
}
