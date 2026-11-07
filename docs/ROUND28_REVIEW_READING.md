# 第28轮：合同记录与全局清点分栏阅读

新只读模块 `review-reading-context.js` 依赖原 `getReviewHistory` 的来源验证，不修改该模块、故事、模拟、存档或历史producer。

## 返回结构

`getReviewReadingContext(state, recordId = null)` 无相关记录时返回null；否则返回：

- `history`：完整原回顾，保留原始summary、原文、说明、详细来源和清点数字。
- `heading`、`resultHeading`、`resultNote`：展示标题与边界说明。
- `results`：仅来自已核实responses。每行保留eventId、recordId、sourceActionId、cellId、year、status、label、note，新增明确的statusLabel。待兑现、成功、失败、取消独立呈现；原合同标签继续区分冲击前异源复核、后续遗留校验、从零未来校验、地方保档升级。
- `settlement`：status、label、summary。零损失与未知清点使用中性措辞；实际损失与未结算逐字保留原summary。

指定来源时，原始来源必须唯一可核实，结果行只匹配该来源的eventId、sourceActionId或recordId。不能拿另一地的成功替代本项缺失结果。总体回顾可列所有已核实合同，但来源不全仍提示未知，不宣称清单完整。来源原文、详细说明和所有原链接由history提供。

## 叙事与图文边界

成功复核不应以前景通用失败警告开场。合同页说明确实完成或尚待兑现的工作，清点页独立说明第23年的已存结算。这是阅读层次调整，不是新奖励或追认保护。

零损失只是原型损失系数，不代表没有洪水或永远安全。后续校验不追认冲击前成功，也不撤销原失败与损失。未知清点不能由本地成功或失败补写。图形不可从系数猜测房屋毁损、伤亡或重建。

## 验证

专项测试使用当前与历史真实producer，覆盖待办、成功、失败、取消、混合局、新建和升级。深冻结与逐字状态比较保证只读，原回顾全文深等不变；指定来源、重复身份、跨表冲突、缺失结果与未知全局清点单独验证。冲突用例只在独立单测对象上构造，不作为自然游玩截图。
