import type {
  AllocationBatchDto,
  AllocationBatchListDto,
  AllocationItemDto,
  AllocationPreviewDto,
  CreateAllocationInput,
  ListAllocationBatchesQuery,
  ListMarkingTasksQuery,
  MarkingTaskDto,
  MarkingTaskListDto,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

const BATCH_INCLUDE = {
  exam: { select: { name: true } },
  createdBy: { select: { displayName: true, loginName: true, email: true } },
  items: {
    orderBy: [{ slot: 'asc' }, { taskCount: 'desc' }],
    include: {
      assignee: {
        select: {
          realName: true,
          user: { select: { displayName: true, loginName: true, email: true } },
        },
      },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.AllocationBatchInclude;

type BatchWithRelations = Prisma.AllocationBatchGetPayload<{ include: typeof BATCH_INCLUDE }>;

function personName(input: {
  realName?: string | null;
  user?: { displayName: string | null; loginName: string | null; email: string | null } | null;
  displayName?: string | null;
  loginName?: string | null;
  email?: string | null;
}): string | null {
  if ('displayName' in input) {
    return input.displayName ?? input.loginName ?? input.email ?? null;
  }
  return input.realName ?? input.user?.displayName ?? input.user?.loginName ?? input.user?.email ?? null;
}

function toItemDto(item: BatchWithRelations['items'][number]): AllocationItemDto {
  return {
    id: String(item.id),
    batchId: String(item.batchId),
    slot: item.slot,
    assigneeId: String(item.assigneeId),
    assigneeName: personName(item.assignee),
    taskCount: item.taskCount,
  };
}

function toBatchDto(batch: BatchWithRelations): AllocationBatchDto {
  return {
    id: String(batch.id),
    examId: String(batch.examId),
    examName: batch.exam.name,
    status: batch.status,
    createdByName: personName(batch.createdBy),
    note: batch.note,
    createdAt: batch.createdAt.toISOString(),
    revokedAt: batch.revokedAt?.toISOString() ?? null,
    totalTasks: batch._count.tasks,
    items: batch.items.map(toItemDto),
  };
}

async function findBatchOrThrow(id: bigint): Promise<BatchWithRelations> {
  const batch = await prisma.allocationBatch.findUnique({ where: { id }, include: BATCH_INCLUDE });
  if (!batch) throw Errors.notFound('分配批次');
  return batch;
}

async function recomputePaper(tx: Prisma.TransactionClient, paperId: bigint): Promise<void> {
  const questions = await tx.paperQuestion.findMany({ where: { paperId }, select: { finalScore: true } });
  const allFinal = questions.length > 0 && questions.every((q) => q.finalScore !== null);
  let total = new Prisma.Decimal(0);
  for (const q of questions) {
    if (q.finalScore !== null) total = total.plus(q.finalScore);
  }
  await tx.paper.update({
    where: { id: paperId },
    data: { score: allFinal ? total : null, finalizedAt: allFinal ? new Date() : null },
  });
}

export async function previewAllocation(examId: bigint): Promise<AllocationPreviewDto> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, name: true, status: true },
  });
  if (!exam) throw Errors.notFound('考试');
  if (exam.status !== 'PUBLISHED') throw Errors.validation('仅已发布考试可分配');

  const papers = await prisma.paper.findMany({
    where: { examId, status: 'READY', finalizedAt: null },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);
  const questions = paperIds.length
    ? await prisma.paperQuestion.findMany({
        where: { paperId: { in: paperIds } },
        select: { slot: true },
      })
    : [];

  const slotCounts = new Map<number, number>();
  for (const q of questions) slotCounts.set(q.slot, (slotCounts.get(q.slot) ?? 0) + 1);
  const slots = [...slotCounts.keys()].sort((a, b) => a - b);

  const examiners = slots.length
    ? await prisma.memberProfile.findMany({
        where: {
          defaultSlot: { in: slots },
          auditStatus: 1,
          user: { status: 'ACTIVE' },
        },
        select: { id: true, defaultSlot: true },
      })
    : [];
  const examinerCounts = new Map<number, number>();
  for (const e of examiners) {
    if (e.defaultSlot === null) continue;
    examinerCounts.set(e.defaultSlot, (examinerCounts.get(e.defaultSlot) ?? 0) + 1);
  }

  const unassignedSlots: number[] = [];
  const slotDtos = slots.map((slot) => {
    const questionCount = slotCounts.get(slot) ?? 0;
    const taskCount = questionCount * 2;
    const examinerCount = examinerCounts.get(slot) ?? 0;
    if (examinerCount === 0) unassignedSlots.push(slot);
    return {
      slot,
      questionCount,
      taskCount,
      examinerCount,
      minTasks: examinerCount ? Math.floor(taskCount / examinerCount) : 0,
      maxTasks: examinerCount ? Math.ceil(taskCount / examinerCount) : 0,
    };
  });

  return {
    examId: String(exam.id),
    examName: exam.name,
    readyPaperCount: papers.length,
    questionCount: questions.length,
    taskCount: questions.length * 2,
    slots: slotDtos,
    unassignedSlots,
  };
}

export async function createAllocation(
  examId: bigint,
  operatorId: bigint,
  input: CreateAllocationInput,
): Promise<AllocationBatchDto> {
  const preview = await previewAllocation(examId);
  if (preview.questionCount === 0) throw Errors.validation('没有已就绪的整卷题目可分配');
  if (preview.unassignedSlots.length > 0) {
    throw Errors.validation('以下槽位没有可用阅卷成员：' + preview.unassignedSlots.join(', '));
  }
  const papers = await prisma.paper.findMany({
    where: { examId, status: 'READY', finalizedAt: null },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);
  const questions = await prisma.paperQuestion.findMany({
    where: { paperId: { in: paperIds } },
    orderBy: { id: 'asc' },
    select: { id: true, slot: true },
  });
  const slots = [...new Set(questions.map((q) => q.slot))].sort((a, b) => a - b);
  const examiners = await prisma.memberProfile.findMany({
    where: {
      defaultSlot: { in: slots },
      auditStatus: 1,
      user: { status: 'ACTIVE' },
    },
    orderBy: { id: 'asc' },
    select: { id: true, defaultSlot: true },
  });
  const bySlot = new Map<number, bigint[]>();
  for (const e of examiners) {
    if (e.defaultSlot === null) continue;
    const list = bySlot.get(e.defaultSlot) ?? [];
    list.push(e.id);
    bySlot.set(e.defaultSlot, list);
  }

  const load = new Map<string, number>();
  const loadKey = (slot: number, id: bigint) => slot + ':' + String(id);
  const nextAssignee = (slot: number): bigint => {
    const list = bySlot.get(slot) ?? [];
    const first = list[0];
    if (!first) throw Errors.validation('槽位 ' + slot + ' 没有可用阅卷成员');
    let best = first;
    let bestLoad = load.get(loadKey(slot, best)) ?? 0;
    for (const id of list) {
      const value = load.get(loadKey(slot, id)) ?? 0;
      if (value < bestLoad || (value === bestLoad && id < best)) {
        best = id;
        bestLoad = value;
      }
    }
    load.set(loadKey(slot, best), (load.get(loadKey(slot, best)) ?? 0) + 1);
    return best;
  };

  const tasks: { paperQuestionId: bigint; roundNo: number; assigneeId: bigint }[] = [];
  for (const q of questions) {
    tasks.push({ paperQuestionId: q.id, roundNo: 1, assigneeId: nextAssignee(q.slot) });
    tasks.push({ paperQuestionId: q.id, roundNo: 2, assigneeId: nextAssignee(q.slot) });
  }

  const batch = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${examId})`;
    const freshExam = await tx.exam.findUnique({ where: { id: examId }, select: { status: true } });
    if (!freshExam || freshExam.status !== 'PUBLISHED') {
      throw Errors.validation('考试已非进行中状态，不能分配');
    }
    const active = await tx.allocationBatch.findFirst({ where: { examId, status: 'ACTIVE' } });
    if (active) throw Errors.validation('该考试已有生效中的分配批次');
    const created = await tx.allocationBatch.create({
      data: { examId, createdById: operatorId, note: input.note ?? null },
    });
    await tx.allocationItem.createMany({
      data: [...load.entries()].map(([key, count]) => {
        const [slotRaw, memberRaw] = key.split(':');
        if (!slotRaw || !memberRaw) throw Errors.validation('分配数据异常');
        return { batchId: created.id, slot: Number(slotRaw), assigneeId: BigInt(memberRaw), taskCount: count };
      }),
    });
    await tx.markingTask.createMany({
      data: tasks.map((t) => ({ ...t, allocationId: created.id, status: 'PENDING' as const })),
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'ALLOCATION_CREATE',
        examId,
        remark: '创建分配批次，共 ' + tasks.length + ' 个双阅任务',
      },
    });
    return tx.allocationBatch.findUniqueOrThrow({ where: { id: created.id }, include: BATCH_INCLUDE });
  });
  return toBatchDto(batch);
}

export async function listAllocationBatches(
  examId: bigint,
  query: ListAllocationBatchesQuery,
): Promise<AllocationBatchListDto> {
  const where: Prisma.AllocationBatchWhereInput = { examId };
  const [total, rows] = await Promise.all([
    prisma.allocationBatch.count({ where }),
    prisma.allocationBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: BATCH_INCLUDE,
    }),
  ]);
  return { items: rows.map(toBatchDto), total, page: query.page, pageSize: query.pageSize };
}

export async function getBatch(id: bigint): Promise<AllocationBatchDto> {
  return toBatchDto(await findBatchOrThrow(id));
}

export async function revokeBatch(id: bigint, operatorId: bigint): Promise<AllocationBatchDto> {
  const batch = await findBatchOrThrow(id);
  if (batch.status !== 'ACTIVE') throw Errors.validation('该批次不是生效中状态');
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.allocationBatch.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (changed.count !== 1) throw Errors.validation('该批次已撤销');
    const affected = await tx.markingTask.findMany({
      where: { allocationId: id },
      select: {
        paperQuestionId: true,
        paperQuestion: { select: { paperId: true } },
      },
    });
    const questionIds = [...new Set(affected.map((a) => a.paperQuestionId))];
    const paperIds = [...new Set(affected.map((a) => a.paperQuestion.paperId))].sort((a, b) =>
      a < b ? -1 : 1,
    );
    // 与阅卷/仲裁终审保持一致的 Paper 行锁，防止检查后被并发定稿
    for (const paperId of paperIds) {
      await tx.$executeRaw`SELECT id FROM "Paper" WHERE "id" = ${paperId} FOR UPDATE`;
    }
    const finalizedCount = paperIds.length
      ? await tx.paper.count({ where: { id: { in: paperIds }, finalizedAt: { not: null } } })
      : 0;
    if (finalizedCount > 0) {
      throw Errors.validation('该批次包含已定稿整卷，禁止撤销；如需重阅请走专门流程');
    }
    await tx.markingTask.updateMany({
      where: { allocationId: id, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });
    if (questionIds.length > 0) {
      await tx.arbitration.updateMany({
        where: { paperQuestionId: { in: questionIds }, status: { not: 'COMPLETED' } },
        data: { status: 'CANCELED', score: null },
      });
      // 已完成的旧仲裁同样不得再作为新批次成绩
      await tx.arbitration.updateMany({
        where: { paperQuestionId: { in: questionIds }, status: 'COMPLETED' },
        data: { status: 'CANCELED' },
      });
      await tx.paperQuestion.updateMany({
        where: { id: { in: questionIds } },
        data: { finalScore: null },
      });
    }
    for (const paperId of paperIds) {
      await recomputePaper(tx, paperId);
    }
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'ALLOCATION_REVOKE',
        examId: batch.examId,
        remark: '撤销分配批次 #' + id,
      },
    });
    return tx.allocationBatch.findUniqueOrThrow({ where: { id }, include: BATCH_INCLUDE });
  });
  return toBatchDto(updated);
}

export async function listMyMarkingTasks(
  userId: bigint,
  query: ListMarkingTasksQuery,
): Promise<MarkingTaskListDto> {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw Errors.forbidden();
  const where: Prisma.MarkingTaskWhereInput = {
    assigneeId: profile.id,
    allocation: { status: 'ACTIVE' },
    ...(query.status ? { status: query.status } : {}),
    ...(query.examId ? { paperQuestion: { paper: { examId: BigInt(query.examId) } } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.markingTask.count({ where }),
    prisma.markingTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        assignee: {
          select: {
            realName: true,
            user: { select: { displayName: true, loginName: true, email: true } },
          },
        },
        paperQuestion: {
          select: {
            id: true,
            slot: true,
            questionLabel: true,
            maxScore: true,
            images: {
              orderBy: { partIndex: 'asc' },
              select: {
                id: true,
                paperQuestionId: true,
                paperPageId: true,
                partIndex: true,
                crop: true,
                fileKey: true,
                createdAt: true,
                paperPage: { select: { pageNo: true, fileKey: true } },
              },
            },
            paper: {
              select: {
                id: true,
                examId: true,
                student: { select: { name: true } },
                exam: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const items: MarkingTaskDto[] = rows.map((task) => ({
    id: String(task.id),
    paperQuestionId: String(task.paperQuestionId),
    paperId: String(task.paperQuestion.paper.id),
    examId: String(task.paperQuestion.paper.examId),
    examName: task.paperQuestion.paper.exam.name,
    studentName: task.paperQuestion.paper.student.name,
    slot: task.paperQuestion.slot,
    questionLabel: task.paperQuestion.questionLabel,
    maxScore: Number(task.paperQuestion.maxScore),
    roundNo: task.roundNo,
    status: task.status,
    score: task.score === null ? null : Number(task.score),
    assigneeId: String(task.assigneeId),
    assigneeName: personName(task.assignee),
    images: task.paperQuestion.images.map((image) => ({
      id: String(image.id),
      paperQuestionId: String(image.paperQuestionId),
      paperPageId: String(image.paperPageId),
      partIndex: image.partIndex,
      crop: (image.crop as { x: number; y: number; width: number; height: number } | null) ?? null,
      fileKey: image.fileKey,
      pageNo: image.paperPage.pageNo,
      pageFileKey: image.paperPage.fileKey,
      createdAt: image.createdAt.toISOString(),
    })),
    createdAt: task.createdAt.toISOString(),
  }));
  return { items, total, page: query.page, pageSize: query.pageSize };
}
