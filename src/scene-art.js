// Original repo-native vector illustrations. They depict only a broad setting,
// not evidence that an unbuilt institution, a survivor or a future event exists.
export function sceneArt(state, cellId, { ending = false } = {}) {
  if (ending) return { file: 'archive-desk.svg', alt: '档案桌上并列的记录与一盏灯，记录已经发生的四十年。', caption: '场景示意 · 留下来的历史' };
  const has = kind => state.institutions.some(i => i.cellId === cellId && i.kind === kind && i.active && i.maintenance > 0);
  if ((cellId === 'D4' && has('station')) || (cellId === 'F6' && has('branch'))) return { file: 'river-room.svg', alt: `${cellId}的记录室，窗外是河流与仍在运转的测量建筑。`, caption: '场景示意 · 现存测量机构' };
  if (has('school') || has('training')) return cellId === 'D5'
    ? { file: 'bank-reading.svg', alt: 'D5南岸的露天读尺围座，没有屋顶与围墙；学员使用旧水尺和便携记录桌练习。', caption: '场景示意 · 南岸读尺班' }
    : { file: 'local-classroom.svg', alt: `${cellId}的敞开河堤课堂，没有围墙；学员使用旧水尺练习读尺，遮雨棚下的便携桌上放着轮值记录。`, caption: '场景示意 · 河堤上的课堂' };
  if (state.institutions.some(i => i.cellId === cellId && ['school','training'].includes(i.kind))) return cellId === 'D5'
    ? { file: 'closed-bank-reading.svg', alt: 'D5停办后的读尺围座，原来的长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。', caption: '场景示意 · 留下的读尺围座' }
    : { file: 'closed-classroom.svg', alt: `${cellId}停办后的河堤课堂，原来的敞开遮雨棚、长凳与旧水尺仍在，记录桌被木条封起，现场没有正在上课的人。`, caption: '场景示意 · 课堂停办，原址仍在' };
  if (cellId === 'B4' || cellId === 'D4') return { file: 'archive-desk.svg', alt: `${cellId}的档案桌、账册与一盏灯；画面不表示当地已经建成测站。`, caption: '场景示意 · 记录与协商' };
  return { file: 'open-shore.svg', alt: `${cellId}的河岸、芦苇和临时记录桌，画面没有测站或学校。`, caption: '场景示意 · 来到地方' };
}
