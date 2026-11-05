// Presentation only. The existing relocation contract stops every institution
// in D4, regardless of Sulan's job. No staffing, funding or motive is inferred
// from that rule, and today's active flag is not evidence of a past shutdown.
const TIMINGS = {
  build_merchant: [0, 2], build_state: [0, 3], build_joint: [0, 3],
  restore_archive: [10, 2], renew_charter: [10, 1],
  relocate_teacher: [20, 1],
};
const BUILDS = ['build_merchant', 'build_state', 'build_joint', 'restore_archive'];
const unique = (items, id) => {
  const matches = items.filter(item => item?.id === id);
  return matches.length === 1 ? matches[0] : null;
};
const agrees = (record, key, value) => record[key] === undefined || record[key] === value;
const RULE = '既定迁任合同不仅把苏岚调往东岸，也同时停用河港当时已有的制度。停运是这份合同的制度后果，不以苏岚是否担任维护者为条件。';
const LIMIT = '旧记录没有交代具体维护中断过程；不能据此补写撤资、解散维护小组或调走其他人的决定，也不能把苏岚写成唯一维护者。';
const BOUNDARY = '原合同、原文与历史结果保留。这里不按今天的停运状态倒推原因；后来恢复的服务也不删除这次迁任记录。';

function readSources(state) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const events = Array.isArray(state?.events) ? state.events : [];
  const institutions = Array.isArray(state?.institutions) ? state.institutions : [];
  const actors = Array.isArray(state?.actors) ? state.actors : [];
  const all = [...history, ...events];
  const year = state?.year;
  const validYear = Number.isInteger(year) && year >= 0 && year <= 40;
  const sourceFor = event => {
    const timing = typeof event?.actionId === 'string' && Object.hasOwn(TIMINGS, event.actionId) ? TIMINGS[event.actionId] : null;
    if (!timing || !validYear || unique(events, event.id) !== event || unique(all, event.id) !== event
      || typeof event.sourceActionId !== 'string') return null;
    const [actionYear, delay] = timing, actorId = event.sourceActionId.split(':')[2];
    const sourceId = `action:${actionYear}:${actorId}:D4:${event.actionId}`;
    const action = unique(history, sourceId), outcome = unique(history, `resolved:${event.id}`);
    const actor = unique(actors, actorId);
    const statusAllowed = event.status === 'success' || (event.status === 'failed' && event.actionId.startsWith('build_'));
    const required = event.actionId === 'build_joint' ? ['independent_flood_records', 'unfunded_maintenance'] : [];
    if (!statusAllowed || !['protagonist', 'linche'].includes(actorId) || (actionYear < 20 && actorId !== 'protagonist')
      || !actor || !Number.isInteger(actor.availableFrom) || actor.availableFrom > actionYear
      || event.kind !== 'event' || event.cellId !== 'D4' || event.id !== `event:${sourceId}`
      || event.sourceActionId !== sourceId || event.parentId !== sourceId
      || event.year !== actionYear + delay || event.resolvedYear !== event.year || event.year > year
      || !action || unique(all, action.id) !== action || action.kind !== 'action' || action.status !== 'confirmed'
      || action.year !== actionYear || action.cellId !== 'D4' || action.sourceActionId !== sourceId || action.parentId !== null
      || action.reality !== 'R1' || !Array.isArray(action.evidence) || !required.every(id => action.evidence.includes(id))
      || (event.evidence !== undefined && (!Array.isArray(event.evidence) || !required.every(id => event.evidence.includes(id))))
      || !outcome || unique(all, outcome.id) !== outcome || outcome.parentId !== event.id || outcome.sourceActionId !== sourceId
      || outcome.kind !== (event.status === 'success' ? 'outcome' : 'failure') || outcome.status !== event.status
      || outcome.year !== event.year || outcome.cellId !== 'D4' || outcome.reality !== 'R1'
      || [action, event, outcome].some(record => !agrees(record, 'actorId', actorId)
        || !agrees(record, 'actionId', event.actionId) || !agrees(record, 'reality', 'R1'))
      || history.filter(record => record?.kind === 'action' && typeof record.id === 'string'
        && record.id.startsWith(`action:${actionYear}:${actorId}:`)).length !== 1
      || history.some(record => record?.id === `pass:${actionYear}:${actorId}`)) return null;
    return { action, event, outcome };
  };
  const carrierFor = institution => {
    const source = institution && sourceFor(unique(events, institution.sourceEventId));
    if (!source || !BUILDS.includes(source.event.actionId) || institution.cellId !== 'D4'
      || institution.kind !== (source.event.status === 'failed' ? 'archive' : 'station')
      || institution.id !== `institution:${source.event.id}:D4` || unique(institutions, institution.id) !== institution
      || institution.sourceActionId !== source.action.id || institution.startYear !== source.event.year
      || institutions.filter(item => item?.sourceEventId === source.event.id && item.cellId === 'D4').length !== 1) return null;
    return { institution, source };
  };
  // Absence needs the earlier choice pages, not merely an empty current list.
  const windowKnown = window => {
    const choices = history.filter(record => typeof record?.id === 'string' && record.id.startsWith(`action:${window}:protagonist:`));
    const pass = unique(history, `pass:${window}:protagonist`);
    if (!choices.length) return !!pass && unique(all, pass.id) === pass && pass.kind === 'pass' && pass.year === window
      && pass.status === 'confirmed' && pass.parentId === null && pass.sourceActionId === null && pass.reality === 'R1'
      && agrees(pass, 'actorId', 'protagonist');
    if (choices.length !== 1 || pass) return false;
    const action = choices[0], parts = action.id.split(':');
    return parts.length === 5 && /^[A-H][1-8]$/.test(parts[3]) && !!parts[4]
      && unique(all, action.id) === action && action.kind === 'action' && action.year === window
      && action.cellId === parts[3] && action.status === 'confirmed' && action.parentId === null
      && action.sourceActionId === action.id && action.reality === 'R1'
      && agrees(action, 'actorId', 'protagonist') && agrees(action, 'actionId', parts[4]);
  };
  const targetsBefore = before => {
    const candidates = institutions.filter(item => item?.cellId === 'D4'
      && (!Number.isInteger(item.startYear) || item.startYear < before));
    const carriers = candidates.map(carrierFor).filter(Boolean);
    const earlierSources = events.filter(event => event?.cellId === 'D4' && BUILDS.includes(event.actionId));
    const earlierChoices = history.filter(record => record?.kind === 'action' && record.cellId === 'D4'
      && typeof record.id === 'string' && BUILDS.some(actionId => record.id.endsWith(`:${actionId}`)));
    const known = windowKnown(0) && windowKnown(10) && candidates.length === carriers.length
      && earlierSources.every(event => carriers.some(carrier => carrier.source.event === event))
      && earlierChoices.every(action => carriers.some(carrier => carrier.source.action === action));
    return { known, carriers };
  };
  return { history, events, institutions, all, year, validYear, sourceFor, carrierFor, targetsBefore };
}

