# 资产来源与状态

- `public/assets/props/`中原有`agent/archive/assembly_hall/observatory/temple/tree/warehouse/water_station`的SVG与PNG：用户提供《余波》交接包 v0.3 中的原创程序化工程代理素材。固定64×80逻辑尺寸，锚点32,64，PNG为2倍输出。不是从概念图切片，也不是《陷阵之志》的资源。正式资产迭代尚未完成。
- `public/assets/river-room.svg`：本项目新制作的原创几何像素风档案室，用于AVG场景。没有嵌入第三方图片或文字。
- Phaser 3.90：MIT，依赖许可证保留在其发行包内。
- Vite、Playwright、Sparticuz Chromium：开发与测试工具，各自许可证由锁定依赖保留。

地图由真实64格数据绘制，建筑由生效制度驱动。概念PNG没有进入游戏构建。

2026-11-05新增原创代码绘制SVG：`archive-desk.svg`（档案与协商）、`open-shore.svg`（无已建机构的河岸）、`local-classroom.svg`（现存教学场所）。`scene-art.js`按真实机构选择，当时`river-room.svg`用于活动测站/分站；后续D4/F6已由各自状态近景替换，旧母版保留，结局使用档案桌。地图状态叠加符号与五档调色均为项目原生几何和配置，不引入外部游戏素材。

本轮新增原创`props/riverside_school.svg/.png`与`props/bank_reading_circle.svg/.png`，不是交接包素材。两者64×80逻辑尺寸、锚点32,64，透明RGBA PNG为128×160，可用`node scripts/render-learning-art.mjs`重复生成。`local-classroom.svg`改为露天敞棚，`bank-reading.svg`为南岸无顶围座，`closed-*`保留旧址但没有学员。

本轮D4近景为原创代码绘制SVG，使用同一间记录室和测站轮廓表达运转、维护不足、人手缺口、停运；由`node scripts/render-station-art.mjs`生成。未建站与失败档案仍使用档案桌，恢复服务后才切回运转图。它们是状态示意，不是额外剧情事件或实际损失证据。

本轮地图仍使用原建筑纹理；空班、维护修补、停运封板为原生几何状态标记，分别依实际原因绘制。新增验证包含单色截图、320/390宽度及同一Canvas原位恢复，未把调色误当新建筑素材。

第六轮拟派遣方筹/圆筹、短虚线与待兑现沙漏均由`board.js`原生几何绘制，无新增第三方图像。它们表示草案和合同，不替代角色正式立绘，也不代表已建机构。单色与窄屏截图验证形状可区分，文字图例与地域列表同步说明。

第七轮新增6套`public/assets/south-bank-*.svg`近景（1000×500），以及6套`props/south_bank_*.svg/.png`复合地图道具。SVG母版64×80、锚点32,64，RGBA PNG128×160，由`node scripts/render-south-bank-art.mjs`生成；总18文件约43KB。全部为项目原创代码绘制：无顶读尺围座与低矮高脚物资棚独立开闭，停运保留原址，不引入外部图片。

第八轮F6新增20套状态组合，每套包括1000×500近景SVG、64×80地图SVG母版及锚点32,64的128×160透明PNG，共60文件约126KB。由`node scripts/render-far-port-art.mjs`生成，全部为项目原创代码绘制。分站/码头、失败底稿和双册校验台各自保留历史；地图工单不重复绘制统一待兑现沙漏。32/40年的近景图测试是明确标注的资产预览，不冒充新增可玩AVG入口。
