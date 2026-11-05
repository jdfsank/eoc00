# 资产来源与状态

- `public/assets/props/`中原有`agent/archive/assembly_hall/observatory/temple/tree/warehouse/water_station`的SVG与PNG：用户提供《余波》交接包 v0.3 中的原创程序化工程代理素材。固定64×80逻辑尺寸，锚点32,64，PNG为2倍输出。不是从概念图切片，也不是《陷阵之志》的资源。正式资产迭代尚未完成。
- `public/assets/river-room.svg`：本项目新制作的原创几何像素风档案室，用于AVG场景。没有嵌入第三方图片或文字。
- Phaser 3.90：MIT，依赖许可证保留在其发行包内。
- Vite、Playwright、Sparticuz Chromium：开发与测试工具，各自许可证由锁定依赖保留。

地图由真实64格数据绘制，建筑由生效制度驱动。概念PNG没有进入游戏构建。

2026-11-05新增原创代码绘制SVG：`archive-desk.svg`（档案与协商）、`open-shore.svg`（无已建机构的河岸）、`local-classroom.svg`（现存教学场所）。`scene-art.js`按真实机构选择，现有`river-room.svg`仅用于活动测站/分站，结局使用档案桌。地图状态叠加符号与五档调色均为项目原生几何和配置，不引入外部游戏素材。

本轮新增原创`props/riverside_school.svg/.png`与`props/bank_reading_circle.svg/.png`，不是交接包素材。两者64×80逻辑尺寸、锚点32,64，透明RGBA PNG为128×160，可用`node scripts/render-learning-art.mjs`重复生成。`local-classroom.svg`改为露天敞棚，`bank-reading.svg`为南岸无顶围座，`closed-*`保留旧址但没有学员。

本轮D4近景为原创代码绘制SVG，使用同一间记录室和测站轮廓表达运转、维护不足、人手缺口、停运；由`node scripts/render-station-art.mjs`生成。未建站与失败档案仍使用档案桌，恢复服务后才切回运转图。它们是状态示意，不是额外剧情事件或实际损失证据。

本轮地图仍使用原建筑纹理；空班、维护修补、停运封板为原生几何状态标记，分别依实际原因绘制。新增验证包含单色截图、320/390宽度及同一Canvas原位恢复，未把调色误当新建筑素材。