function priorArrangement(reader, carriers) {
  const rebuilding = carriers.find(carrier => carrier.source.event.actionId === 'restore_archive');
  if (rebuilding) return {
    text: `第${rebuilding.source.event.year}年重建记录写的是新的维护小组，没有指定苏岚接班。停用这项地方制度，不能解释成她一人离开就无人维护。`,
    records: [rebuilding.source.action, rebuilding.source.outcome],
  };
  const renewal = reader.events.map(reader.sourceFor).find(source => source?.event.actionId === 'renew_charter');
  if (renewal && carriers.some(carrier => carrier.institution.kind === 'station' && carrier.institution.startYear < renewal.event.year)) return {
    text: `第${renewal.event.year}年续约记录写明林澈留下带教，没有指定苏岚接任。此次停用的制度后果，也不能改写成苏岚是唯一维护者。`,
    records: [renewal.action, renewal.outcome],
  };
  return { text: '苏岚是否曾同意接班，要另查个人同意与实际岗位来源；这份迁任合同和停运结果本身都不能证明她的任职。', records: [] };
}

/** Public contract clarification, detached from the simulation and its RNG. */
export function getRelocationContract(state) {
  if (state?.year !== 20) return null;
  const reader = readSources(state), targets = reader.targetsBefore(21);
  const prior = priorArrangement(reader, targets.carriers);
  const scope = targets.known
    ? targets.carriers.length
      ? `目前可核实的河港目标：${targets.carriers.map(({ institution }) => institution.kind === 'station' ? '测站' : '档案站').join('、')}。已停运的制度不会被算作一次新的停运。`
      : '此前选择与机构来源中没有河港测站或档案站；迁任不会凭空建成测站，也不能记下一次不存在的停运。'
    : '河港目标的来源不完整，不能把缺页写成没有制度，也不能为其补写停运过程。';
  const summary = `${RULE}${scope}${prior.text}`;
  return { title: '迁任同时结束什么', status: targets.known ? 'recorded' : 'unknown', summary,
    detail: [RULE, scope, prior.text, '这是既定合同的后果说明，不是新增的财政或人事剧情；已存历史不会因此补写。'],
    targets: targets.carriers.map(({ institution, source }) => ({ id: institution.id, kind: institution.kind, cellId: 'D4', sourceRecordId: source.outcome.id })),
  };
}

