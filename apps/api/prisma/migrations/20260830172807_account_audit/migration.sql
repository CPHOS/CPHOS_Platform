-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_ACCOUNT';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'STATUS_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_UPDATE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "targetUserId" BIGINT;

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");
