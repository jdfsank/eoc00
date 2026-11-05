// Original repo-native vector illustrations. They depict only a broad setting,
// not evidence that an unbuilt institution, a survivor or a future event exists.
export function sceneArt(state, cellId, { ending = false } = {}) {
  if (ending) return { file: 'archive-desk.svg', alt: '档案桌上并列的记录与一盏灯，记录已经发生的四十年。', caption: '场景示意 · 留下来的历史' };
  const has = kind => state.institutions.some(i => i.cellId === cellId && i.kind === kind && i.active && i.maintenance > 0);
  if ((cellId === 'D4' && has('station')) || (cellId === 'F6' && has('branch'))) return { file: 'river-room.svg', alt: `${cellId}的记录室，窗外是河流与仍在运转的测量建筑。`, caption: '场景示意 · 现存测量机构' };
  if (has('school') || has('training')) return { file: 'local-classroom.svg', alt: `${cellId}的地方课堂，黑板上画着水位曲线，课桌上放着记录。`, caption: '场景示意 · 现存教学网络' };
  if (cellId === 'B4' || cellId === 'D4') return { file: 'archive-desk.svg', alt: `${cellId}的档案桌、账册与一盏灯；画面不表示当地已经建成测站。`, caption: '场景示意 · 记录与协商' };
  return { file: 'open-shore.svg', alt: `${cellId}的河岸、芦苇和临时记录桌，画面没有测站或学校。`, caption: '场景示意 · 来到地方' };
}
