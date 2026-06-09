<!-- CATPAW:BEGIN -->
# CatPaw Protocol

- 本项目使用全局 CatPaw runtime：`~/.catpaw/`。
- 处理项目工作流 artifacts 时，先读取 `~/.catpaw/runtime-policy.md`。
- 当 CatPaw 接管任务路由时，在开始实质工作前，先告诉用户本次选择的 `L0`/`L1`/`L2`/`L3` 级别、简短原因、artifact 预期和验证预期。
- 对 CatPaw 路由的 L1/L2/L3 工作，每次用户可见的阶段汇报和最终回复都要包含精简交接：`Completed`、`Updated artifacts`、`Verification`、`Next`、`Needs user decision`。L0 可以保持轻量，除非任务升级或需要用户决策。
- 中等风险的 L1/L2 映射、跨文件一致性、review、QA 或 UI/design 检查，优先考虑当前工具的 subagent；如果触发偏好但跳过，需要说明 `Subagent skipped: <reason>`。
- 前端或 UI 相关工作，交付前要用当前可用的最强交互面自验：仓库测试、Browser / browser-use / in-app browser、Playwright / Chrome DevTools，或需要真实窗口/系统级交互时使用 Computer Use。若被阻塞，需要说明所选验证面、阻塞原因和剩余风险。
- 本项目的 CatPaw artifacts 位于仓库内 `.catpaw/` 目录。
- 使用 `.catpaw/index.md` 作为当前工作 dashboard。
- 项目本地 CatPaw 初始化遵循 `~/.catpaw/commands/init-project.md`。
- 迁移旧 CatPaw artifacts 遵循 `~/.catpaw/commands/migrate-project.md`。
- 不要把全局 runtime 文件，例如 specs、roles、templates、source evidence 或 commands，复制进本项目。
- 未经明确确认，不要删除、移动、取消跟踪或批量清理旧工作流 artifacts，例如 `todos/`。
<!-- CATPAW:END -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
