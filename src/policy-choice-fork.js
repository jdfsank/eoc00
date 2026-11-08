import {isBranchAccessRulesVersion} from './branch-access.js';
import {getActions, getActors, getPublicPlanningStateIssues, getHandoffReadiness,
  usesTradeoffs, usesHandoffRules, usesLegacyCrisisRules, hasCompletedRecovery,
  hasCompletedFutureCheck, hasCompletedArchiveUpgrade, RECOVERY_RULES,
  FUTURE_CHECK_RULES, ARCHIVE_UPGRADE_RULES, PORT_ACCESS_RULES} from './simulation.js';

const contracts = {
  share_power: ['有准备的地区可自治并互相复核。', '没有独立网络与地方信任，权利将停留在纸上。'],
  central_review: ['保留应急协调能力，承担持续维护责任。', '集中依赖仍然存在；缺少独立复核时结局脆弱。'],
  withdraw: ['已建立的学校与互助制度继续自行运作。', '若人手不足，退出会造成服务空缺。'],
};

// Read public present conditions only. A signature is not a future success;
// neither pending contracts nor locked drafts count as completed capability.
export function getPolicyChoiceFork(state, cellId, actorId = 'protagonist') {
  try {
    if (!state || state.year !== 30 || state.phase !== 'planning' || cellId !== 'D4'
      || !usesTradeoffs(state) || !usesHandoffRules(state) || usesLegacyCrisisRules(state)
      || getPublicPlanningStateIssues(state).length) return null;
    for (const [key, rules] of [['recoveryRulesVersion', RECOVERY_RULES],
      ['futureCheckRulesVersion', FUTURE_CHECK_RULES], ['archiveUpgradeRulesVersion', ARCHIVE_UPGRADE_RULES],
      ['portAccessRulesVersion', PORT_ACCESS_RULES]]) {
      if (state[key] !== undefined && state[key] !== rules.version) return null;
    }
    if (state.branchAccessRulesVersion !== undefined && !isBranchAccessRulesVersion(state.branchAccessRulesVersion)) return null;
    if (['trust', 'renewed'].some(key => state.flags[key] !== undefined && typeof state.flags[key] !== 'boolean')) return null;
    const actor = getActors(state).find(item => item.id === actorId);
    if (!actor || !actor.name.trim()) return null;
    const actions = getActions(state, cellId, actorId);
    if (actions.length !== 3 || new Set(actions.map(a => a.id)).size !== 3
      || actions.some(a => !Object.hasOwn(contracts, a.id) || a.dueIn !== 1 || a.probability !== 1
        || a.reward !== contracts[a.id][0] || a.risk !== contracts[a.id][1])) return null;
    const readiness = getHandoffReadiness(state);
    const hasArchiveMethod = readiness.checks.some(check => {
      const carrier = state.institutions.find(item => item.id === check.id);
      return state.events.some(event => event.id === carrier?.sourceEventId
        && event.sourceActionId === check.sourceActionId
        && event.actionId === 'preserve_records' && event.status === 'success');
    });
    const commandCheck = state.flags.review
      ? '已有成功纠正共同标准的复核记录；集中协调仍承担持续维护责任。'
      : hasCompletedRecovery(state) || hasCompletedFutureCheck(state) || hasCompletedArchiveUpgrade(state)
        ? '已有完成的后续指令校验；不改写第23年的损失。'
        : hasArchiveMethod ? '地方保档已提供交班方法，但尚无完成的指令复核。'
          : '尚无完成的指令复核；签署集中方针不会自动完成复核。';
    return {
      timing: '第31年签署方针，不等于交班成功。',
      assessment: '第40年按真实存续条件核对；当前条件不会提前兑现未来。',
      choices: actions.map(action => {
        const missing = action.id === 'share_power' ? readiness.shareMissing : readiness.missing;
        return {
          actionId: action.id,
          effect: action.reward,
          responsibility: action.risk,
          current: action.id === 'central_review' ? commandCheck
            : `${missing.length ? missing.join('；') : action.id === 'share_power'
              ? '跨地承接人手、地方授权、异源校验与河港信任齐备' : '跨地承接人手、地方授权与异源校验齐备'}。`,
        };
      }),
    };
  } catch {
    return null;
  }
}
