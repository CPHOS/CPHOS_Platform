import type {
  AuditApplicationDto,
  AuditLogDto,
  LegacyMemberCandidateDto,
  ListApplicationsQuery,
  ReviewDecisionInput,
  SubmitApplicationInput,
} from '@cphos/shared';
import type { AuditApplication, LegacyMemberRef } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

/** 旧库"个人"学校 id（特殊条目，个人参赛者 uploadLimit 默认 1） */
const INDIVIDUAL_SCHOOL_ID = 134n;
/** 普通用户上传限额默认值（旧平台默认 100） */
const DEFAULT_UPLOAD_LIMIT = 100;

// ---------- 用户（申请归属）include ----------

const APPLICATION_USER_SELECT = {
  select: { id: true, email: true, loginName: true },
} as const;

type ApplicationWithUser = AuditApplication & {
  user: { id: bigint; email: string | null; loginName: string | null };
};

// ---------- DTO ----------

async function schoolNameMap(ids: (bigint | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is bigint => x !== null))];
  if (unique.length === 0) return new Map();
  const schools = await prisma.school.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(schools.map((s) => [String(s.id), s.name]));
}

function toApplicationDto(app: ApplicationWithUser, schoolName: string | null): AuditApplicationDto {
  return {
    id: String(app.id),
    status: app.status,
    realName: app.realName,
    schoolId: app.schoolId === null ? null : String(app.schoolId),
    schoolName,
    wechatNickname: app.wechatNickname,
    contact: app.contact,
    applyNote: app.applyNote,
    claimLegacy: app.claimLegacy,
    matchedLegacyMemberId: app.matchedLegacyMemberId === null ? null : String(app.matchedLegacyMemberId),
    reviewRemark: app.reviewRemark,
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
    materialRequestedAt: app.materialRequestedAt?.toISOString() ?? null,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    user: { id: String(app.user.id), email: app.user.email, loginName: app.user.loginName },
  };
}

async function findApplicationWithUser(id: bigint): Promise<ApplicationWithUser> {
  const app = await prisma.auditApplication.findUnique({
    where: { id },
    include: { user: APPLICATION_USER_SELECT },
  });
  if (!app) throw Errors.notFound('申请');
  return app;
}

async function latestApplication(userId: bigint): Promise<ApplicationWithUser | null> {
  return prisma.auditApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { user: APPLICATION_USER_SELECT },
  });
}

async function toDtoWithSchool(app: ApplicationWithUser): Promise<AuditApplicationDto> {
  const map = await schoolNameMap([app.schoolId]);
  return toApplicationDto(app, app.schoolId === null ? null : (map.get(String(app.schoolId)) ?? null));
}

// ---------- 业务操作（用户侧） ----------

/** 提交/修改资料仅限待审核用户；已通过（ACTIVE）用户禁止再提交 */
async function assertPendingUser(userId: bigint): Promise<void> {
  const user = await prisma.userAccount.findUnique({ where: { id: userId } });
  if (!user) throw Errors.unauthorized();
  if (user.status !== 'PENDING') throw Errors.validation('当前账号已通过审核，无需重复提交资料');
}

export async function submitApplication(
  userId: bigint,
  input: SubmitApplicationInput,
): Promise<AuditApplicationDto> {
  await assertPendingUser(userId);

  const latest = await latestApplication(userId);
  if (latest?.status === 'PENDING') throw Errors.applicationExists();

  const app = await prisma.auditApplication.create({
    data: {
      userId,
      realName: input.realName,
      schoolId: BigInt(input.schoolId),
      wechatNickname: input.wechatNickname,
      contact: input.contact,
      applyNote: input.applyNote ?? null,
      claimLegacy: input.claimLegacy,
    },
    include: { user: APPLICATION_USER_SELECT },
  });
  return toDtoWithSchool(app);
}

export async function updateApplication(
  userId: bigint,
  input: SubmitApplicationInput,
): Promise<AuditApplicationDto> {
  await assertPendingUser(userId);

  const latest = await latestApplication(userId);
  if (!latest) throw Errors.notFound('申请');
  // 允许修改：已驳回，或管理员要求补材料（PENDING 但带补材料标记）
  const editable =
    latest.status === 'REJECTED' || (latest.status === 'PENDING' && latest.materialRequestedAt !== null);
  if (!editable) throw Errors.applicationNotEditable();

  const app = await prisma.auditApplication.update({
    where: { id: latest.id },
    data: {
      realName: input.realName,
      schoolId: BigInt(input.schoolId),
      wechatNickname: input.wechatNickname,
      contact: input.contact,
      applyNote: input.applyNote ?? null,
      claimLegacy: input.claimLegacy,
      status: 'PENDING',
      reviewRemark: null,
      reviewedAt: null,
      reviewerId: null,
      matchedLegacyMemberId: null,
      materialRequestedAt: null,
    },
    include: { user: APPLICATION_USER_SELECT },
  });
  return toDtoWithSchool(app);
}

