# 第32轮：CI 截图专属观测

## 证据与边界

第30轮 main `7107021064d045cb27bec59d8e2e4df081335a85` 的 [run 42341068101](https://github.com/jdfsank/eoc00/actions/runs/42341068101) 在完整浏览器序列第48套 `scripts/round25-world-planning-visuals-test.mjs` 中失败。原日志为 `page.screenshot: Timeout 12000ms exceeded`，调用日志已有 `fonts loaded`，阶段是 `390-200-selected-role`（390×844、原生200%文字）。此前330条断言通过，无运行时错误，源哈希一致。

既有失败后观测记录了可见页面及两个动画帧；这只说明采样时响应，不证明截图期间渲染、合成或捕获管线正常。原补图 `failure.png` 也不是所需截图成功的证据。不能把此事归因于字体未加载，亦不能混同第28轮点击 actionability 超时。根因仍未定位，本次只是观测辅助，不是根因修复。

## 最小改动

- `scripts/helpers/screenshot-diagnostic.mjs` 包裹原 `page.screenshot({path})`，原 options 原样传递。记录单调时钟 `captureElapsedMs`、标签、路径、结果和原错误，不增加等待、重试或替代成功路径。
- 成功截图不执行额外页面观测。既有 PNG 尺寸、布局、对比度、可操作性、来源哈希和错误断言全部保留。
- 仅失败后读取字体状态、页面可见性/焦点、视口/滚动/像素比、根字号及画布数，并观察至多两个动画帧或120ms。宿主600ms截止覆盖渲染器无响应情况；超时或失败标为 unavailable，不能算通过。该截止不改主截图12s超时。
- 每次尝试有独立记录，保存于 `captureAttempts`，原错误对象原样重抛，由原入口保留失败和退出码1。
- 原入口先把已失败报告保存为 `failure-original.json`，再执行既有 `failure.png` 补图。补图仍受原页面12s默认超时约束，记录为 `supplemental-not-a-retry-or-pass`，不加入所需截图成功列表，也不覆盖原错误。最终 `results.json` 保留两种记录。
- 不改生产代码、浏览器参数、栅格策略、断言阈值或截图超时。

宿主截止不会取消已送入浏览器的只读 evaluate；迟到的结果不会被采用，拒绝已捕获，浏览器随后按入口既有清理关闭。若整个浏览器/进程在主截图返回前崩溃，本辅助记录无法保证落盘，仍依赖 CI 作业日志。这不是截图重试机制。

## 验证

`node --test tests/screenshot-diagnostic.test.js`：6/6通过。覆盖成功时不观测、options/result原样、拒绝和模拟TimeoutError仍抛同一错误、单次截图、挂起/拒绝诊断有界、未捕获模拟超时子进程退出1、独立新记录及补图不能覆盖失败。

首次专项使用 `ROUND25_VISUALS_OUTPUT=../round32-capture-diagnostics`，日志 `../round32-capture-diagnostics.log`，不覆盖历史文档或历史报告。运行中检测到并行生产代码编辑触发 Vite HMR，因此该次不是冻结候选验收证据；最终必须在生产文件冻结后以新输出目录重跑原入口，并纳入完整浏览器序列。

本专项不代表完整 CI 已通过，也不能证明历史偶发超时消失。

额外检查：两个修改脚本 `node --check` 通过；从入口逆向移除四处明确观测改动后，与只读第32轮基线入口字节完全一致，证明原操作、断言、超时和浏览器参数未被夹带修改。真实 Chromium 空白页探针在390×844读取到字体已加载、单画布及两个动画帧，采样前后 HTML 完全一致；这只验证观测代码能运行，不模拟历史CI卡顿。

该次开发中专项最终退出1：477/478条已执行检查通过，原 `source frozen throughout complete run` 断言真实失败（源哈希不同，记录CSS HMR）。62张所需截图与1张补图均捕获，`390-200-selected-role` 本次约502.79ms。保留原失败而非把补图算成通过，`failure-original.json` 与 `results.json` 均存在。未执行到最后的零运行时/HMR错误断言；本次明确不作冻结通过结论。

冻结后的单次完整63套聚合中，本入口479/479检查通过，62次所需截图全部完成，无补图、失败或页面/HMR错误；390×844/200%的 `390-200-selected-role` 单次约232.62ms。此本地记录证明观测正常保留原成功路径，不证明历史远程偶发超时已修复。完整结果见 `round32-verification.json`。
