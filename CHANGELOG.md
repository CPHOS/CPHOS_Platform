# 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 建立开源项目文档基线：`LICENSE`（AGPL-3.0-or-later）、`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`CHANGELOG.md`、Issue / PR 模板与 `.editorconfig`。
- 为 `package.json` 增加许可证、仓库、Issue 与主页元数据。

### 变更

- 重写根 `README.md`，补全功能概览、技术栈、仓库结构、环境要求、测试、对象存储与部署说明。
- 将旧平台调研报告整理为公开版：脱敏线上地址、管理员用户名与抽样姓名，删除未随仓库公开的探针复跑说明。
- 更新 `docs/README.md` 当前状态、模块完成度与贡献/安全指引链接。
- 修正 `docs/02_新系统设计.md` 中与当前实现不一致的状态、对象存储与 Prisma migration 表述。

## [0.1.0] - 2026-09-02

首个对外开源基线，覆盖从工程骨架到生产化收尾的完整实现。

### 新增

- pnpm workspace 工程骨架：`apps/api`、`apps/web`、`packages/shared`、`e2e`。
- 认证与账号：邮箱验证码注册、CPHOS 内部账号、超级管理员、刷新令牌轮换、登录版本控制。
- 审核与认领：材料提交、管理员审核、成员认领/协作与团队归属。
- 考试域：考试配置、整卷上传、题目绑定与裁剪、N 评设置。
- 分配与双阅：按题分配、强制同一评阅人对同一题只出现一次、成绩取 N 评均值、分差过大进入仲裁。
- 仲裁：上传者、学生本人、原评阅人、同队/同校回避；支持 claim / grade 与审计留痕。
- 重分/重开：基于 `ALLOCATION_REGRADE` 的可审计重分，要求填写原因并清理旧终评与仲裁记录。
- 排名与导出：分段排名、CSV / Excel、平台成绩详情与逐题组图回看。
- 前端查询统一错误态与重试组件 `QueryError`。
- 本地对象存储：`StoredObject` 元数据、SHA-256、`QuestionImage.fileKey` 逐图覆盖与旧数据回填脚本。
- 机器人账号 scope、审计日志、健康检查与生产环境变量守卫。
- PM2 / Nginx / Docker 部署模板与数据库、上传目录备份说明。
- E2E 覆盖账号、考试、整卷、分配、双阅、仲裁、重分、查询错误态、对象存储、安全加固与完整审核流。

### 变更

- 对象存储与 CPHOS/Question_DB 对齐：文件系统本地 adapter + 数据库元数据，保留未来 MinIO/S3 adapter 扩展位。
- 数据库 schema 按项目决策使用 `prisma db push` 同步，不保留 Prisma migration 历史。
