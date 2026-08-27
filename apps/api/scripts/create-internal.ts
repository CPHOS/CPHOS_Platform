// 管理员 CLI：创建内部账号（CPHOS_MEMBER / ADMIN）
// 内部账号模型：用户名 + 显示名 + 密码，完全不依赖邮箱（不走注册/验证/审核）
// 用法：pnpm api:create-internal -- <username> <displayName> <password> <CPHOS_MEMBER|ADMIN>
// 账号已存在 → 更新角色/显示名（仅运维初始化用途；在线管理界面在块 2 提供）
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

const args = process.argv.slice(2);
const loginName = (args[0] ?? '').trim().toLowerCase();
const displayName = args[1] ?? '';
const password = args[2] ?? '';
const roleArg = (args[3] ?? '').toUpperCase();

if (!loginName || !displayName || !password || (roleArg !== 'CPHOS_MEMBER' && roleArg !== 'ADMIN')) {
  console.error('用法: pnpm api:create-internal -- <username> <displayName> <password> <CPHOS_MEMBER|ADMIN>');
  process.exit(1);
}

const role = roleArg as 'CPHOS_MEMBER' | 'ADMIN';

const existing = await prisma.userAccount.findUnique({ where: { loginName } });
if (existing) {
  await prisma.userAccount.update({
    where: { id: existing.id },
    data: { role, displayName, status: existing.status === 'DISABLED' ? 'ACTIVE' : existing.status },
  });
  console.log(`[create-internal] 已更新 ${loginName}（${displayName}）→ ${role}`);
} else {
  await prisma.userAccount.create({
    data: {
      loginName,
      displayName,
      passwordHash: await hashPassword(password),
      role,
      status: 'ACTIVE', // 内部账号建档即正常
    },
  });
  console.log(`[create-internal] 已创建 ${loginName}（${displayName}）→ ${role}`);
}
await prisma.$disconnect();