export async function getMyApplication(userId: bigint): Promise<AuditApplicationDto | null> {
  const latest = await latestApplication(userId);
  if (!latest) return null;
  return toDtoWithSchool(latest);
}

// ---------- 业务操作（管理侧） ----------

export async function listApplications(query: ListApplicationsQuery): Promise<{
  items: AuditApplicationDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { status, q, page, pageSize } = query;
  const where: Prisma.AuditApplicationWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { realName: { contains: q } },
            { wechatNickname: { contains: q } },
            { contact: { contains: q } },
            { user: { email: { contains: q } } },
            { user: { loginName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditApplication.count({ where }),
    prisma.auditApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: APPLICATION_USER_SELECT },
    }),
  ]);

  const map = await schoolNameMap(rows.map((r) => r.schoolId));
  const items = rows.map((r) =>
    toApplicationDto(r, r.schoolId === null ? null : (map.get(String(r.schoolId)) ?? null)),
  );
  return { items, total, page, pageSize };
}

export async function getApplication(id: bigint): Promise<AuditApplicationDto> {
  const app = await findApplicationWithUser(id);
  return toDtoWithSchool(app);
}

// ---------- 认领匹配 ----------

export function scoreCandidate(
  app: { realName: string; wechatNickname: string | null; schoolId: bigint | null },
  ref: Pick<LegacyMemberRef, 'realName' | 'wechatNickname' | 'schoolId'>,
): number {
  let score = 0;
  const realName = app.realName.trim();
  if (ref.realName && ref.realName === realName) score += 100;
  else if (ref.realName && (ref.realName.includes(realName) || realName.includes(ref.realName))) score += 40;

  const nick = app.wechatNickname?.trim();
  if (nick && ref.wechatNickname === nick) score += 60;
  else if (nick && ref.wechatNickname && (ref.wechatNickname.includes(nick) || nick.includes(ref.wechatNickname)))
    score += 25;

  if (app.schoolId && ref.schoolId === app.schoolId) score += 30;
  return score;
}

