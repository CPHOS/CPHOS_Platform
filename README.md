# CPHOS 联考新平台

TypeScript 全栈（pnpm monorepo）：Fastify + Prisma（PostgreSQL）后端，React + Ant Design 前端，三端界面（平台用户 / CPHOS 成员 / 管理员）。

设计文档见 `docs/`：

- `docs/01_旧平台结构与业务调研报告.md` — 旧系统完整调研（设计输入）
- `docs/02_新系统设计.md` — 新系统设计（数据模型、认证方案、里程碑、决策点）

## 快速开始

> 环境准备：如本机直连 `registry.npmjs.org` 失败，需按 `.npmrc.example` 复制为 `.npmrc` 并配置代理（`.npmrc` 已被 gitignore，不会提交）。

```bash
pnpm install

# 终端 1：开发数据库（内嵌 PostgreSQL，数据在 apps/api/.pgdata/）
pnpm dev:db

# 终端 2：数据库迁移（首次）+ 开发种子（字典 + 示例认领参照）
pnpm api:migrate
pnpm api:seed-dev

# 终端 3：后端 API（http://127.0.0.1:3001）
pnpm dev:api

# 终端 4：前端（http://localhost:5173，/api 已代理到后端）
pnpm dev:web

# 创建系统管理员与内部账号
pnpm api:init-super-admin -- super <密码> <显示名>                  # 超级管理员（受保护，不可删除）
pnpm api:create-internal -- <用户名> <密码> <姓名> CPHOS_MEMBER       # CPHOS 内部员工（建档即用，无需邮箱验证）
pnpm api:create-internal -- <用户名> <密码> <姓名> ADMIN              # 管理员（也可由超管提升）
```

开发模式未配置 SMTP 时，验证码邮件写入 `apps/api/.devmail/*.json` 并打印在 API 日志中。
