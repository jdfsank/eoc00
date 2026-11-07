// Current presentation only. Read the public clock without evaluating accessors.
// Do not inspect pending events, drafts, history, private randomness or outcomes.
const read = (object, key) => object && typeof object === 'object'
  ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
const WINDOWS = [0, 10, 20, 30];

export function getStageBoundaryContext(state) {
  const year = read(state, 'year'), phase = read(state, 'phase');
  if (!Number.isInteger(year) || year < 0 || year > 40
    || !(phase === 'planning' && WINDOWS.includes(year)
      || phase === 'playback' && year < 40
      || phase === 'ended' && year === 40)) return null;
  const terminal = phase === 'ended';
  const nextYear = terminal ? null : Math.floor(year / 10) * 10 + 10;
  const finalDecade = nextYear === 40;
  const nextDestination = terminal ? null : {
    year: nextYear,
    kind: finalDecade ? 'archive' : 'window',
    label: `第 ${nextYear} 年${finalDecade ? '归档' : '窗口'}`,
    skipLabel: `略过逐条阅读，到第 ${nextYear} 年${finalDecade ? '归档' : '窗口'}`,
    commitCaution: finalDecade
      ? '提交会一次性支付本轮成本、登记承诺并保存，年份不会立即跳转。之后由你逐年播放或前往第40年归档；这段历史不再有新的介入窗口，不能返回重掷。'
      : '提交会一次性支付本轮成本、登记承诺并保存，年份不会立即跳转。之后由你逐年播放或前往下一窗口，不能返回重掷。',
  };
  const boundary = terminal || phase === 'planning' && year > 0;
  return {
    kind: phase, terminal, nextDestination,
    review: boundary ? {
      start: year - 10, end: year, terminal,
      action: terminal ? 'ending' : 'home',
      label: terminal ? '阅读第 40 年结局 →' : `进入第 ${year} 年窗口 →`,
      actorCountLabel: terminal ? '参与者' : '可用棋子',
      title: terminal ? '最后十年回顾' : '十年回顾',
      summary: terminal ? '第40年已归档。本阶段不再新增介入，可以阅读结局或核对已经发生的记录。' : '已发生的当前现实',
    } : null,
    archive: terminal ? {
      stamp: 'P1 · 阶段以后的历史 / 未模拟',
      title: '这一阶段已归档',
      body: '本阶段的选择与年度结算已结束，没有尚待提交的介入。第40年以后的历史未在本原型中模拟；仍可重读已存记录，不能据此补写未来结果。',
    } : {
      stamp: 'P1 · 未来预测 / 未发生',
      title: '还没有写下的页',
      body: '当前版本提供行动概率与时间契约，不生成伪装成事实的数值预测。未来取决于尚未提交的选择、维护与固定随机结果。',
    },
  };
}
