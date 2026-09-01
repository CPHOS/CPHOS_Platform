// E2E 专用种子：清空业务数据并创建固定测试账号（仅本地测试，可反复执行）
// 账号密码均为测试用途，见文件末尾输出。
import { prisma } from '../src/db.js';
import { env } from '../src/env.js';
import { hashPassword } from '../src/lib/password.js';
import { assertDisposableDatabase } from './e2e-db-guard.js';

export const E2E_ACCOUNTS = {
  super: { loginName: 'e2e_super', displayName: 'E2E 超级管理员', password: 'E2eSuper123!' },
  admin: { loginName: 'e2e_admin', displayName: 'E2E 管理员', password: 'E2eAdmin123!' },
  member: { loginName: 'e2e_member', displayName: 'E2E 内部成员', password: 'E2eMember123!' },
  coach: { email: 'e2e.coach@example.com', displayName: 'E2E 教练甲', password: 'E2eCoach123!' },
  coach2: { email: 'e2e.coach2@example.com', displayName: 'E2E 教练乙', password: 'E2eCoach123!' },
  reset: { email: 'e2e.reset@example.com', displayName: 'E2E 重置用户', password: 'E2eReset123!' },
  email: { email: 'e2e.email@example.com', displayName: 'E2E 换绑用户', password: 'E2eEmail123!' },
} as const;

async function main() {
  // 必须先证明连接的是可丢弃的 E2E 数据库，再执行不可逆清库，防止误连开发/共享/生产库
  assertDisposableDatabase(env.DATABASE_URL, env.NODE_ENV);

  // 清空业务表（保留字典；CASCADE 处理外键）
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditMaterial", "AuditApplication", "AuditLog", "MarkRecord", "MarkingTask", "AllocationItem", "AllocationBatch", "RefreshToken", "EmailCode", "QuestionImage", "PaperQuestion", "PaperPage", "Paper", "MemberProfile", "Team", "UserAccount" RESTART IDENTITY CASCADE',
  );

  // 保证有一个可用赛区/学校（自增 ID）
  const area = await prisma.area.upsert({
    where: { name: 'E2E赛区' },
    create: { name: 'E2E赛区' },
    update: {},
  });
  const school = await prisma.school.upsert({
    where: { name_areaId: { name: 'E2E测试中学', areaId: area.id } },
    create: { name: 'E2E测试中学', areaId: area.id },
    update: {},
  });

  // 内部账号：超管 / 管理员 / CPHOS 成员
  await prisma.userAccount.create({
    data: {
      loginName: E2E_ACCOUNTS.super.loginName,
      displayName: E2E_ACCOUNTS.super.displayName,
      passwordHash: await hashPassword(E2E_ACCOUNTS.super.password),
      role: 'SUPER_ADMIN',
      protected: true,
      status: 'ACTIVE',
    },
  });
  await prisma.userAccount.create({
    data: {
      loginName: E2E_ACCOUNTS.admin.loginName,
      displayName: E2E_ACCOUNTS.admin.displayName,
      passwordHash: await hashPassword(E2E_ACCOUNTS.admin.password),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  await prisma.userAccount.create({
    data: {
      loginName: E2E_ACCOUNTS.member.loginName,
      displayName: E2E_ACCOUNTS.member.displayName,
      passwordHash: await hashPassword(E2E_ACCOUNTS.member.password),
      role: 'CPHOS_MEMBER',
      status: 'ACTIVE',
    },
  });

  // 平台用户：带成员资料，供团队管理选择
  const coach = await prisma.userAccount.create({
    data: {
      email: E2E_ACCOUNTS.coach.email,
      displayName: E2E_ACCOUNTS.coach.displayName,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(E2E_ACCOUNTS.coach.password),
      role: 'PLATFORM_USER',
      status: 'ACTIVE',
    },
  });
  await prisma.memberProfile.create({
    data: {
      userId: coach.id,
      realName: '教练甲',
      schoolId: school.id,
      role: 'LEADER',
      defaultSlot: 1,
      uploadLimit: 100,
      auditStatus: 1,
    },
  });

  const coach2 = await prisma.userAccount.create({
    data: {
      email: E2E_ACCOUNTS.coach2.email,
      displayName: E2E_ACCOUNTS.coach2.displayName,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(E2E_ACCOUNTS.coach2.password),
      role: 'PLATFORM_USER',
      status: 'ACTIVE',
    },
  });
  await prisma.memberProfile.create({
    data: {
      userId: coach2.id,
      realName: '教练乙',
      schoolId: school.id,
      role: 'LEADER',
      defaultSlot: 2,
      uploadLimit: 100,
      auditStatus: 1,
    },
  });

  // 账号安全测试专用平台用户（已验证、正常）
  for (const u of [E2E_ACCOUNTS.reset, E2E_ACCOUNTS.email]) {
    await prisma.userAccount.create({
      data: {
        email: u.email,
        displayName: u.displayName,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(u.password),
        role: 'PLATFORM_USER',
        status: 'ACTIVE',
      },
    });
  }

  // 一条成员资料操作日志，保证审计日志页有初始数据
  const admin = await prisma.userAccount.findUniqueOrThrow({
    where: { loginName: E2E_ACCOUNTS.admin.loginName },
  });
  await prisma.auditLog.create({
    data: {
      operatorId: admin.id,
      action: 'MEMBER_UPDATE',
      targetUserId: coach.id,
      remark: 'E2E 种子：初始化成员资料',
    },
  });
}

main()
  .then(() => {
    console.log('[seed-e2e] 测试账号已就绪（密码见 scripts/seed-e2e.ts）');
    return prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
