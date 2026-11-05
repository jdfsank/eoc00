import {getInstitutionStaffing} from './simulation.js';

export const STATION_ACCESS_ASSETS=['river_station_fee','river_station_public','river_station_closed_fee','river_station_closed_public'];
// Access is a current field of an existing D4 station. Neither a locked plan,
// a queued charter, a governance flag, nor another region changes this display.
export function stationAccessVisual(state){
 const stations=(state?.institutions||[]).filter(i=>i.cellId==='D4'&&i.kind==='station'&&typeof i.open==='boolean'&&(!Number.isFinite(state.year)||!Number.isFinite(i.startYear)||i.startYear<=state.year));
 if(!stations.length)return null;
 const running=stations.filter(i=>i.active===true&&i.maintenance>0);
 const station=[...(running.length?running:stations)].sort((a,b)=>(b.startYear||0)-(a.startYear||0))[0];
 const halted=!station.active||station.maintenance<=0,maintenanceGap=!halted&&station.maintenance<1,staffingGap=!halted&&getInstitutionStaffing(state,station).outputReducedNow;
 const access=station.open?'public':'fee',condition=halted?'stopped':maintenanceGap&&staffingGap?'maintenance-understaffed':maintenanceGap?'maintenance':staffingGap?'understaffed':'active';
 const parts=halted?['停运','原址建筑保留']:[];
 if(!halted){if(staffingGap)parts.push('维护者缺席');if(maintenanceGap)parts.push('维护不足');if(!parts.length)parts.push('制度运行中');parts.push(access==='fee'?'收费门槛，按缴费名册服务':'基本预警公开准入');}
 else parts.push(access==='fee'?'旧收费规约封存（当前不提供服务）':'旧公开规约封存（当前不提供服务）');
 const service=access==='fee'?'前景缴费名册与窄服务栏保留收费准入，不能把收费门槛误读成整个测站停运。':'前景宽幅公开告示替代缴费名册，表示基本预警不再以缴费为准入条件，不表示人人已经收到消息。';
 const current=halted
  ?`D4曾经建成的河港测站已经停运。原站房、水尺、码头和旧记录仍保留，窗门与值班牌封起，桌灯熄灭；${access==='fee'?'缴费名册与服务栏':'公开告示'}也已绑起，只保留旧规约，不表示正在提供服务。`
  :`D4河港测站仍在运转。原站房、水尺、码头和记录室仍在，桌灯亮着。${maintenanceGap?'屋面留下修补，表示物理维护不足。':'屋面保持完整。'}${staffingGap?'值班牌空出班次，表示尚缺接班人，不表示站房已毁。':'值班牌仍在使用，未用空班次代指维护不足。'}${service}`;
 return {stationId:station.id,station,access,condition,halted,maintenanceGap,staffingGap,restricted:!halted&&access==='fee',
  status:halted?'halted':maintenanceGap?'degraded':staffingGap?'understaffed':'operating',prop:`river_station_${halted?'closed_':''}${access}`,file:`river-station-${access}-${condition}.svg`,label:parts.join(' · '),
  alt:`${current}这些准入、维护和值守状态分别表达，不表示共同标准已经纠正，也不推定历史损失。`,caption:`场景示意 · 河港原测站 · ${parts.join(' · ')}`,captionBelow:true};
}
