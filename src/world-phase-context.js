// Read-only phase copy for the world sidebar. This reads only the public clock,
// never drafts, events, outcomes, rolls or future results.
export function getWorldPhaseContext(state) {
  const year = state?.year, phase = state?.phase;
  if (!Number.isInteger(year) || year < 0 || year > 40) return null;
  if (phase === 'planning' && [0, 10, 20, 30].includes(year)) return {
    kind: 'planning', title: '本轮安排', showDraftCount: true,
    description: '先锁定或放弃每名棋子的任务，再统一提交。成本与随机结果只在提交后发生。',
  };
  if (phase === 'playback' && year < 40) return {
    kind: 'playback', title: '本轮已提交', showDraftCount: false,
    description: '本轮成本已结算，安排仍要等到约定年份核对。可以继续年度演变或查阅已存记录；这里没有新的介入名额。',
  };
  if (phase === 'ended' && year === 40) return {
    kind: 'ended', title: '四十年已归档', showDraftCount: false,
    description: '这一阶段不再安排新的介入。可以重读已提交的选择、实际结果与人物末页，或先导出这段历史再重新开始。',
  };
  return null;
}
