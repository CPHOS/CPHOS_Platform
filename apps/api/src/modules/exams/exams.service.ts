import type {
  ExamConfigDto,
  ExamDto,
  ExamListDto,
  ListExamsQuery,
  UpsertExamConfigInput,
  UpdateExamInput,
  CreateExamInput,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

const EXAM_INCLUDE = {
  config: true,
  createdBy: {
    select: { displayName: true, loginName: true, email: true },
  },
} as const;

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof EXAM_INCLUDE }>;

function toNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value) : 0;
}

function toConfigDto(config: ExamWithRelations['config']): ExamConfigDto | null {
  if (!config) return null;
  const titleMapping = Array.isArray(config.titleMapping)
    ? (config.titleMapping as unknown as ExamConfigDto['titleMapping'])
    : null;
  return {
    id: String(config.id),
    examId: String(config.examId),
    slotCount: config.slotCount,
    defaultPoint: toNumber(config.defaultPoint),
    gap: toNumber(config.gap),
    titleMapping,
    updatedAt: config.updatedAt.toISOString(),
  };
}

function personName(user: { displayName: string | null; loginName: string | null; email: string | null }): string | null {
  return user.displayName ?? user.loginName ?? user.email ?? null;
}

function toExamDto(exam: ExamWithRelations): ExamDto {
  return {
    id: String(exam.id),
    name: exam.name,
    description: exam.description,
    status: exam.status,
    createdById: String(exam.createdById),
    createdByName: personName(exam.createdBy),
    publishedAt: exam.publishedAt?.toISOString() ?? null,
    closedAt: exam.closedAt?.toISOString() ?? null,
    archivedAt: exam.archivedAt?.toISOString() ?? null,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
    config: toConfigDto(exam.config),
  };
}

async function findExamOrThrow(id: bigint): Promise<ExamWithRelations> {
  const exam = await prisma.exam.findUnique({ where: { id }, include: EXAM_INCLUDE });
  if (!exam) throw Errors.notFound('考试');
  return exam;
}

export async function listExams(query: ListExamsQuery): Promise<ExamListDto> {
  const { status, q, page, pageSize } = query;
  const where: Prisma.ExamWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: EXAM_INCLUDE,
    }),
  ]);
  return { items: rows.map(toExamDto), total, page, pageSize };
}

export async function getExam(id: bigint): Promise<ExamDto> {
  return toExamDto(await findExamOrThrow(id));
}

export async function createExam(
  operatorId: bigint,
  input: CreateExamInput,
): Promise<ExamDto> {
  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        createdById: operatorId,
      },
      include: EXAM_INCLUDE,
    });
    await tx.auditLog.create({
      data: { operatorId, action: 'EXAM_CREATE', examId: created.id, remark: input.name },
    });
    return created;
  });
  return toExamDto(exam);
}

export async function updateExam(
  id: bigint,
  operatorId: bigint,
  input: UpdateExamInput,
): Promise<ExamDto> {
  const current = await findExamOrThrow(id);
  if (current.status === 'ARCHIVED') throw Errors.validation('已归档考试不可修改');
  const changes: string[] = [];
  if (input.name !== undefined) changes.push('名称=' + input.name);
  if (input.description !== undefined) changes.push('描述已更新');

  const exam = await prisma.$transaction(async (tx) => {
    const updated = await tx.exam.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: EXAM_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'EXAM_UPDATE',
        examId: id,
        remark: changes.length ? changes.join('；') : null,
      },
    });
    return updated;
  });
  return toExamDto(exam);
}

export async function upsertExamConfig(
  id: bigint,
  operatorId: bigint,
  input: UpsertExamConfigInput,
): Promise<ExamDto> {
  const exam = await findExamOrThrow(id);
  if (exam.status !== 'DRAFT') throw Errors.validation('仅草稿考试可修改配置（发布后请保持配置冻结）');

  await prisma.$transaction(async (tx) => {
    await tx.examConfig.upsert({
      where: { examId: id },
      create: {
        examId: id,
        slotCount: input.slotCount,
        defaultPoint: input.defaultPoint,
        gap: input.gap,
        titleMapping: input.titleMapping ?? [],
      },
      update: {
        slotCount: input.slotCount,
        defaultPoint: input.defaultPoint,
        gap: input.gap,
        titleMapping: input.titleMapping ?? [],
      },
    });
    await tx.auditLog.create({
      data: { operatorId, action: 'EXAM_CONFIG', examId: id, remark: '更新考试级配置' },
    });
  });
  return getExam(id);
}

