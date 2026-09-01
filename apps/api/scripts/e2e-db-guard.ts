/**
 * E2E 种子脚本的数据库防误伤护栏。
 * 只有以下两类连接允许执行 TRUNCATE：
 * 1) 本仓库 scripts/dev-db.mjs 启动的内嵌 PostgreSQL（127.0.0.1:54329）；
 * 2) 数据库名显式包含 e2e/test 的可丢弃测试库。
 * 生产环境一律拒绝。
 */
export function assertDisposableDatabase(databaseUrl: string, nodeEnv: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('[seed-e2e] DATABASE_URL 不是合法的连接串，拒绝执行清库');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('[seed-e2e] 仅允许在 PostgreSQL 的 E2E 专用库上执行');
  }
  if (nodeEnv === 'production') {
    throw new Error('[seed-e2e] NODE_ENV=production，拒绝清空数据库');
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || '';
  const host = (parsed.hostname || '').toLowerCase();
  const port = parsed.port || '5432';
  const localEmbedded =
    (host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]') &&
    port === '54329';
  const explicitlyTest = /(?:^|[_-])(e2e|test)(?:[_-]|$)/i.test(dbName);

  if (!localEmbedded && !explicitlyTest) {
    throw new Error(
      '[seed-e2e] 拒绝在非 E2E 专用数据库上清空数据：' +
        databaseUrl.replace(/:(?:[^:@/]+)@/, ':***@') +
        '。请使用 127.0.0.1:54329 的内嵌测试库，或将库名命名为包含 e2e/test。',
    );
  }
}
