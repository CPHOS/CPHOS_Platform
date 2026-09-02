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

# 创建系统管理员与内部账号（注意参数顺序：用户名 显示名 密码 [角色]）
pnpm api:init-super-admin -- super "超级管理员" "<强密码>"                    # 超级管理员（受保护，不可删除）
pnpm api:create-internal -- member01 "张三" "<强密码>" CPHOS_MEMBER           # CPHOS 内部员工
pnpm api:create-internal -- admin01 "李四" "<强密码>" ADMIN                   # 管理员（也可由超管提升）
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
- Nginx 安全头片段：复制到 `/etc/nginx/snippets/cphos-security-headers.conf`
- PM2：`deploy/ecosystem.config.cjs.example`
- Docker：
  - `deploy/docker/Dockerfile.api`
  - `deploy/docker/Dockerfile.web`
  - `deploy/docker/nginx-web.conf`
  - `docker-compose.yml.example`

Docker 启动示例：

```bash
cp docker-compose.yml.example docker-compose.yml
# 必须替换所有 CHANGE_ME/example.com 占位值，否则生产 env guard 会拒绝启动
docker compose up -d --build
# 首个超管（最终镜像含 tsx；参数：用户名 显示名 密码）
docker compose exec api node apps/api/node_modules/tsx/dist/cli.mjs \
  apps/api/scripts/init-super-admin.ts super "超级管理员" "<强密码>"
# 容器模式备份（named volumes）
docker compose exec -T db pg_dump -U cphos -Fc cphos > backup-$(date +%F).dump
docker run --rm -v cphos-uploads:/data -v "$PWD":/backup alpine \
  tar -C /data -czf /backup/uploads-$(date +%F).tgz .
```

compose 只把 Web 绑定在 `127.0.0.1:8080`，生产必须在前面再放 TLS 终止代理。

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/nginx.conf.example /etc/nginx/conf.d/cphos.conf
sudo cp deploy/security-headers.conf.example /etc/nginx/snippets/cphos-security-headers.conf
sudo nginx -t
```

生产发布前至少执行：

```bash
# 1) 读取 apps/api/.env（模板值已按 shell source 规则加引号）并备份
set -a; . apps/api/.env; set +a
DUMP="backup-$(date +%F).dump"
UPLOADS="uploads-$(date +%F).tgz"
pg_dump "$DATABASE_URL" -Fc -f "$DUMP"
tar -C "$(dirname "$UPLOAD_DIR")" -czf "$UPLOADS" "$(basename "$UPLOAD_DIR")"
test -s "$DUMP" || { echo "数据库备份为空: $DUMP" >&2; exit 1; }
test -s "$UPLOADS" || { echo "上传目录备份为空: $UPLOADS" >&2; exit 1; }
# 恢复演练（在影子库执行）：pg_restore -d "$SHADOW_DATABASE_URL" --clean --if-exists "$DUMP"
# 2) 当前按既定决策使用 db push 同步 schema（无迁移历史）；备份校验通过后才允许执行
#    新唯一约束上线前先检查是否存在同题同人重复分配
pnpm --filter @cphos/api task:check-duplicates
#    生产安装需保留 devDependencies 或使用同一 Prisma 版本的 pnpm dlx
pnpm --filter @cphos/api exec prisma generate
pnpm --filter @cphos/api exec prisma db push
#    旧 PaperPage.fileKey 回填为 StoredObject 元数据（不移动原文件）
pnpm --filter @cphos/api object:backfill
# 3) 启动并通过就绪探针
curl -fsS http://127.0.0.1:3001/api/health/ready
```

生产必须显式配置：`NODE_ENV=production`、`HOST=127.0.0.1`、正式 `DATABASE_URL`、强随机 `JWT_SECRET`/`CODE_SALT`、`CORS_ORIGIN`、SMTP；上传目录建议使用单机持久盘或后续替换对象存储，并纳入备份。

## 对象存储

当前采用与 Question_DB 对齐的“文件系统对象存储 + DB 元数据”方案：

- `StoredObject` 记录文件名/MIME/大小/SHA-256/相对路径
- 文件先写入 `UPLOAD_DIR`，再在事务内写对象与 PaperPage 元数据
- 旧 `PaperPage.fileKey` 数据可运行 `pnpm --filter @cphos/api object:backfill` 回填 `StoredObject`
- `OBJECT_STORAGE_DRIVER=local` 默认；未来接 MinIO/S3 时在对象存储层增加 adapter
- Docker 使用 `cphos-uploads` volume；备份参见上文 tar/卷备份命令
