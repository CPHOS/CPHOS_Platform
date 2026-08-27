// 开发环境清理：删除旧的邮箱型测试账号（开发专用，生产禁用）
import { prisma } from '../src/db.js';

const emails = ['super@example.com', 'member@example.com', 'ops@example.com', 'admin@example.com'];

for (const email of emails) {
  const u = await prisma.userAccount.findUnique({ where: { email } });
  if (u) {
    await prisma.userAccount.delete({ where: { id: u.id } });
    console.log(`[dev-cleanup] 已删除 ${email}`);
  }
}
await prisma.$disconnect();
