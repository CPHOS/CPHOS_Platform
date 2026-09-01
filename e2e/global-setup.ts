import { execSync } from 'node:child_process';

/** E2E 前重置数据库并写入固定测试账号；数据库需由 pnpm e2e 预先启动 */
export default function globalSetup(): void {
  console.log('[e2e] reset & seed test data ...');
  execSync('pnpm --filter @cphos/api seed:e2e', { stdio: 'inherit' });
}
