import { getReviewHistory } from './review-history.js';

// Presentation only: every contract row comes from the existing historical
// verifier. A missing selected source never borrows another region's outcome.
export function getReviewReadingContext(state, recordId = null) {
  const history = getReviewHistory(state, recordId);
  if (!history) return null;
  const selected = recordId === null ? history.responses : history.original
    ? history.responses.filter(row => [row.eventId, row.sourceActionId, row.recordId].includes(recordId)) : [];
  const statusLabels = { pending: '待兑现', success: '已成功', failed: '已失败', cancelled: '已取消' };
  const results = selected.map(row => ({
    eventId: row.eventId, recordId: row.recordId, sourceActionId: row.sourceActionId,
    cellId: row.cellId, year: row.year, status: row.status, label: row.label,
    statusLabel: statusLabels[row.status], note: row.note,
  }));
  const incomplete = history.detail.some(text => text.includes('部分复核来源或兑现记录缺失、不唯一或不一致'));
  const resultNote = recordId !== null && !results.length
    ? '本项合同的来源或兑现记录无法核实，经过未知；不以另一地点的结果代替。'
    : incomplete
      ? '这里只列出已核实的合同记录；部分来源缺失、不唯一或不一致，经过未知。'
      : ''; // The two page headings and verified row notes already explain scope.
  const summary = history.status === 'zero'
    ? '第23年原始清点的整体损失系数为0。零损失不等于没有洪水，也不保证今后不会受损。'
    : history.status === 'unknown'
      ? '第23年原始清点缺失或不一致，整体损失未知。本地复核的成功或失败均不能补写这份清点。'
      : history.summary;
  return { history, heading: history.title, resultHeading: '已核实的合同记录', resultNote, results,
    settlement: { status: history.status, label: '第23年 · 原始全局清点', summary } };
}
