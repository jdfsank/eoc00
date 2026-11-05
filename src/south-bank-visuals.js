// Both services occupy the same riverbank, but one cannot stand in for the other.
// Only existing institutions count. Drafts, promises and pending events do not.
export const SOUTH_BANK_ASSETS = [
 'south_bank_aid', 'south_bank_aid_closed',
 'south_bank_learning_aid', 'south_bank_learning_closed_aid',
 'south_bank_learning_aid_closed', 'south_bank_learning_closed_aid_closed',
];
export function southBankVisual(state) {
 const local=state.institutions.filter(i=>i.cellId==='D5');
 const group=kinds=>{
  const all=local.filter(i=>kinds.includes(i.kind)),working=all.filter(i=>i.active!==false&&i.maintenance>0);
  return {exists:all.length>0,active:working.length>0,maintenanceGap:working.some(i=>i.maintenance<1),ids:all.map(i=>i.id)};
 };
 const teaching=group(['training','school']),aid=group(['mutual']);
 const prop=aid.exists?`south_bank_${teaching.exists?`learning_${teaching.active?'':'closed_'}`:''}aid${aid.active?'':'_closed'}`:null;
 const describe=(group,name)=>`${name}${group.active?'运行中':'停运，原址保留'}${group.maintenanceGap?'，维护不足':''}`;
 const label=aid.exists?[...(teaching.exists?[describe(teaching,'读尺班')]:[]),describe(aid,'互助仓')].join(' · '):null;
 return {teaching,aid,prop,file:prop?`${prop.replaceAll('_','-')}.svg`:null,label};
}
