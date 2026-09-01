// 一键本地 E2E：
// 1) 确保内嵌 PostgreSQL 运行；2) 应用迁移与开发种子；3) 交给 Playwright（自动拉起 API/Web，复用本机 Edge）。
// 用法：pnpm e2e / pnpm e2e:headed / pnpm e2e:debug
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = 'pnpm';
const useShell = process.platform === 'win32';
const DB_PORT = 54329;

// E2E 永远固定到可丢弃的内嵌库，避免误连 .env 中的共享/生产 DATABASE_URL
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://cphos:cphos@127.0.0.1:' + DB_PORT + '/cphos';

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkPort(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function run(args) {
  const result = spawnSync(pnpm, args, { cwd: root, stdio: 'inherit', shell: useShell });
  if (result.error) console.error('[e2e] command error:', result.error.message);
  return result.status === null ? 1 : result.status;
}

let ownsDb = false;
let dbProcess = null;
let cleanedUp = false;

async function main() {
  if (!(await checkPort(DB_PORT))) {
    console.log('[e2e] dev database not running, starting embedded PostgreSQL ...');
    dbProcess = spawn('node', ['apps/api/scripts/dev-db.mjs'], { cwd: root, stdio: 'inherit' });
    ownsDb = true;
    const ready = await waitForPort(DB_PORT, 60_000);
    if (!ready) {
      console.error('[e2e] dev database failed to start on port ' + DB_PORT);
      process.exit(1);
    }
  } else {
    console.log('[e2e] dev database already running on port ' + DB_PORT);
  }

  console.log('[e2e] sync database schema (prisma db push, no migration history) ...');
  let status = run([
    '--filter',
    '@cphos/api',
    'exec',
    'prisma',
    'db',
    'push',
    '--accept-data-loss',
  ]);
  if (status !== 0) process.exit(status);

  console.log('[e2e] seed dictionaries ...');
  status = run(['--filter', '@cphos/api', 'seed:dev']);
  if (status !== 0) process.exit(status);

  console.log('[e2e] run Playwright (Microsoft Edge) ...');
  const args = ['exec', 'playwright', 'test', ...process.argv.slice(2)];
  const testResult = spawnSync(pnpm, args, { cwd: root, stdio: 'inherit', shell: useShell });
  if (testResult.error) console.error('[e2e] playwright error:', testResult.error.message);
  const exitCode = testResult.status === null ? 1 : testResult.status;
  cleanup();
  process.exit(exitCode);
}

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (ownsDb && dbProcess && dbProcess.pid) {
    console.log('[e2e] stopping embedded database ...');
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(dbProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-dbProcess.pid); } catch { /* ignore */ }
    }
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
process.on('exit', cleanup);

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
