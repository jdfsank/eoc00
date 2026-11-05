import {monasteryVisual} from './monastery-visuals.js';
import {stationAccessVisual} from './station-access-visuals.js';
import {farPortVisual} from './far-port-visuals.js';
import {southBankVisual} from './south-bank-visuals.js';
import {getLocalCrisisRecord} from './local-crisis-record.js';
// Original repo-native vector illustrations. They depict only a broad setting,
// not evidence that an unbuilt institution, a survivor or a future event exists.
export function sceneArt(state, cellId, { ending = false } = {}) {
  const art=currentSceneArt(state,cellId,{ending});
  if(cellId==='D5'&&!ending){const history=getLocalCrisisRecord(state,cellId);if(history)return {...art,history};}
  return art;
}
function currentSceneArt(state, cellId, { ending = false } = {}) {
  if (ending) return { file: 'archive-desk.svg', alt: '档案桌上并列的记录与一盏灯，记录已经发生的四十年。', caption: '场景示意 · 留下来的历史' };
  const has = kind => state.institutions.some(i => i.cellId === cellId && i.kind === kind && i.active && i.maintenance > 0);
  if (cellId === 'D4') {
    const station=stationAccessVisual(state);
    if(station)return {file:station.file,alt:station.alt,caption:station.caption,captionBelow:true};
    // A real resident service is distinct from the old archive post and from
    // a water station. Flags, drafts and pending events never install its bell.
    const warnings=state.institutions.filter(i=>i.cellId==='D4'&&i.kind==='warning'&&(!Number.isFinite(state.year)||!Number.isFinite(i.startYear)||i.startYear<=state.year));
    const running=warnings.filter(i=>i.active&&i.maintenance>0).sort((a,b)=>(b.startYear||0)-(a.startYear||0));
    if(warnings.length){
      const condition=running.length?(running[0].maintenance<1?'maintenance':'active'):'stopped';
      const detail=condition==='stopped'
        ? '门外原有的低矮钟架仍在，钟绳系起，轮值板封住，没有正在传讯的人。居民传讯队已经停运。'
        : condition==='maintenance'
          ? '门外低矮钟架留下加固补片，轮值表有空格；居民仍在敲钟并递送地方观察，传讯队尚在运行但维护不足。'
          : '门外低矮钟架旁，居民按轮值表敲钟、递送地方观察；居民传讯队正在运行。';
      return {file:`river-warning-${condition}.svg`,alt:`D4河港档案室的书架、旧账册与记录桌仍保留，不表示原档案岗位恢复。${detail}这里没有测量塔或水尺，居民传讯不是测站或独立复核，也不表示所有家庭都已收到消息。`,caption:`场景示意 · ${condition==='stopped'?'居民钟报停运，原址与旧档保留':condition==='maintenance'?'居民钟报仍在运行，维护不足':'居民钟报运行中，旧档仍在'} · 非测站`,captionBelow:true};
    }
  }
  if (cellId === 'B4') { const library=monasteryVisual(state); if(library) return {file:library.file,alt:library.alt,caption:`场景示意 · ${library.label}`,captionBelow:true}; }
  if (cellId === 'F6') { const port=farPortVisual(state); if(port) return {file:port.file,alt:port.alt,caption:`场景示意 · ${port.label}`,captionBelow:true}; }
  if (cellId === 'D5') {
    const south=southBankVisual(state);
    if (south.aid.exists) {
      const teaching=south.teaching.exists
        ? south.teaching.active?'左侧露天读尺围座继续使用，没有屋顶与围墙；学员在旧水尺旁练习。':'左侧停办的读尺围座仍保留长凳和旧水尺，记录桌封起，没有正在上课的人。'
        : '左侧保留开阔河岸，没有凭空出现课堂或测站。';
      const aid=south.aid.active
        ? '右侧低矮高脚互助物资棚开着分发口，轮值人员在桌边登记物资；物资和人数只是场景示意，不表示额外减灾次数。'
        : '右侧曾经建成的互助物资棚与木箱仍在，分发口用木条封起，登记册捆好，没有人在分发物资。';
      return {file:south.file,alt:`D5南岸。${teaching}${aid}`,caption:`场景示意 · ${south.label}`,captionBelow:true};
    }
  }
  if (has('school') || has('training')) return cellId === 'D5'
    ? { file: 'bank-reading.svg', alt: 'D5南岸的露天读尺围座，没有屋顶与围墙；学员使用旧水尺和便携记录桌练习。', caption: '场景示意 · 南岸读尺班' }
    : { file: 'local-classroom.svg', alt: `${cellId}的敞开河堤课堂，没有围墙；学员使用旧水尺练习读尺，遮雨棚下的便携桌上放着轮值记录。`, caption: '场景示意 · 河堤上的课堂' };
  if (state.institutions.some(i => i.cellId === cellId && ['school','training'].includes(i.kind))) return cellId === 'D5'
    ? { file: 'closed-bank-reading.svg', alt: 'D5停办后的读尺围座，原来的长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。', caption: '场景示意 · 留下的读尺围座' }
    : { file: 'closed-classroom.svg', alt: `${cellId}停办后的河堤课堂，原来的敞开遮雨棚、长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。`, caption: '场景示意 · 课堂停办，原址仍在' };
  if (cellId === 'B4' || cellId === 'D4') return { file: 'archive-desk.svg', alt: `${cellId}的档案桌、账册与一盏灯；画面不表示当地已经建成测站。`, caption: '场景示意 · 记录与协商' };
  return { file: 'open-shore.svg', alt: `${cellId}的河岸、芦苇和临时记录桌，画面没有测站或学校。`, caption: '场景示意 · 来到地方' };
}
