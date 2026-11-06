import {
  getActions, getEvidenceIds, getRecruitmentRoles, getTrainingAuthorizationPlan,
  getArchiveUpgradePlan, getFutureCheckPlan, getRecoverySource, usesRecoveryRules,
  usesTradeoffs, PORTABLE_EVIDENCE,
} from './simulation.js';

// Public labels are separate from evidence prose. Reading a title or a question
// must never open the material, speak for a resident, or resolve a contract.
export const EVIDENCE_TITLES = Object.freeze({
  evacuation_routes: '逐户核实撤离路线',
  independent_flood_records: '比对修会的旧洪水记录',
  unfunded_maintenance: '打开商会的经费账簿',
  successor_consent: '商量培训与继任条件',
  anomaly_records: '交叉核对远港的异常曲线',
  old_reality_record: '阅读 R0 的教师履历',
  resident_testimony: '听取岸边居民的证词',
});

export function evidenceTitleFor(state, id, cellId = 'D4', actorId = 'protagonist') {
  if (cellId === 'E4' && id === 'resident_testimony' && getTrainingAuthorizationPlan(state, cellId).available) return '听取原学徒的承接条件';
  if (cellId === 'B4' && state.year === 30 && ['anomaly_records', 'resident_testimony'].includes(id)) {
    if (getArchiveUpgradePlan(state).available) return id === 'anomaly_records' ? '重读保档中的异源刻度' : '听取修院居民对保档升级的条件';
    if (getFutureCheckPlan(state).available) return id === 'anomaly_records' ? '核对未来校验所需的新记录' : '听取修院居民对新校验席的条件';
  }
  if (id === 'anomaly_records' && state.year >= 30 && usesRecoveryRules(state) && getRecoverySource(state, cellId, { requireActive: false })) return '重读未完成的异源校验';
  if (id === 'successor_consent') return getRecruitmentRoles(state).length ? '与苏岚商量培训与接班' : '确认是否有岗位需要交接';
  return EVIDENCE_TITLES[id] || id;
}

const LOCATIONS = ['D4', 'B4', 'E4', 'D5', 'F6'];
const actionRef = action => ({ id: action.id, title: action.title });
const usesMaterial = (state, action, id) => action.requireEvidence.includes(id)
  || (usesTradeoffs(state) && state.year === 20 && action.id === 'local_veto' && id === 'evacuation_routes');

function decisionQuestion(state, cellId, actions) {
  const has = id => actions.some(action => action.id === id);
  if (state.year === 0) return cellId === 'D4'
    ? '更快开站、统一公开预警，还是共同维护？先决定想谈哪种办法，再挑要查的材料。'
    : '把这个十年的名额留给不同的旧刻度，还是先去河港谈建站？';
  if (state.year === 10 && cellId === 'D4') {
    if (!getRecruitmentRoles(state).length) return '邀请林澈同行，还是把这十年的名额留给新的测站？先想清楚这次来访要做什么。';
    if (has('renew_charter')) return '留下林澈续约，还是邀请她同行？如果同行，要先与谁谈清接班的条件？';
    return '邀请林澈同行时，先安排交接，还是承担留下空岗的代价？也可以把名额留给重建。';
  }
  if (state.year === 10 && cellId === 'B4') return '把不同的刻度留下，还是把名额用于河岸的人手与维护？';
  if (state.year === 10 && cellId === 'E4') return '把这一轮留给夜校，还是先回河港处理人手？你想先听清哪一处的需要？';
  if (state.year === 20 && cellId === 'D4') return has('relocate_teacher')
    ? '先谈公开预警、听苏岚回应旧履历，还是执行迁任？你要为哪项决定取证？'
    : '先谈河港的钟报，还是听苏岚如何回应旧履历？这次见面要留下哪一种安排？';
  if (state.year === 20 && ['B4', 'F6'].includes(cellId)) return '争取在冲击前核清标准，还是先把停闸与撤离谈妥？你愿意把调查留给哪一边？';
  if (state.year === 20 && cellId === 'E4') return '先培养接班的人，还是去别处处理眼前的共同标准？这次的名额要留在哪里？';
  if (state.year === 30 && cellId === 'D4') return '把纠错权交给地方、继续集中复核，还是逐步退出？先看看谁能接过下一班。';
  if (state.year === 30 && cellId === 'E4') return has('authorize_training')
    ? '先与原学徒商量承接权，还是另办一组轮值教学？这次取证要为哪条路服务？'
    : '这次要新增一组轮值维护者吗？看看别处的安排，再决定是否把名额留给这里。';
  if (state.year === 30 && cellId === 'B4') {
    if (has('upgrade_archive_check')) return '把保存下来的旧刻度接成新的校验工作，还是把名额留给人手与交班？';
    if (has('establish_future_check')) return '从新的水尺和抄本开始筹备校验，还是先去别处安排接班的人？';
    if (has('complete_review')) return '接着核对未完成的底稿，还是先处理别处的交班？哪一项工作更值得这次留下？';
  }
  if (state.year === 30 && cellId === 'F6') {
    if (has('complete_review') && has('open_port_warning')) return '先接着核对旧底稿，还是与收费窗外的人谈开放预警？一个名额只能接下一项工作。';
    if (has('complete_review')) return '要把未完成的校验接下去吗？先想清楚这一轮要把人手与名额留在哪里。';
    if (has('open_port_warning')) return '要为收费窗外的人商量基本预警吗？这一次开放协商，也会占去别处工作的名额。';
  }
  if (cellId === 'D5') return state.year === 30
    ? '把下一班物资轮值安排在南岸，还是把名额留给别处的交班？'
    : '把这次机会留给南岸的物资与轮值，还是先去别处处理水位和人手？';
  return '这次来访，你想先谈清哪项安排？';
}

