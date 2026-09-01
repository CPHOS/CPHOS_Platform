/** 与 apps/api/scripts/seed-e2e.ts 保持一致的固定测试账号 */
export const ACCOUNTS = {
  super: { account: 'e2e_super', password: 'E2eSuper123!' },
  admin: { account: 'e2e_admin', password: 'E2eAdmin123!' },
  member: { account: 'e2e_member', password: 'E2eMember123!' },
  coach: { account: 'e2e.coach@example.com', password: 'E2eCoach123!' },
  coach2: { account: 'e2e.coach2@example.com', password: 'E2eCoach123!' },
  rankCoach: { account: 'e2e.rank.coach@example.com', password: 'E2eRankCoach123!' },
  rankCoach2: { account: 'e2e.rank.coach2@example.com', password: 'E2eRankCoach123!' },
  rankCoach3: { account: 'e2e.rank.coach3@example.com', password: 'E2eRankCoach123!' },
  reset: { account: 'e2e.reset@example.com', password: 'E2eReset123!' },
  email: { account: 'e2e.email@example.com', password: 'E2eEmail123!' },
} as const;
