// Presentation only. These labels describe what a UI step does, not a saved
// contract or an outcome. Never use them to replace history/event text. The
// optional state is consulted only for phase, including stale saved UI routes.
const STAGES = Object.freeze({
  preview: Object.freeze({
    eyebrow: '方案预览',
    title: null,
    summary: '先读清这份安排，再决定是否调查或锁定。',
    status: '免费预览，不改动原有安排',
    caution: '阅读不取证、不花调查轮次，也不支付介入成本。',
    primaryLabel: '继续核对这项任务',
    backLabel: '返回现场',
  }),
  confirm: Object.freeze({
    eyebrow: '锁定审阅',
    title: null,
    summary: '核对这位介入员将承担的工作，以及这份安排留下的代价。',
    status: '这一步只保存草稿',
    caution: '锁定不支付成本、不建立制度，也不揭示随机结果。整轮提交前仍可修改；已花的调查轮次不会退回。',
    primaryLabel: '锁定草稿，核对本轮安排',
    backLabel: '返回方案，暂不锁定',
  }),
  window: Object.freeze({
    eyebrow: '本轮安排',
    title: '下一次见面，是十年以后。',
    summary: '先看清谁去做什么，再一起提交。每份安排都要有人承担，锁定还不是兑现。',
    status: '草稿尚未提交，介入成本尚未支付',
    caution: '提交会一次性支付本轮成本、登记承诺并保存，年份不会立即跳转。之后由你逐年播放或前往下一窗口，不能返回重掷。',
    primaryLabel: '统一提交，进入逐年演变 →',
    backLabel: '返回世界',
  }),
  playback: Object.freeze({
    eyebrow: '年度演变',
    title: '余波，正在发生。',
    summary: '本轮安排已经提交。承诺仍要等到约定年份核对，写下计划不等于工作已经完成。',
    status: '已提交，按约定年份兑现',
    caution: '逐年推进才结算下一年；播放速度不会改变结果。是否成功或取消，以届时留下的记录为准。',
    primaryLabel: '到下一窗口 →',
    backLabel: '暂停并查看世界',
  }),
});

export function getDecisionStageCopy(stage, state = null) {
  if (!Object.hasOwn(STAGES, stage)) return null;
  const copy = { ...STAGES[stage] };
  if (stage === 'window' && state && state.phase !== 'planning') {
    copy.summary = '这已经不是可修改的介入窗口。已提交的安排与实际结果，请分别查阅原始记录。';
    copy.status = state.phase === 'playback' ? '本轮已提交' : state.phase === 'ended' ? '这段历史已结束' : '当前不在介入窗口';
    copy.caution = '这里不能再次支付、提交或改写已经发生的记录。';
  }
  return copy;
}

export function getLockedOutcomeLabel() {
  return '若合同兑现的目标';
}

// Brief prospective responsibility, not a second rule explanation. Actor,
// location, costs, chance, due year and conditional cancellation remain in the
// actual contract. No quotations or personal experiences are invented here.
const RESPONSIBILITIES = Object.freeze({
  build_merchant: '预警先送到谁手里、以后由谁维护，是资助安排一并留下的责任。',
  build_state: '统一指令之外，还要给当地的人留下核对错误与持续维护的条件。',
  build_joint: '共同署名不会替任何人完成值班；公开资料仍需要有人长期照料。',
  preserve_records: '留下不同的记录，是给后来的人保留核对的依据，不是替他们预先作出结论。',
  renew_charter: '这项安排把林澈的下一段时间留在当地，经费与带教仍需要有人持续承担。',
  recruit_volunteer: '邀请的是林澈本人；她的同行，不等于地方已经有人接手新的工作。',
  recruit_successor: '邀请林澈同行，也要为接班的人留出真实的岗位与条件。接班有人，经费仍是另一份责任。',
  recruit_risk: '同行的选择不替地方补上接班人；已有工作的空缺仍要有人面对。',
  restore_archive: '重新开门之后，记录与仪器还需要有人照料；新的工作不会补回错过的十年。',
  fund_school: '让更多人学会读尺，也是在为他们留出选择如何承担地方工作的机会。',
  mutual_aid: '互助要把经费和轮值一起安排，不能把居民的愿意合作当成无限的免费劳动。',
  free_warning: '预警要送到不缴费的家庭，也需要有人持续值班；免费的服务并非没有成本。',
  present_archive: '旧档可以成为谈话的起点，不能替今天的苏岚决定她愿意承担什么。',
  relocate_teacher: '把岗位写进命令，不等于获得苏岚的同意；这份决定的责任不能交给她承担。',
  independent_review: '独立记录要由真实的人及时核对；调查得到材料，还不是已经纠正了指令。',
  local_veto: '让居民能够拒绝错误指令，也要正视尚未修正的水位标准。',
  train_network: '新的课堂要有人带教；让人学会记录，不等于已经替他们决定了接班责任。',
  authorize_training: '已有学徒可以受邀讨论承接责任；会读尺，不等于已经同意接班。',
  complete_review: '接续这份工作，是为今后留下校验能力，不是把曾经的失败改写成及时完成。',
  establish_future_check: '筹备新的校验席，还要等真实的人来持续读尺和比对；器具不会自行完成工作。',
  upgrade_archive_check: '保住旧刻度的人与接着校验的人，需要把下一段工作接好，而不是替过去重写结论。',
  open_port_warning: '取消缴费门槛之后，预警仍要有人测量和传递；开放不能替代持续的维护。',
  share_power: '共享纠错权，需要真实的维护者和地方同意；签署方针不能替大家完成这些工作。',
  central_review: '留下集中协调，也留下持续维护与接受复核的责任，不能把权力当作永远正确的保证。',
  withdraw: '把决定权留给地方，也不能把尚未安排的工作当作已经有人接手。',
});

export function getActionResponsibility(actionId) {
  return Object.hasOwn(RESPONSIBILITIES, actionId)
    ? RESPONSIBILITIES[actionId]
    : '选择这项安排，也要把它留下的工作和代价一并记住。';
}
