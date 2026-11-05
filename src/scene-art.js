// Original repo-native vector illustrations. They depict only a broad setting,
// not evidence that an unbuilt institution, a survivor or a future event exists.
export function sceneArt(state, cellId, { ending = false } = {}) {
  if (ending) return { file: 'archive-desk.svg', alt: '档案桌上并列的记录与一盏灯，记录已经发生的四十年。', caption: '场景示意 · 留下来的历史' };
  const has = kind => state.institutions.some(i => i.cellId === cellId && i.kind === kind && i.active && i.maintenance > 0);
  if (cellId === 'D4') {
    const stations=state.institutions.filter(i=>i.cellId==='D4'&&i.kind==='station');
    const working=stations.filter(i=>i.active&&i.maintenance>0).sort((a,b)=>(b.startYear||0)-(a.startYear||0));
    if (working.length) {
      const station=working[0];
      if (station.maintenance<1) return { file: 'river-station-maintenance.svg', alt: 'D4河港测站仍在运转。窗外是原来的站房、水尺与码头，屋面留下修补，值班牌有空格，桌灯仍亮着；这是维护不足的现场。', caption: '场景示意 · 仍在运转，维护不足' };
      if (state.flags?.recruited&&!state.flags?.successor) return { file: 'river-station-understaffed.svg', alt: 'D4河港测站仍在运转，原站房、水尺与记录都在。值班牌空出班次，桌灯仍亮着，表示尚缺接班人，不表示站房已毁。', caption: '场景示意 · 测站仍在，尚缺接班人' };
      return { file: 'river-station-active.svg', alt: 'D4河港记录室，窗外是仍在运转的原测站、水尺和码头；值班牌与记录册保持在用，桌灯亮着。', caption: '场景示意 · 持续工作的河港测站' };
    }
    if (stations.length) return { file: 'river-station-stopped.svg', alt: 'D4曾经建成的河港测站已经停运。原站房、水尺、码头和旧记录仍保留，窗门与值班牌被木条封起，桌灯熄灭；这里不是从未建站的河岸。', caption: '场景示意 · 测站停运，历史仍在' };
  }
  if (cellId === 'F6' && has('branch')) return { file: 'river-room.svg', alt: `${cellId}的记录室，窗外是河流与仍在运转的测量建筑。`, caption: '场景示意 · 现存测量机构' };
  if (has('school') || has('training')) return cellId === 'D5'
    ? { file: 'bank-reading.svg', alt: 'D5南岸的露天读尺围座，没有屋顶与围墙；学员使用旧水尺和便携记录桌练习。', caption: '场景示意 · 南岸读尺班' }
    : { file: 'local-classroom.svg', alt: `${cellId}的敞开河堤课堂，没有围墙；学员使用旧水尺练习读尺，遮雨棚下的便携桌上放着轮值记录。`, caption: '场景示意 · 河堤上的课堂' };
  if (state.institutions.some(i => i.cellId === cellId && ['school','training'].includes(i.kind))) return cellId === 'D5'
    ? { file: 'closed-bank-reading.svg', alt: 'D5停办后的读尺围座，原来的长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。', caption: '场景示意 · 留下的读尺围座' }
    : { file: 'closed-classroom.svg', alt: `${cellId}停办后的河堤课堂，原来的敞开遮雨棚、长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。`, caption: '场景示意 · 课堂停办，原址仍在' };
  if (cellId === 'B4' || cellId === 'D4') return { file: 'archive-desk.svg', alt: `${cellId}的档案桌、账册与一盏灯；画面不表示当地已经建成测站。`, caption: '场景示意 · 记录与协商' };
  return { file: 'open-shore.svg', alt: `${cellId}的河岸、芦苇和临时记录桌，画面没有测站或学校。`, caption: '场景示意 · 来到地方' };
}
