// A prospective rule, independent of crisis accounting and later negotiations
// to open an existing branch. Reading this module never identifies a producer,
// inspects hidden rolls, or changes an institution's saved access status.
export const BRANCH_ACCESS_RULES = Object.freeze({
  public: 'public-branch-v1', source: 'source-branch-v1', version: 'source-branch-v1',
});
export const isBranchAccessRulesVersion = version => [BRANCH_ACCESS_RULES.public, BRANCH_ACCESS_RULES.source].includes(version);

export function getBranchAccessRulesVersion(state) {
  if (state.branchAccessRulesVersion !== undefined) {
    if (!isBranchAccessRulesVersion(state.branchAccessRulesVersion)) throw new Error('分站准入规则版本非法');
    return state.branchAccessRulesVersion;
  }
  // Missing fields cannot distinguish a genuinely original save from one
  // continued by a later engine. This chooses future policy, not provenance.
  return state.crisisRulesVersion === 'coverage-v1' ? BRANCH_ACCESS_RULES.source : BRANCH_ACCESS_RULES.public;
}

export function getBranchAccessRulesDescription(state) {
  const publicBranch = getBranchAccessRulesVersion(state) === BRANCH_ACCESS_RULES.public;
  const scope = publicBranch
    ? '公开分站规则：以后按原建站链生成的F6分站公开，商会来源也不设缴费门槛。'
    : '来源分站规则：以后按原建站链生成的F6分站，商会来源收费，官署与联合来源公开。';
  const version = state.branchAccessRulesVersion === undefined
    ? '未保存独立分站准入版本，按本局危机规则身份采用之后结算的兼容默认；这不是对曾用引擎的鉴别，旧档可能已经混合续跑。'
    : '本局已明确保存独立分站准入版本。';
  return scope + version + '只用于尚未兑现且来源条件仍成立的分站创建；已存准入、合同原文、通道、快照、危机与历史不重算，停运机构和已取消建设不会因此复活。这不是完整回滚旧引擎。';
}

const buildActions = ['build_merchant', 'build_state', 'build_joint'];
export function isBranchBuildSource(source) {
  return buildActions.some(actionId => source === actionId || source === `action:0:protagonist:D4:${actionId}`);
}

/**
 * Describe only prospective creation, not an existing institution. Accept a
 * canonical build action ID or its exact original-chain source action ID.
 * Unknown/suffixed/lookalike IDs receive no prediction or source attribution.
 * Callers describing a saved branch must use its actual saved `open` field.
 */
export function getFutureBranchAccess(state, source) {
  const rulesVersion = getBranchAccessRulesVersion(state);
  const explicit = state.branchAccessRulesVersion !== undefined;
  if (!isBranchBuildSource(source)) return {
    rulesVersion, explicit, sourceKnown: false, open: null, merchant: null, label: '来源未核实',
    description: '未核实为原建站链的规范来源，不能据此说明未来分站公开或收费；旧来源继续沿用既有兼容行为，不补写资助来源或准入事实。',
  };
  const merchant = source === 'build_merchant' || source === 'action:0:protagonist:D4:build_merchant';
  const open = rulesVersion === BRANCH_ACCESS_RULES.public || !merchant;
  return {
    rulesVersion, explicit, sourceKnown: true,
    open, merchant, label: open ? '公开' : '收费',
    description: `若原建站与教学链成功，且来源E4培训点在第12年仍运转，本局之后生成的同源F6分站${open ? '公开服务，不设缴费门槛' : '沿用商会收费准入'}。这是未来条件说明，不是已经兑现；既有分站以实际保存的准入状态为准。`,
  };
}
