# Agent Skills

本仓库的题库制作 Skill 位于：

```text
.agents/skills/question-bank-builder/
```

- [SKILL.md](../.agents/skills/question-bank-builder/SKILL.md) — 工作流、格式硬约束、质量门槛、交付要求
- [references/import-format.md](../.agents/skills/question-bank-builder/references/import-format.md) — 字段、答案、CSV/JSON 兼容性
- [references/quality-rubric.md](../.agents/skills/question-bank-builder/references/quality-rubric.md) — 100 分质量量表
- [references/prompts.md](../.agents/skills/question-bank-builder/references/prompts.md) — 提示词模板
- [scripts/validate-bank.mjs](../.agents/skills/question-bank-builder/scripts/validate-bank.mjs) — 无依赖校验器
- [examples/sample-bank.csv](../.agents/skills/question-bank-builder/examples/sample-bank.csv) — 8 题示例

## 安装到 AI Agent

- **DeepSeek Harness / 兼容 Agent Skills 的工具**：项目根目录下的 `.agents/skills/` 会被自动发现。
- **Claude Code**：把 `.agents/skills/question-bank-builder` 复制到 `.claude/skills/question-bank-builder`。
- **其他工具**：把整个 `question-bank-builder/` 目录放到其 skills 根目录，确保 `SKILL.md` 位于 `<skill-name>/SKILL.md`。

最短验证：

```bash
node .agents/skills/question-bank-builder/scripts/validate-bank.mjs \
  .agents/skills/question-bank-builder/examples/sample-bank.csv --strict
```

完整说明见 [题库制作指南](../题库制作指南.md)。
