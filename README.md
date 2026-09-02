# CPHOS 联考新平台

<p>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg"></a>
  <a href="https://pnpm.io/"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-11%2B-orange.svg"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-blue.svg"></a>
</p>

CPHOS 联考新平台是一套面向联考业务的 TypeScript 全栈系统，覆盖平台用户、CPHOS 成员与管理员三类角色，提供考试、整卷、分配、双阅、仲裁、排名导出与机器人录分等完整流程。

项目采用 pnpm workspace 管理，后端为 Fastify + Prisma（PostgreSQL），前端为 React + Ant Design。仓库内所有历史数据均为演示/测试用途，不包含任何生产凭据。

## 功能概览

- 认证与账号：平台用户邮箱验证码注册、CPHOS 内部账号、唯一超级管理员、刷新令牌轮换与登录版本控制。
- 审核与认领：平台用户材料提交、管理员审核、成员认领/协作与团队归属。
- 考试域：考试配置、整卷上传、题目图片裁剪、逐题绑定与阅卷 N 评设置。
- 分配与双阅：按题目分配互评任务、强制同一评阅人对同一题只出现一次；成绩取 N 评均值，分差过大进入仲裁。
- 仲裁：利益冲突校验（上传者、学生本人、原评阅人、同队/同校回避），支持可审计的仲裁评分。
- 重分/重开：基于 ALLOCATION_REGRADE 的可审计重分流程，清理旧终评与仲裁记录后重新分配。
- 排名与导出：分段排名、CSV/Excel 导出、平台成绩详情与逐题组图回看。
- 对象存储：文件系统对象存储 + StoredObject 元数据 + SHA-256，逐图 fileKey 与裁剪坐标统一。
- 机器人与审计：机器人账号 scope 控制、审计日志、健康检查与生产环境变量守卫。

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 语言 | TypeScript（严格模式） |
| 包管理 | pnpm workspace |
| 后端 | Fastify 5、Prisma 6、PostgreSQL、Zod、Argon2 |
| 前端 | React 18、Vite 6、Ant Design 5、TanStack Query、Zustand |
| 共享层 | packages/shared（枚举、Zod schema、DTO） |
| 测试 | Vitest（API 单测）、Playwright（E2E，复用本机 Edge） |
| 部署 | PM2、Nginx、Docker / docker compose 模板 |

## 仓库结构

```text
CPHOS_Platform/
├── apps/
│   ├── api/                 # Fastify API、Prisma schema、脚本与单测
│   └── web/                 # React 三端界面
├── packages/
│   └── shared/              # 前后端共享枚举、Zod schema、DTO
├── e2e/                     # Playwright E2E 与截图产物
├── deploy/                  # Nginx / PM2 / Docker 配置模板
├── docs/                    # 旧系统调研、新系统设计与文档索引
├── docker-compose.yml.example
├── package.json
└── pnpm-workspace.yaml
```

## 环境要求

- Node.js >= 20
- pnpm（仓库锁定 pnpm@11.22.0）
- 本地开发可使用内嵌 PostgreSQL（`pnpm dev:db`），生产环境请使用独立 PostgreSQL
- E2E 默认复用本机 Microsoft Edge，兼容 Chromium 内核浏览器

> 网络受限时，可将 `.npmrc.example` 复制为 `.npmrc`，并按需配置代理；`.npmrc` 已被 gitignore。

## 快速开始

```bash
pnpm install

# 终端 1：启动内嵌 PostgreSQL（数据在 apps/api/.pgdata/）
pnpm dev:db

# 终端 2：首次建表并写入开发种子（按项目决策使用 db push，无迁移历史）
pnpm api:migrate
pnpm api:seed-dev

# 终端 3：启动 API（http://127.0.0.1:3001）
pnpm dev:api

# 终端 4：启动前端（http://localhost:5173，开发服务器代理 /api）
pnpm dev:web
```

### 初始化账号

```bash
# 参数顺序：用户名 显示名 密码 [角色]
pnpm api:init-super-admin -- super "超级管理员" "<强密码>"
pnpm api:create-internal -- member01 "张三" "<强密码>" CPHOS_MEMBER
pnpm api:create-internal -- admin01 "李四" "<强密码>" ADMIN
```

