import { getTrainingAuthorizationContracts } from './training-authorization.js';
import { getEnding } from './simulation.js';
import { getDecadeReview } from './decade-review.js';
import { characterEpilogue } from './story.js';
import { getLocalCrisisRecord } from './local-crisis-record.js';

const POLICIES = ['share_power', 'withdraw', 'central_review'];
const MISSING = {
  '缺少运转中的培训或教学人手': '尚缺运转中的教学人手',
  '现有人手尚缺地方承接授权': '现有人手仍缺地方承接授权',
  '缺少成功工作的异源校验载体': '尚缺有效的异源校验',
  '人手与校验仍在同一地域，缺少跨地承接关系': '人手与校验尚未跨地衔接',
};
const RESPONSIBILITIES = {
  authorize_training: '承接权只属于获授权的原学徒；没有增加教学人手，也不替其他地方签名。',
  train_network: '培训增加了维护人手；它不能替代异源校验，也不保证今后一直有人维护。',
  mutual_aid: '这项安排支持后续生计；轮值仍需经费与人手。',
  open_port_warning: '基本预警的开放仍依赖原分站运转，没有因此新增教学或校验。',
  complete_review: '原来的复核失败仍留在原页；后来完成的工作只面向未来指令。',
  establish_future_check: '这是另行建立的未来校验，不补写此前已有校验，也不附送承接授权。',
  upgrade_archive_check: '原档原页保留；新增指令校验没有增加第二个地域或承接授权。',
  share_power: '方针已经签下；实际承接仍需人手、独立校验与地方合作。',
  withdraw: '结束独占控制没有结束服务责任，地方仍需实际承接。',
  central_review: '协调权保留下来，仍需允许独立纠错并持续维护。',
};

// The decade reader establishes the choice/result relationship. This final-page
// adapter additionally withholds links or claims with cross-table identities,
// future records, or another reality. It never rewrites the stored records.
function readableRecord(state, id, throughYear) {
  const records = [...state.history, ...state.events];
  const matches = records.filter(row => row?.id === id);
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (!state.history.includes(row)) return null;
  let current = row, childYear = throughYear;
  const seen = new Set();
  while (current) {
    if (seen.has(current.id) || !Number.isInteger(current.year) || current.year > childYear
      || (current.reality !== undefined && current.reality !== 'R1')) return null;
    seen.add(current.id);childYear=current.year;
    if (current.parentId === null || current.parentId === undefined) return row;
    const parents = records.filter(record => record?.id === current.parentId);
    if (parents.length !== 1) return null;
    current = parents[0];
  }
  return null;
}

function intervention(state, card, start, end) {
  const sourceIds = card.sourceIds.filter(id => id !== 'crisis-impact' && readableRecord(state, id, end));
  const source = sourceIds.map(id => readableRecord(state, id, end)).find(row =>
    row.kind === 'action' && row.id.startsWith(`action:${start}:${card.actorId}:`));
  const passed = sourceIds.includes(`pass:${start}:${card.actorId}`);
  const actionId = source ? source.id.split(':')[4] : null;
  const resultId = source && `resolved:event:${source.id}`;
  const result = resultId && sourceIds.includes(resultId) ? readableRecord(state, resultId, end) : null;
  const status = result ? {outcome:'success', failure:'failed', cancelled:'cancelled'}[result.kind] || 'unknown'
    : passed ? 'passed' : 'unknown';
  let choice = card.choice, outcome = card.outcome, responsibility;
  if (!source && !passed) {
    choice = `第${start}年，${card.name}的选择记录缺失或不一致。`;
    outcome = '这次介入的选择与结果未知，不从当前机构补写。';
    responsibility = '缺页保留为未知，不替过去作出选择。';
  } else if (status === 'unknown') {
    outcome = '兑现记录缺失或不一致，结果未知。';
    responsibility = '提交过的选择仍在，不能把缺失的结果写成成功或取消。';
  } else if (status === 'passed') {
    responsibility = '这一窗口没有新增合同，已有的责任没有随之结束。';
  } else if (status === 'cancelled') {
    responsibility = actionId === 'authorize_training'
      ? (getTrainingAuthorizationContracts(state).some(c=>c.sourceActionId===source.id&&c.status==='cancelled'&&c.workload)?'已付协商成本不退；取消没有替原学徒补上签名，也没有执行拟议的职责改排。':'已付协商成本不退；取消没有替原学徒补上签名。')
      : '已付成本与取消记录保留；未完成的工作没有被写成已经落实。';
  } else if (status === 'failed') {
    responsibility = '已付成本与失败记录保留，不能把后来建设写成当时成功。';
  } else if (actionId === 'authorize_training' && getTrainingAuthorizationContracts(state).some(c=>c.sourceActionId===source.id&&c.status==='success'&&c.workload)) {
    const contract=getTrainingAuthorizationContracts(state).find(c=>c.sourceActionId===source.id&&c.status==='success'&&c.workload);
    const target=state.institutions.find(i=>i.id===contract.target.id);
    const known=target&&typeof target.active==='boolean'&&Number.isFinite(target.maintenance)&&target.maintenance>=0&&target.maintenance<=1;
    responsibility='议事和生计协调占用了深入带教，基本读尺与预警仍列在职责内；这不是给权利打分，也没有新增人手或替其他地方签名。'+(!known?'原点当前运转情况未知，不能从签署推定今天仍有来源。':!target.active||target.maintenance===0?'原点当前停运，已签记录保留，当前不再提供年度来源。':`当前政治、经济来源提高，科学来源降低，宗教不变；实际仍乘维护系数${target.maintenance}，不保证今后一直运转。`);
  } else responsibility = RESPONSIBILITIES[actionId] || '已兑现的安排仍需维护，不代替其他地方作出承诺。';
  return {actorId:card.actorId, name:card.name, actionId, cellId:source?.cellId || null,
    status, choice, outcome, responsibility, sourceIds:source || passed ? sourceIds : []};
}

