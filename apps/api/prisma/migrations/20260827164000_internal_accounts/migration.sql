-- 内部账号模型：用户名 + 显示名 + 密码（不依赖邮箱）；仲裁改为功能模块（业务角色去掉 ARBITRATOR）

-- 1) UserAccount：新增 loginName / displayName，email 改为可空（仅平台用户使用）
ALTER TABLE "UserAccount" ADD COLUMN "loginName" TEXT;
ALTER TABLE "UserAccount" ADD COLUMN "displayName" TEXT;
ALTER TABLE "UserAccount" ALTER COLUMN "email" DROP NOT NULL;

-- 2) loginName 唯一索引（NULL 可重复，仅内部账号有值）
CREATE UNIQUE INDEX "UserAccount_loginName_key" ON "UserAccount"("loginName");

-- 3) 业务角色枚举：先清理内部账号的业务资料行（仲裁=功能模块，不再需要），再替换枚举
DELETE FROM "MemberProfile" p USING "UserAccount" u
  WHERE u.id = p."userId" AND u.role <> 'PLATFORM_USER';

CREATE TYPE "MemberRole_new" AS ENUM ('LEADER', 'COACH');
ALTER TABLE "MemberProfile" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "MemberProfile" ALTER COLUMN "role" TYPE "MemberRole_new"
  USING (CASE WHEN "role" = 'ARBITRATOR' THEN 'LEADER' ELSE "role"::text END)::"MemberRole_new";
DROP TYPE "MemberRole";
ALTER TYPE "MemberRole_new" RENAME TO "MemberRole";
ALTER TABLE "MemberProfile" ALTER COLUMN "role" SET DEFAULT 'LEADER';
