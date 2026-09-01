# CPHOS 联考新平台

TypeScript 全栈（pnpm monorepo）：Fastify + Prisma（PostgreSQL）后端，React + Ant Design 前端，三端界面（平台用户 / CPHOS 成员 / 管理员）。

设计文档见 `docs/`：

- `docs/01_旧平台结构与业务调研报告.md` — 旧系统完整调研（**归档参考，不导入数据**）
- `docs/02_新系统设计.md` — 新系统设计（数据模型、认证方案、里程碑、决策点）

## 快速开始

> 环境准备：如本机直连 `registry.npmjs.org` 失败，按 `.npmrc.example` 复制为 `.npmrc` 并将代理指向 `http://127.0.0.1:7892/`（`.npmrc` 已被 gitignore，不会提交）。

```bash
pnpm install

# 终端 1：开发数据库（内嵌 PostgreSQL，数据在 apps/api/.pgdata/）
pnpm dev:db

# 终端 2：首次建表（prisma db push，无迁移历史）+ 开发种子
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

## 本地自动化测试（不接 CI）

`pnpm e2e` 会自动启动内嵌数据库、同步 schema、重置测试数据，并让 Playwright **复用本机 Microsoft Edge**（不下载 Chromium）跑完整 E2E；开发服务器会自动拉起并在结束后关闭。

```bash
pnpm e2e            # 无头 Edge 跑全部用例
pnpm e2e:headed     # 有头调试
pnpm e2e:debug      # 逐步调试
```

UI 走查截图输出到 `e2e/artifacts/`（已 gitignore）；测试报告在 `playwright-report/`。

## 生产构建与配置模板

```bash
pnpm build                 # shared + api -> dist，web -> dist
pnpm --filter @cphos/api start   # node apps/api/dist/server.js
```

- 生产环境变量模板：`apps/api/.env.production.example`
- Nginx：`deploy/nginx.conf.example`
- PM2：`deploy/ecosystem.config.cjs.example`

生产必须显式配置：`NODE_ENV=production`、正式 `DATABASE_URL`、强随机 `JWT_SECRET`/`CODE_SALT`、`CORS_ORIGIN`、SMTP；上传目录生产建议替换为对象存储。
