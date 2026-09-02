# CPHOS 平台文档

本目录归档 CPHOS 联考新平台的设计与实现说明。项目总体介绍、快速开始和部署指南请先阅读 [根 README](../README.md)。

## 当前状态

核心业务流程与生产化收尾已完成，仓库进入可开源状态：

- 账号、审核/认领、用户域、考试域、整卷、题目绑定与裁剪、分配、双阅、仲裁、排名/导出、平台成绩、机器人与审计均已实现；
- 阅卷支持 `ExamConfig.reviewCount` / `Paper.requiredReviewCount` 配置，分配会保证同一评阅人对同一题只出现一次；
- 成绩按 N 评均值计算，分差超过阈值进入仲裁；仲裁启用上传者、学生本人、原评阅人、同队/同校回避；
- 重分/重开基于 `ALLOCATION_REGRADE`，要求填写原因并清理旧终评与仲裁记录，保留审计线索；
- 对象存储与 Question_DB 对齐：文件系统 adapter + `StoredObject` 元数据 + SHA-256，`QuestionImage.fileKey` 支持逐图覆盖；
- 前端查询接入统一错误态与重试；E2E 覆盖审核、双阅 N 评、重分、查询错误、对象存储与安全加固；
- 生产基线包含环境变量守卫、Helmet 安全头、CORS 白名单、Nginx / PM2 / Docker 模板与备份说明。

## 文档索引

| 文件 | 内容 |
| --- | --- |
| [01_旧平台结构与业务调研报告.md](01_旧平台结构与业务调研报告.md) | **旧系统调研（完整版，归档参考）**：旧表与 ER、业务规则、历史包袱清单；**不导入数据，只作设计输入** |
| [02_新系统设计.md](02_新系统设计.md) | **新系统设计**：决策记录、设计原则、MVP 里程碑、认证方案、实体模型 ER、技术栈决策与待决策项 |
| [../CHANGELOG.md](../CHANGELOG.md) | 版本更新日志 |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南与开发约定 |
| [../SECURITY.md](../SECURITY.md) | 安全漏洞私有报告流程 |

> 历史数据导入、外包用户库对接、旧库认领参照快照均已从路线图移除。`LegacyMemberRef` 仅保留为可选兼容能力，不作为开发前置。

## 包与模块

| 包 | 内容 | 状态 |
| --- | --- | --- |
| `apps/api` | Fastify 5 + Prisma 6（PostgreSQL）：认证、审核、用户域、考试、整卷、分配、双阅、仲裁、排名/导出、平台成绩、机器人账号 | 核心功能完成；对象存储与生产基线完成 |
| `apps/web` | Vite 6 + React 18 + Ant Design 5：三端界面（`/app` 平台用户、`/cphos` CPHOS 成员、`/admin` 管理员） | 考试/分配/阅卷/仲裁/排名导出/成绩详情/机器人界面完成；统一错误态接入 |
| `packages/shared` | 前后端共用枚举、Zod schema、DTO | 生效 |
| `e2e` | Playwright 本地 E2E（复用本机 Edge，不接 CI） | 覆盖账号、考试、整卷、分配、双阅、仲裁、重分、查询错误、对象存储、审核流与截图走查 |

## 架构速览

- 后端按领域模块划分，路由层只做鉴权、参数解析与响应；业务规则集中在 `*.service.ts`；
- Prisma schema 使用 `prisma db push` 同步，仓库**不保留 migration 历史**；
- 对象先写入本地文件系统，再在事务内写 `StoredObject` 与业务元数据；文件路径通过 DB 记录解析；
- 分配任务通过唯一约束防止同题同人重复；
- 仲裁与重分都写入审计信息，关键路径使用事务和状态机约束；
- 前端统一使用 TanStack Query 管理服务端状态、Zustand 管理会话/本地状态，`QueryError` 提供统一错误与重试。

## 快速开始

```bash
pnpm install
pnpm dev:db            # 终端 1：内嵌 PostgreSQL（数据在 apps/api/.pgdata/）
pnpm api:migrate       # 终端 2：首次建表/同步 schema（prisma db push，无迁移历史）
pnpm api:seed-dev      # 终端 2：开发种子（可反复执行）
pnpm dev:api           # 终端 3：API（http://127.0.0.1:3001）
pnpm dev:web           # 终端 4：前端（http://localhost:5173）
pnpm e2e               # 本地 E2E（自动拉起服务、复用本机 Edge）
```

创建账号：

```bash
# 参数顺序：用户名 显示名 密码 [角色]
pnpm api:init-super-admin -- super "超级管理员" "<强密码>"
pnpm api:create-internal -- member01 "张三" "<强密码>" CPHOS_MEMBER
pnpm api:create-internal -- admin01 "李四" "<强密码>" ADMIN
```

开发模式未配置 SMTP 时，验证码写入 `apps/api/.devmail/*.json` 并在 API 日志打印。

## 开发约定

- 较大的功能或架构调整先在 Issue 中对齐动机、方案和影响范围；
- 提交遵循 Conventional Commits，PR 说明“为什么”而不仅是“改了什么”；
- 涉及 schema 变更时运行 `prisma generate`，不要新增 migration 历史；
- 分配、双阅、仲裁、审核、对象存储与权限逻辑必须补测试；
- 不要提交 `.env`、`.devmail/`、`.uploads/`、`.pgdata/`、构建产物或真实凭据。

详见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 安全与敏感信息

仓库内不含任何生产凭据；如发现安全问题，请使用 [SECURITY.md](../SECURITY.md) 中的私有报告渠道，不要提交公开 Issue。