function openingFor(state, cards, ending) {
  const protagonist = cards.find(card => card.actorId === 'protagonist');
  const policy = protagonist?.status === 'success' && POLICIES.includes(protagonist.actionId)
    ? protagonist.actionId : null;
  if (!policy) {
    if (cards.some(card => card.status === 'unknown')) return '最后一次介入仍有缺页；这份末页只保留能核实的选择与结果。';
    if (cards.some(card => card.status === 'success')) return '最后一次介入留下了已兑现的工作，但这一阶段没有签署新的治理方针。';
    if (cards.some(card => card.actionId)) return '最后一次介入的安排与未完成之处都留了下来；这一阶段没有签署新的治理方针。';
    return '这一轮没有再安排介入，已有的工作与未补上的缺口仍留在地方。';
  }
  if (ending.policy !== policy) return '方针的签署与当前结局记录不一致；已经核实的个人选择仍分别保留。';
  if (policy === 'central_review') return ending.title === '仍亮着灯的续史局'
    ? '续史局保留协调权，已有校验可以审查指令；这份安排仍要靠人持续维护。'
    : '续史局保留协调权，但共同标准还缺少有效复核；秩序没有替代纠错。';
  const ready = ending.handoff;
  if (ready) {
    const missing = policy === 'share_power' ? ready.shareMissing : ready.missing;
    if (missing.length) return `${policy === 'share_power' ? '共享纠错权' : '退出独占控制'}的方针已经签下；${missing.map(reason => MISSING[reason] || reason).join('；')}。`;
    return policy === 'share_power'
      ? '获得授权的人手、跨地校验与地方合作，让共享纠错权有了实际承接。'
      : '获得授权的人手与跨地校验接住了退出后的责任，地方不再只有一名守夜人。';
  }
  // Genuine older saves retain their own ending rules. Do not retroactively
  // impose a local-mandate test that their issued contracts did not contain.
  const positive = ['许多人签署的历史', '没有唯一守夜人'].includes(ending.title);
  return positive
    ? `${policy === 'share_power' ? '共享纠错权' : '退出独占控制'}已有本局原规则下的实际支撑；维护与纠错仍要继续。`
    : `${policy === 'share_power' ? '共享纠错权' : '退出独占控制'}的方针已经签下，本局原规则要求的承接条件仍有缺口。`;
}

function historicalNoteFor(state) {
  const records = ['D4', 'E4', 'D5', 'F6'].map(cellId => getLocalCrisisRecord(state, cellId));
  if (!records.some(record => record?.recordId === 'crisis-impact')
    || !readableRecord(state, 'crisis-impact', 40)) return '第23年清点原件缺失或不一致，历史结果未知；不从今天的制度补写过去。';
  if (records.some(record => record.status === 'loss')) return '第23年记下的地方损失仍留在原页；后来建成的服务与新的签名没有改写它。';
  if (records.every(record => record.status === 'zero')) return '第23年四地已存共同失效损失系数为0；这不是没有洪水，也不是未来安全的保证。';
  const damage = state.flags?.crisis?.damage;
  if (Number.isFinite(damage) && damage > 0 && damage <= 1) return '第23年已存整体结算记有损失，逐地明细不全；后来的工作没有改写这一页。';
  if (damage === 0) return '第23年已存整体损失系数为0，逐地明细不全；不据此补写各地经过或未来安全。';
  return '第23年清点原页仍在，损失明细不全；这份末页不从今天的制度补写过去。';
}

// Presentation only: no new ending score, policy, history, action, or save field.
export function getEndingRecollection(state) {
  if (state?.year !== 40 || state?.phase !== 'ended') return null;
  if (![state.history, state.events, state.institutions, state.actors, state.cells].every(Array.isArray)) return null;
  const review = getDecadeReview(state);
  const lastInterventions = (review?.cards || []).map(card => intervention(state, card, 30, 40));
  const policy = lastInterventions.find(card => card.actorId === 'protagonist'
    && card.status === 'success' && POLICIES.includes(card.actionId));
  const ending = policy ? getEnding(state) : null;
  const people = characterEpilogue(state, {includeDeploymentRecollections:false});
  // Keep the companion's earlier crisis-window work without copying the whole
  // decade card or repeating the final intervention and the year23 settlement.
  const linche = people.find(person => person.name === '林澈');
  const recruited = linche?.sources.some(id => /^resolved:event:action:10:protagonist:D4:recruit_(successor|risk|volunteer)$/.test(id));
  if (recruited) {
    const earlierState = {year:30,phase:'planning', history:state.history, events:state.events,
      institutions:state.institutions,actors:state.actors,cells:state.cells,flags:state.flags};
    const card = getDecadeReview(earlierState)?.cards.find(card => card.actorId === 'linche');
    if (card) {
      const earlier = intervention(state, card, 20, 30);
      linche.paragraphs.push(`${earlier.choice}${earlier.outcome}`);
      linche.sources = [...new Set([...linche.sources, ...earlier.sourceIds])];
    }
  }
  for (const person of people) person.sources = person.sources.filter(id => readableRecord(state,id,40));
  const recordNote = ending?.title === '纸上的共同作者' && ending.handoff
    ? `原结局评语采用概括口径；本页按当前记录分别核对人手、地方授权、异源校验、跨地承接与河港合作。实际缺口：${ending.handoff.shareMissing.map(reason => MISSING[reason] || reason).join('；') || '当前记录未列出缺口'}。`
    : null;
  return {opening:openingFor(state,lastInterventions,ending), lastInterventions, people,
    historicalNote:historicalNoteFor(state), recordNote};
}
