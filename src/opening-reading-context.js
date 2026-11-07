// Presentation only: the opening is an existing arrival record, never a new
// event or a reconstruction from today's institutions. Do not read RNG/drafts.
const read = (object, key) => object && typeof object === 'object'
  ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
const ARRIVAL = Object.freeze({
  id: 'arrival', year: 0, cellId: 'D4', kind: 'arrival',
  title: '第零年 · 借来的十年',
  text: '续史局只能在每十年的窗口介入一次。你是唯一的介入员。河港将迎来洪水，但居民并不只需要被拯救。',
  parentId: null, sourceActionId: null, status: 'confirmed', reality: 'R1',
});

export function getOpeningReadingContext(state) {
  if (read(state, 'year') !== 0 || read(state, 'phase') !== 'planning'
    || read(state, 'reality') !== 'R1') return null;
  const history = read(state, 'history'), events = read(state, 'events');
  if (!Array.isArray(history) || !Array.isArray(events)) return null;
  const candidates = [...history, ...events].filter(record =>
    read(record, 'id') === ARRIVAL.id || read(record, 'kind') === ARRIVAL.kind);
  if (candidates.length !== 1 || !history.includes(candidates[0])) return null;
  const record = candidates[0];
  // All retained producer generations use this same arrival text. Unknown
  // variants are not rewritten or presented as a trusted first commission.
  if (!Object.entries(ARRIVAL).every(([key, value]) => read(record, key) === value)
    || ['actionId', 'actorId', 'resolvedYear'].some(key => read(record, key) !== undefined)) return null;
  return {
    recordId: read(record, 'id'),
    label: '第一次委托 · 已存抵达记录',
    title: read(record, 'title'),
    body: read(record, 'text'),
  };
}
