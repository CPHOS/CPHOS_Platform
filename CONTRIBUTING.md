# 参与贡献

感谢你关注 CPHOS 联考新平台！在提交 Issue 或 Pull Request 之前，请先阅读以下约定。

## 行为准则

所有参与者都应遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。不友善、骚扰性或歧视性言行不会被接受。

## 环境准备

```bash
pnpm install
pnpm typecheck
pnpm --filter @cphos/api test
```

本地完整调参需要 Node.js >= 20、pnpm 以及 PostgreSQL（开发可直接使用内嵌数据库）。E2E 默认复用本机 Microsoft Edge。

## 开发流程

1. 先搜索现有 Issue / PR，避免重复工作。
2. 对较大的功能或架构调整，先创建 Issue 描述动机、方案与影响范围；与维护者对齐后再开始实现。
3. Fork 本仓库，从 `main` 切出短期分支，例如 `feat/regrade-reason`、`fix/query-error-state`。
4. 小步提交，每个提交只做一件事，并保证可以独立理解。
5. 推送分支并创建 Pull Request，关联相关 Issue。

## 提交信息

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
feat: 增加可审计重分原因记录
fix: 修复仲裁列表空态报错
docs: 整理开源项目文档
test: 补充 N=3 分配与阅卷用例
refactor: 抽离对象存储 adapter 接口
chore: 升级 Prisma 依赖
```

## 代码风格

- 使用 TypeScript，避免无必要的 `any`；
- 遵循仓库现有目录与模块边界，不把业务逻辑塞进路由处理函数；
- 数据库 schema 当前按项目决策使用 `prisma db push`，**不要新增 Prisma migration 历史**；
- 涉及 schema 变更时运行 `pnpm --filter @cphos/api exec prisma generate`；
- 提交前运行 `git diff --check`，避免空白错误；
- 编辑器配置参见 [.editorconfig](.editorconfig)。

## 测试要求

```bash
# 类型检查
pnpm typecheck

# 单元测试
pnpm test

# 端到端测试（会启动内嵌数据库与本地服务）
pnpm e2e
```

Bug 修复应包含回归测试；涉及分配、双阅、仲裁、审核流程、对象存储或权限逻辑的改动必须有对应测试。

## Pull Request 检查清单

- [ ] 已在本地通过 `pnpm typecheck`
- [ ] 已运行相关单元测试 / E2E 并记录结果
- [ ] 新功能包含文档或注释说明
- [ ] 没有提交真实密钥、令牌、个人敏感数据或生产环境文件
- [ ] 变更了环境变量时，同步更新 `.env.example` / `.env.production.example`
- [ ] commit message 清晰，PR 描述说明了“为什么”而不只是“改了什么”

## 报告问题

Bug、功能建议或文档问题请通过 GitHub Issues 提交，并使用对应的 Issue 模板。安全漏洞请走 [SECURITY.md](SECURITY.md)。

## 许可证

你的贡献将以 [AGPL-3.0-or-later](LICENSE) 许可证发布。继续提交即表示你同意该授权方式。
