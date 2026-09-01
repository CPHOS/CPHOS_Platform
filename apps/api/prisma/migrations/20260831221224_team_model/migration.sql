-- 团队模型补全：leader 关系 + 共享上传限额（Team.uploadLimit 取代 MemberProfile.uploadLimit）

-- 1) Team 新增字段
ALTER TABLE "Team" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "uploadLimit" INTEGER NOT NULL DEFAULT 100;

-- 2) 为存量成员各建一个单人团队（leader=该成员），搬运原 uploadLimit
INSERT INTO "Team" ("name", "leaderId", "uploadLimit", "createdAt", "updatedAt")
SELECT NULL, id, "uploadLimit", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MemberProfile";

UPDATE "MemberProfile" m
SET "teamId" = t.id
FROM "Team" t
WHERE t."leaderId" = m.id;

-- 3) 删除 MemberProfile.uploadLimit
ALTER TABLE "MemberProfile" DROP COLUMN "uploadLimit";

-- 4) leader 唯一约束 + 外键
CREATE UNIQUE INDEX "Team_leaderId_key" ON "Team"("leaderId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
