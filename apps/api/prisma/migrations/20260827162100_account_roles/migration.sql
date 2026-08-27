-- 账号层级模型调整：isAdmin 布尔 → AccountRole 枚举 + 受保护标记
-- 数据映射：旧 isAdmin=true 的账号 → ADMIN（超级管理员由初始化脚本另行创建）

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CPHOS_MEMBER', 'PLATFORM_USER');

-- AlterTable：先加新列（带默认值）
ALTER TABLE "UserAccount" ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'PLATFORM_USER';
ALTER TABLE "UserAccount" ADD COLUMN "protected" BOOLEAN NOT NULL DEFAULT false;

-- 数据映射：旧管理员 → ADMIN
UPDATE "UserAccount" SET "role" = 'ADMIN' WHERE "isAdmin" = true;

-- 删除旧列
ALTER TABLE "UserAccount" DROP COLUMN "isAdmin";