export async function matchCandidates(applicationId: bigint): Promise<LegacyMemberCandidateDto[]> {
  const app = await prisma.auditApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw Errors.notFound('申请');

  const realName = app.realName.trim();
  const nick = app.wechatNickname?.trim();
  if (!realName && !nick) return [];

  const refs = await prisma.legacyMemberRef.findMany({
    where: {
      OR: [
        { realName: { contains: realName } },
        ...(nick ? [{ wechatNickname: { contains: nick } }] : []),
      ],
    },
    take: 200,
  });

  const schoolIds = [...new Set(refs.map((r) => r.schoolId).filter((x): x is bigint => x !== null))];
  const map = schoolIds.length ? await schoolNameMap(schoolIds) : new Map<string, string>();

  return refs
    .map((r) => ({
      id: String(r.id),
      realName: r.realName,
      wechatNickname: r.wechatNickname,
      wechatAvatar: r.wechatAvatar,
      schoolId: r.schoolId === null ? null : String(r.schoolId),
      schoolName: r.schoolId === null ? null : (map.get(String(r.schoolId)) ?? null),
      auditStatus: r.auditStatus,
      roleType: r.roleType,
      defaultTopicId: r.defaultTopicId,
      uploadLimit: r.uploadLimit,
      score: scoreCandidate({ realName, wechatNickname: app.wechatNickname, schoolId: app.schoolId }, r),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// ---------- 审核状态机 ----------

export async function review(
  id: bigint,
  reviewerId: bigint,
  decision: ReviewDecisionInput,
): Promise<AuditApplicationDto> {
  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.auditApplication.findUnique({ where: { id } });
      if (!app) throw Errors.notFound('申请');
      if (app.status !== 'PENDING') throw Errors.alreadyReviewed();

      const now = new Date();

      if (decision.action === 'APPROVE') {
        let legacyMemberId: bigint | null = null;
        if (decision.legacyMemberId) {
          legacyMemberId = BigInt(decision.legacyMemberId);
          // 校验旧账号存在于参照快照，防止绑定不存在的旧 id / 张冠李戴
          const ref = await tx.legacyMemberRef.findUnique({ where: { id: legacyMemberId } });
          if (!ref) throw Errors.validation('该旧账号不存在');
          const claimed = await tx.userAccount.findFirst({ where: { legacyMemberId } });
          if (claimed && claimed.id !== app.userId) throw Errors.legacyAlreadyClaimed();
        }

        const schoolId = app.schoolId;
        const uploadLimit =
          decision.uploadLimit ?? (schoolId === INDIVIDUAL_SCHOOL_ID ? 1 : DEFAULT_UPLOAD_LIMIT);

        // 原子抢占：仅首个事务能将 PENDING 流转，避免并发双重审批（updateMany 条件更新）
        const transitioned = await tx.auditApplication.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'APPROVED',
            matchedLegacyMemberId: legacyMemberId,
            reviewerId,
            reviewRemark: decision.remark ?? null,
            reviewedAt: now,
            materialRequestedAt: null,
          },
        });
        if (transitioned.count !== 1) throw Errors.alreadyReviewed();

        await tx.memberProfile.upsert({
          where: { userId: app.userId },
          create: {
            userId: app.userId,
            realName: app.realName,
            schoolId,
            role: 'LEADER',
            defaultSlot: decision.defaultSlot ?? null,
            uploadLimit,
            auditStatus: 1,
          },
          update: {
            realName: app.realName,
            schoolId,
            role: 'LEADER',
            defaultSlot: decision.defaultSlot ?? null,
            uploadLimit,
            auditStatus: 1,
          },
        });

        try {
          await tx.userAccount.update({
            where: { id: app.userId },
            data: { status: 'ACTIVE', legacyMemberId: legacyMemberId ?? undefined },
          });
        } catch (err) {
          // 并发下唯一约束兜底：同一旧账号被并发认领 → 409
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw Errors.legacyAlreadyClaimed();
          }
          throw err;
        }

        await tx.auditLog.create({
          data: { applicationId: id, operatorId: reviewerId, action: 'APPROVE', legacyMemberId, remark: decision.remark ?? null },
        });
        if (legacyMemberId) {
          await tx.auditLog.create({
            data: { applicationId: id, operatorId: reviewerId, action: 'BIND_LEGACY', legacyMemberId },
          });
        }
        return;
      }

      if (decision.action === 'REJECT') {
        const transitioned = await tx.auditApplication.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'REJECTED',
            reviewerId,
            reviewRemark: decision.remark ?? null,
            reviewedAt: now,
            materialRequestedAt: null,
          },
        });
        if (transitioned.count !== 1) throw Errors.alreadyReviewed();
        await tx.auditLog.create({
          data: { applicationId: id, operatorId: reviewerId, action: 'REJECT', remark: decision.remark ?? null },
        });
        return;
      }

      // REQUEST_MATERIAL：申请保持 PENDING，但记录"待补材料"状态供用户侧展示
      const transitioned = await tx.auditApplication.updateMany({
        where: { id, status: 'PENDING' },
        data: { materialRequestedAt: now, reviewRemark: decision.remark ?? null, reviewerId },
      });
      if (transitioned.count !== 1) throw Errors.alreadyReviewed();
      await tx.auditLog.create({
        data: { applicationId: id, operatorId: reviewerId, action: 'REQUEST_MATERIAL', remark: decision.remark ?? null },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.legacyAlreadyClaimed();
    }
    throw err;
  }

  return getApplication(id);
}

// ---------- 审计日志 ----------

export async function listLogs(options: {
  applicationId?: bigint;
  page: number;
  pageSize: number;
}): Promise<{ items: AuditLogDto[]; total: number; page: number; pageSize: number }> {
  const { applicationId, page, pageSize } = options;
  const where = applicationId ? { applicationId } : {};

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const operatorIds = [...new Set(rows.map((r) => r.operatorId))];
  const operators = operatorIds.length
    ? await prisma.userAccount.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, displayName: true, loginName: true, email: true },
      })
    : [];
  const nameMap = new Map(
    operators.map((o) => [String(o.id), o.displayName ?? o.loginName ?? o.email ?? null]),
  );

  const items: AuditLogDto[] = rows.map((r) => ({
    id: String(r.id),
    applicationId: r.applicationId === null ? null : String(r.applicationId),
    action: r.action,
    operatorId: String(r.operatorId),
    operatorName: nameMap.get(String(r.operatorId)) ?? null,
    legacyMemberId: r.legacyMemberId === null ? null : String(r.legacyMemberId),
    remark: r.remark,
    createdAt: r.createdAt.toISOString(),
  }));
  return { items, total, page, pageSize };
}
