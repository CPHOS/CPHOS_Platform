// 系统初始化：创建**唯一**超级管理员（用户名 + 显示名 + 密码，不依赖邮箱）
// 用法：pnpm api:init-super-admin -- <username> <displayName> <password>
// 规则：全局只允许一个超级管理员；已存在时拒绝再建（对已存在的目标账号做提升除外）。
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

const args = process.argv.slice(2);
const loginName = (args[0] ?? '').trim().toLowerCase();
const displayName = args[1] ?? '';
const password = args[2] ?? '';

if (!loginName || !displayName || !password) {
  console.error('用法: pnpm api:init-super-admin -- <username> <displayName> <password>');
  process.exit(1);
}

const existingSuperAdmin = await prisma.userAccount.findFirst({
  where: { role: 'SUPER_ADMIN' },
});

const target = await prisma.userAccount.findUnique({ where: { loginName } });

if (existingSuperAdmin && existingSuperAdmin.loginName !== loginName && target === null) {
  console.error(
    `已存在超级管理员「${existingSuperAdmin.loginName}」，系统仅允许一个超级管理员。` +
      '如需更换请先人工处理现有超级管理员。',
  );
  process.exit(1);
}

if (target) {
  if (existingSuperAdmin && existingSuperAdmin.id !== target.id) {
    console.error(`账号 ${loginName} 已存在且不是当前超级管理员，拒绝提升第二个超级管理员。`);
    process.exit(1);
  }
  await prisma.userAccount.update({
    where: { id: target.id },
    data: { role: 'SUPER_ADMIN', protected: true, status: 'ACTIVE', displayName },
  });
  console.log(`[init-super-admin] 已将 ${loginName}（${displayName}）提升为唯一超级管理员`);
} else {
  await prisma.userAccount.create({
    data: {
      loginName,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'SUPER_ADMIN',
      protected: true,
      status: 'ACTIVE',
    },
  });
  console.log(`[init-super-admin] 已创建唯一超级管理员: ${loginName}（${displayName}）`);
}
await prisma.$disconnect();