function materialQuestion(state, cellId, actorId, id, actions) {
  const has = actionId => actions.some(action => action.id === actionId);
  if (id === 'independent_flood_records') return '官署的刻度之外，还有哪些记录值得比照？';
  if (id === 'unfunded_maintenance') return '建造之外，长期值班的钱由谁承担？';
  if (id === 'successor_consent') return getRecruitmentRoles(state).length
    ? '如果林澈离开，谁愿意接班，又要先谈清什么条件？'
    : '这里究竟有没有需要交接的岗位？';
  if (id === 'evacuation_routes') return '哪些撤离通道需要先走一遍，才能把停闸后的安排做得更细？';
  if (id === 'anomaly_records') return state.year >= 30
    ? '接下来的校验，需要先核对哪些记录？'
    : '不同地方的曲线，究竟有哪些地方需要重新比对？';
  if (id === 'old_reality_record') return state.year === 20
    ? actorId === 'protagonist' ? '你保存的旧履历能提出什么问题，又有哪些话需要问现在的苏岚？' : '主角带来的旧履历能提出什么问题，又有哪些话需要问现在的苏岚？'
    : '这份旧履历能帮助你理解哪一段旧现实？';
  if (id === 'resident_testimony') {
    if (has('authorize_training')) return '哪些承接职责，需要先听原学徒自己的意见？';
    if (has('upgrade_archive_check')) return '在旧保档旁添一张工作席，当地人有什么条件要先谈？';
    if (has('establish_future_check')) return '筹备新的校验席，当地人希望怎样参与？';
    if (has('open_port_warning')) return '收费窗外的人，希望怎样参与预警安排？';
    if (has('free_warning')) return '居民希望怎样收到第一声钟报，轮值又该如何商量？';
    return '当地人希望怎样参与，又有什么条件需要先说清？';
  }
  return '这份材料能帮助你提出什么问题？';
}

// Only public current contracts determine the use of a material. Destination
// lists identify possible uses, not affordability, remaining time or permission
// to submit. Local testimony never becomes portable through this presentation.
export function investigationIntentFor(state, cellId, actorId = 'protagonist') {
  const actions = getActions(state, cellId, actorId);
  if (!actions.length) return null;
  const elsewhere = LOCATIONS.filter(id => id !== cellId && state.cells.some(cell => cell.id === id))
    .map(id => ({ cellId: id, actions: getActions(state, id, actorId) }));
  return {
    question: decisionQuestion(state, cellId, actions),
    evidence: getEvidenceIds(state, cellId, actorId).map(id => {
      const localActions = actions.filter(action => usesMaterial(state, action, id)).map(actionRef);
      const portable = usesTradeoffs(state) && PORTABLE_EVIDENCE.includes(id);
      const destinations = portable ? elsewhere.map(place => ({
        cellId: place.cellId, actions: place.actions.filter(action => usesMaterial(state, action, id)).map(actionRef),
      })).filter(place => place.actions.length) : [];
      return {
        id, title: evidenceTitleFor(state, id, cellId, actorId),
        prompt: materialQuestion(state, cellId, actorId, id, actions),
        usage: localActions.length ? 'local' : destinations.length ? 'portable' : 'background',
        localActions, destinations,
      };
    }),
  };
}