开发环境未配置 SMTP 时，验证码邮件会写入 `apps/api/.devmail/*.json`，并打印在 API 日志中。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:db` | 启动开发数据库 |
| `pnpm dev:api` | 启动 API 开发服务器 |
| `pnpm dev:web` | 启动前端开发服务器 |
| `pnpm build` | 构建 shared、api、web |
| `pnpm typecheck` | 全仓 TypeScript 类型检查 |
| `pnpm test` | 全仓单元测试 |
| `pnpm e2e` | 本地 E2E（自动拉起服务，无头 Edge） |
| `pnpm e2e:headed` | 有头调试 E2E |
| `pnpm e2e:debug` | 逐步调试 E2E |
| `pnpm e2e:report` | 打开 Playwright 报告 |
| `pnpm api:migrate` | 同步 Prisma schema 到数据库（db push） |
| `pnpm api:seed-dev` | 写入开发种子 |
| `pnpm api:seed-e2e` | 重置 E2E 测试数据 |

## 测试

```bash
# TypeScript 类型检查
pnpm typecheck

# API 单元测试
pnpm --filter @cphos/api test

# E2E：自动启动内嵌数据库、同步 schema、重置测试数据，结束后关闭服务
pnpm e2e
```

E2E 覆盖账号、考试、整卷、分配、双阅 N 评、仲裁冲突、重分、查询错误态、对象存储与完整审核流；UI 走查截图输出到 `e2e/artifacts/`（已 gitignore），报告在 `playwright-report/`。

## 对象存储

当前采用与 CPHOS/Question_DB 对齐的文件系统对象存储方案：

- `StoredObject` 记录文件名、MIME、大小、SHA-256 与相对路径；
- 文件先落盘，再在事务内写入对象元数据与 PaperPage；
- `QuestionImage.fileKey` 支持逐图覆盖，未提供时继承所属 `PaperPage`；
- 阅卷/仲裁按 imageId 读取文件并复用裁剪坐标；
- 旧 `PaperPage.fileKey` 可通过 `pnpm --filter @cphos/api object:backfill` 回填；
- `OBJECT_STORAGE_DRIVER=local` 为默认驱动，未来可在对象存储层增加 MinIO/S3 adapter。

## 生产构建与部署

```bash
# 构建
pnpm build

# 启动 API 产物
pnpm --filter @cphos/api start
```

生产模板与安全基线：

- 后端环境变量模板：`apps/api/.env.production.example`
- Nginx：`deploy/nginx.conf.example`
- 安全响应头：`deploy/security-headers.conf.example`
- PM2：`deploy/ecosystem.config.cjs.example`
- Docker：`deploy/docker/Dockerfile.api`、`deploy/docker/Dockerfile.web`、`deploy/docker/nginx-web.conf`、`docker-compose.yml.example`

Docker 快速启动：

```bash
cp docker-compose.yml.example docker-compose.yml
# 必须先替换所有 CHANGE_ME/example.com 占位值，否则生产 env guard 会拒绝启动
docker compose up -d --build
```

生产发布前至少完成数据库与上传目录备份，并执行：

```bash
pnpm --filter @cphos/api task:check-duplicates
pnpm --filter @cphos/api exec prisma generate
pnpm --filter @cphos/api exec prisma db push
pnpm --filter @cphos/api object:backfill
curl -fsS http://127.0.0.1:3001/api/health/ready
```

生产必须显式配置 `NODE_ENV=production`、`HOST`、`DATABASE_URL`、强随机 `JWT_SECRET`/`CODE_SALT`、`CORS_ORIGIN`、SMTP 与 `UPLOAD_DIR`，并将上传目录纳入备份。

## 文档

- [文档索引](docs/README.md)
- [旧平台结构与业务调研报告](docs/01_旧平台结构与业务调研报告.md)
- [新系统设计](docs/02_新系统设计.md)

## 贡献

欢迎通过 Issue 与 Pull Request 参与建设。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [行为准则](CODE_OF_CONDUCT.md)。

## 安全

如果发现安全漏洞，请勿直接在公开 Issue 中披露。请通过 [SECURITY.md](SECURITY.md) 中的私有渠道联系维护者。

## 许可证

[GNU Affero General Public License v3.0 or later](LICENSE)（AGPL-3.0-or-later）。