export async function publishExam(id: bigint, operatorId: bigint): Promise<ExamDto> {
  const exam = await findExamOrThrow(id);
  if (exam.status !== 'DRAFT') throw Errors.validation('仅草稿考试可发布');
  if (!exam.config) throw Errors.validation('请先完成考试配置再发布');

  await prisma.$transaction(async (tx) => {
    const changed = await tx.exam.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    if (changed.count !== 1) throw Errors.validation('考试状态已变化，请刷新后重试');
    await tx.auditLog.create({ data: { operatorId, action: 'EXAM_PUBLISH', examId: id } });
  });
  return getExam(id);
}

export async function closeExam(id: bigint, operatorId: bigint): Promise<ExamDto> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${id})`;
    const exam = await tx.exam.findUnique({ where: { id }, select: { status: true } });
    if (!exam) throw Errors.notFound('考试');
    if (exam.status !== 'PUBLISHED') throw Errors.validation('仅已发布考试可结束');

    const pendingTasks = await tx.markingTask.count({
      where: { allocation: { examId: id }, status: 'PENDING' },
    });
    if (pendingTasks > 0) throw Errors.validation('仍有 ' + pendingTasks + ' 个阅卷任务未完成，不能结束考试');
    const pendingArbitrations = await tx.arbitration.count({
      where: {
        status: { in: ['PENDING', 'CLAIMED'] },
        paperQuestion: { paper: { examId: id } },
      },
    });
    if (pendingArbitrations > 0) {
      throw Errors.validation('仍有 ' + pendingArbitrations + ' 个仲裁任务未完成，不能结束考试');
    }
    const unfinalized = await tx.paper.count({
      where: { examId: id, finalizedAt: null, status: { not: 'ARCHIVED' } },
    });
    if (unfinalized > 0) {
      throw Errors.validation('仍有 ' + unfinalized + ' 份有效整卷未定稿，不能结束考试');
    }

    const changed = await tx.exam.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    if (changed.count !== 1) throw Errors.validation('考试状态已变化，请刷新后重试');
    await tx.auditLog.create({ data: { operatorId, action: 'EXAM_CLOSE', examId: id } });
  });
  return getExam(id);
}

export async function archiveExam(id: bigint, operatorId: bigint): Promise<ExamDto> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${id})`;
    const exam = await tx.exam.findUnique({ where: { id }, select: { status: true } });
    if (!exam) throw Errors.notFound('考试');
    if (exam.status !== 'CLOSED') throw Errors.validation('仅已结束考试可归档');
    // 用户主动归档的放弃卷不阻塞整场考试归档
    const unfinalized = await tx.paper.count({
      where: { examId: id, finalizedAt: null, status: { not: 'ARCHIVED' } },
    });
    if (unfinalized > 0) throw Errors.validation('仍有 ' + unfinalized + ' 份整卷未定稿，不能归档');

    const changed = await tx.exam.updateMany({
      where: { id, status: 'CLOSED' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (changed.count !== 1) throw Errors.validation('考试状态已变化，请刷新后重试');
    await tx.auditLog.create({ data: { operatorId, action: 'EXAM_ARCHIVE', examId: id } });
  });
  return getExam(id);
}

export async function deleteDraftExam(id: bigint, operatorId: bigint): Promise<void> {
  const exam = await findExamOrThrow(id);
  if (exam.status !== 'DRAFT') throw Errors.validation('仅草稿考试可删除，请改用归档/关闭');
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'EXAM_UPDATE',
        examId: id,
        remark: '删除草稿考试「' + exam.name + '」',
      },
    });
    await tx.exam.delete({ where: { id } });
  });
}
