// 开发数据库：内嵌 PostgreSQL（零安装，数据持久化在 apps/api/.pgdata/）
// 用法：pnpm dev:db（保持运行）；连接串：
//   postgresql://cphos:cphos@127.0.0.1:54329/cphos
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 54329;
const databaseDir = path.join(__dirname, '..', '.pgdata');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'cphos',
  password: 'cphos',
  port: PORT,
  persistent: true,
});

// 首次启动初始化集群；已初始化（存在 PG_VERSION）则直接启动，支持 Ctrl+C 后重启
if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase('cphos');
  console.log('[dev-db] 已创建数据库 cphos');
} catch {
  console.log('[dev-db] 数据库 cphos 已存在');
}

console.log(`[dev-db] PostgreSQL 运行中 → postgresql://cphos:cphos@127.0.0.1:${PORT}/cphos`);
console.log('[dev-db] Ctrl+C 停止（数据保留在 .pgdata/）');

const shutdown = async () => {
  console.log('[dev-db] 正在停止…');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
