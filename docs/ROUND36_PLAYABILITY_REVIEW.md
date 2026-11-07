# Round 36 playability review

## Before evidence

An independent candidate-5 Chromium audit loaded an engine-generated seed-0 year-20 save (year 0 passed; Linche voluntarily recruited at year 10), selected Linche at D4, and activated “先看方案 · 免费”. At 390 × 844 the complete refusal was above the viewport: top −299.58px, bottom −13.59px. The focused “方案与取舍” heading was visible, while the directory contained no executor-boundary explanation. The original viewport image was inspected, not inferred from DOM geometry alone.

The audit's local files are `round36-story-audit/audit.mjs`, `result.json` and `candidate5-choice-jump-390.png` beside the working repository. These are review inputs, not published browser certification.

## Integrated implementation review

The new compact notice is inside `[data-planning-choices]`, before the contract directory, so the existing fast jump reaches it. The complete refusal text and its existing source button remain above the choices. The new local links connect the two regions without opening a contract or changing the selected character.

`navigateActorAgency` requires a known direction, the correct origin region, exactly one destination and the same `.scene-planning-page` for both. It focuses with `preventScroll` and then scrolls the destination into view. Main handles the links only on the AVG screen and supplies its existing repeated-pointer guard with the successful focus destination. The helper itself does not change saved state, URL, history, evidence or draft data.

CSS wraps long text and controls without fixed-height text containers. Both destinations and controls have explicit focus outlines; controls have a minimum height of 48px. These are inspected implementation properties, not a claim that every device or assistive technology has been tested.

## Completed verification at this review

- Five `actor-agency-view.test.js` tests passed: exact title/current boundary, absent or ambiguous inputs, escaping, both navigation directions, and invalid/out-of-scope/missing/duplicate targets.
- `simulation.js` and `story.js` compared equal to the immutable baseline.
- The candidate-5 before screenshot and viewport measurements were inspected.

The final integrated browser route matrix, screenshot hashes, source-manifest checks and full aggregate results are separate verification artifacts. This review does not anticipate their results. No human playtest, physical-device or screen-reader certification is claimed.

## 最终三方面判断与验证

视觉以金色边注区分人物立场与可选合同；玩法将不可补证解锁的个人限制放到决策入口，并保留主角自由；叙事以原理由和实际来源保持人物动机与同意边界。四种移动字号组合均能从方案、正文和取证入口到达提示，双向阅读、来源返回及合成重复触屏保持完整世界与自动存档不变。

最终冻结后，2865单测、构建、单次67套浏览器20181项、888矩阵、644组自然对照与10组角色机会成本通过。新专项582项/41图；独立104项/28原图，五图逐字复制保存。所有旧脚本和单测无修改。正式源码hash、完整冻结和失败边界见[验收记录](round36-verification.json)。

320px200%边注约533px高，目录由约150下移到727px；这换来了快速进入方案时首先知道她的执行边界，不宣称完整目录首屏可见。原完整理由仍可读，不增加新人物承诺、历史结果或数值规则。初次新专项的28px来源回程差异未最终归因，保留失败证据，之后采用真实激活时原处的严格比较重新完整执行。候选5启动前CI失败与候选3白页仍无已知根因，新准确SHA必须另验。
