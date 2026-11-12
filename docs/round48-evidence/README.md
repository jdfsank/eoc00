# 第48轮恢复后新验证证据

按名称顺序拼接raw-validation.tar.gz.part*，先核manifest的整包SHA-256再解包；单片不是完整压缩包。保留归档中的原mtime，供新执行窗口核验。manifest列出每个文件的字节数、SHA-256与mtime，及每片Git blob SHA。所有图都是新取得的未经编辑原图。

包内包含这次顺序运行的原始日志、开始/完成/退出码、全部浏览器报告与虚构测试存档、冻结清单、11处精确测试迁移、独立验收器、自然费用审计和独立视觉记录。畸形JSON与超大空白文件是导入安全测试的故意无效fixture，不代表数据缺损。

这是恢复后的新证据，不是找回旧环境全部日志。旧两次中止聚合和开发诊断原始日志未在本包中重造。两项历史可选旧档检查未执行，严格覆盖未完成，balanced=false。独立审计的退出1与passed=false对应已明示的历史覆盖缺口，只有evidenceValid=true才说明本次实际执行证据有效。

核验方法：在本提交的干净副本中解包并保留mtime，把playtest-output与validation放在副本根目录；使用包内validation/reviewer/acceptance-rebuilt.mjs，以--repo指向副本，--freeze指向validation/freeze.json，--stages指向validation，--baseline指向validation/baseline-hashes.json，--migrations指向validation/layout-test-migration.json，--catalog指向仓库docs/round41-verification.json，--output指定新的报告路径。该审计器是本次重新构建并检查的工具，不宣称恢复了其旧字节。

审计不改变游戏状态，不把25套缺少内嵌hash的旧套标成有hash。基线单击只服务于原文与视觉对照，新版双击强断言单独记录。真人、真机、屏幕阅读器及全局平衡未认证；准确SHA远程CI另核。