/** Annotation beside the original outcome. No historical text is replaced. */
export function getRelocationHistory(state, recordId = null) {
  const reader = readSources(state);
  const pattern = /^resolved:event:action:20:(protagonist|linche):D4:relocate_teacher$/;
  const candidates = reader.history.filter(record => typeof record?.id === 'string' && pattern.test(record.id));
  if (recordId !== null && (typeof recordId !== 'string' || !pattern.test(recordId))) return null;
  if (recordId === null) {
    if (!candidates.length) return null;
    recordId = candidates[0].id;
  }
  const original = unique(reader.history, recordId);
  if (!reader.history.some(record => record?.id === recordId)) return null;
  const source = reader.sourceFor(unique(reader.events, original?.parentId));
  const school = source && unique(reader.institutions, `institution:${source.event.id}:E4`);
  const verified = source && source.event.actionId === 'relocate_teacher' && source.outcome === original && candidates.length === 1
    && school?.kind === 'school' && school.cellId === 'E4' && school.sourceEventId === source.event.id
    && school.sourceActionId === source.action.id && school.startYear === source.event.year;
  const title = '迁任合同与河港停运';
  const explanation = '保留原始兑现措辞；以下分开说明可核实来源、既定合同后果与未记录的经过。';
  if (!verified) {
    const summary = '迁任的行动、兑现或东岸学校来源缺失或不一致。不能仅凭原文或今天河港停运，就把任何制度停运归因于这次迁任。';
    return { title, explanation, status: 'unknown', summary, detail: [summary, LIMIT, BOUNDARY],
      context: null, processNote: LIMIT, original: original ? structuredClone(original) : null, sources: [], targets: [] };
  }
  const targets = reader.targetsBefore(source.event.year), prior = priorArrangement(reader, targets.carriers);
  const summary = !targets.known
    ? `第${source.event.year}年的迁任兑现与东岸学校可以核实，但河港目标的来源不完整；不能由当前停运状态补出受影响的制度。`
    : targets.carriers.length
      ? `第${source.event.year}年迁任兑现。按既定合同，当时已有的河港${targets.carriers.map(({ institution }) => institution.kind === 'station' ? '测站' : '档案站').join('、')}同时列入停用范围；这不证明它们此前都在运行，也不是苏岚个人能力造成的停运。`
      : `第${source.event.year}年迁任兑现，东岸新增学校；可核实的此前选择与机构来源中没有河港测站或档案站，不能把这次迁任记成一座测站的停运。`;
  // The original outcome is already beside this annotation, so source links
  // lead to its action or earlier origins rather than back to this same card.
  const sources = [source.action, ...targets.carriers.flatMap(carrier => [carrier.source.action, carrier.source.outcome]), ...prior.records];
  return { title, explanation, status: targets.known ? 'recorded' : 'unknown', summary,
    detail: [summary, RULE, prior.text, LIMIT, BOUNDARY], context: prior.text, processNote: LIMIT, original: structuredClone(original),
    sources: structuredClone(sources.filter((record, index) => sources.findIndex(item => item.id === record.id) === index)),
    targets: targets.carriers.map(({ institution, source: origin }) => ({ id: institution.id, kind: institution.kind, cellId: 'D4', sourceRecordId: origin.outcome.id })),
  };
}
