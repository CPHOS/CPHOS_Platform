import type {
  ArbitrationDto,
  ArbitrationListDto,
  GradeArbitrationInput,
  GradeMarkingTaskInput,
  ListArbitrationsQuery,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

function userName(user: { displayName: string | null; loginName: string | null; email: string | null } | null | undefined): string | null {
  if (!user) return null;
  return user.displayName ?? user.loginName ?? user.email ?? null;
}

async function recomputePaper(tx: Prisma.TransactionClient, paperId: bigint): Promise<void> {
  const questions = await tx.paperQuestion.findMany({
    where: { paperId },
    select: { finalScore: true },
  });
  const allFinal = questions.length > 0 && questions.every((q) => q.finalScore !== null);
  let total = new Prisma.Decimal(0);
  for (const q of questions) {
    if (q.finalScore !== null) total = total.plus(q.finalScore);
  }
  await tx.paper.update({
    where: { id: paperId },
    data: {
      score: allFinal ? total : null,
      finalizedAt: allFinal ? new Date() : null,
    },
  });
}

export async function gradeMarkingTask(
  userId: bigint,
  taskId: bigint,
  input: GradeMarkingTaskInput,
): Promise<void> {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw Errors.forbidden();

  const task = await prisma.markingTask.findUnique({
    where: { id: taskId },
    include: {
      allocation: { select: { status: true } },
      paperQuestion: {
        include: {
          paper: { include: { exam: { include: { config: true } } } },
        },
      },
    },
  });
  if (!task || task.assigneeId !== profile.id) throw Errors.notFound('阅卷任务');
  if (task.status !== 'PENDING') throw Errors.validation('该任务已完成或已取消');
  if (task.allocation?.status !== 'ACTIVE') throw Errors.validation('分配批次已撤销，任务不可评分');
  if (task.paperQuestion.paper.finalizedAt) throw Errors.validation('整卷已定稿，不可再评分');
  if (task.paperQuestion.paper.status === 'ARCHIVED') throw Errors.validation('整卷已归档，不可再评分');
  if (task.paperQuestion.paper.exam.status !== 'PUBLISHED') {
    throw Errors.validation('考试非进行中状态，不可评分');
  }
  if (input.score > Number(task.paperQuestion.maxScore)) {
    throw Errors.validation('分数不能超过题目满分');
  }

  await prisma.$transaction(async (tx) => {
    // 整卷级串行化：阅卷完成判定与总分重算不会交错在半可见状态上
    await tx.$executeRaw`SELECT id FROM "Paper" WHERE "id" = ${task.paperQuestion.paper.id} FOR UPDATE`;
    const changed = await tx.markingTask.updateMany({
      where: { id: taskId, assigneeId: profile.id, status: 'PENDING' },
      data: {
        score: input.score,
        remark: input.remark ?? null,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw Errors.validation('任务状态已变化');

    await tx.markRecord.create({
      data: {
        taskType: 'MARKING',
        taskId,
        operatorId: userId,
        score: input.score,
        remark: input.remark ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        operatorId: userId,
        action: 'MARK_TASK_GRADE',
        examId: task.paperQuestion.paper.examId,
        remark: '阅卷任务 #' + taskId + ' 得分 ' + input.score,
      },
    });

    const requiredReviews =
      task.paperQuestion.paper.requiredReviewCount ??
      Number(task.paperQuestion.paper.exam.config?.reviewCount ?? 2);
    const tasks = await tx.markingTask.findMany({
      where: { paperQuestionId: task.paperQuestionId, allocation: { status: 'ACTIVE' } },
      orderBy: { roundNo: 'asc' },
      select: { id: true, roundNo: true, score: true, status: true },
    });
    if (tasks.length === requiredReviews && tasks.every((t) => t.status === 'COMPLETED')) {
      const scores = tasks.map((t) => (t.score === null ? new Prisma.Decimal(0) : t.score));
      const gap = new Prisma.Decimal(task.paperQuestion.paper.exam.config?.gap ?? 0);
      const minScore = Prisma.Decimal.min(...scores);
      const maxScore = Prisma.Decimal.max(...scores);
      const diff = maxScore.minus(minScore);
      if (requiredReviews > 1 && diff.greaterThan(gap)) {
        await tx.arbitration.upsert({
          where: { paperQuestionId: task.paperQuestionId },
          create: { paperQuestionId: task.paperQuestionId, status: 'PENDING' },
          update: { status: 'PENDING', score: null, claimedById: null, completedAt: null },
        });
        await tx.auditLog.create({
          data: {
            operatorId: userId,
            action: 'ARBITRATION_CREATE',
            examId: task.paperQuestion.paper.examId,
            remark: '题目 #' + task.paperQuestionId + ' 分差超过阈值，生成仲裁',
          },
        });
        await tx.paperQuestion.update({
          where: { id: task.paperQuestionId },
          data: { finalScore: null },
        });
        await recomputePaper(tx, task.paperQuestion.paper.id);
      } else {
        const total = scores.reduce((sum, score) => sum.plus(score), new Prisma.Decimal(0));
        const final = total.div(requiredReviews).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        await tx.paperQuestion.update({
          where: { id: task.paperQuestionId },
          data: { finalScore: final },
        });
        await tx.arbitration.updateMany({
          where: { paperQuestionId: task.paperQuestionId, status: { not: 'COMPLETED' } },
          data: { status: 'CANCELED' },
        });
        await recomputePaper(tx, task.paperQuestion.paper.id);
      }
    }
  });
}

export async function listArbitrations(
  _userId: bigint,
  query: ListArbitrationsQuery,
): Promise<ArbitrationListDto> {
  const where: Prisma.ArbitrationWhereInput = {
    paperQuestion: { markingTasks: { some: { allocation: { status: 'ACTIVE' } } } },
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.arbitration.count({ where }),
    prisma.arbitration.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        claimedBy: { select: { displayName: true, loginName: true, email: true } },
        paperQuestion: {
          include: {
            paper: {
              include: {
                student: { select: { name: true } },
                exam: { select: { name: true } },
              },
            },
            markingTasks: {
              where: { allocation: { status: 'ACTIVE' } },
              orderBy: { roundNo: 'asc' },
              select: { score: true },
            },
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
          },
        },
      },
    }),
  ]);

  const items: ArbitrationDto[] = rows.map((a) => ({
    id: String(a.id),
    paperQuestionId: String(a.paperQuestionId),
    paperId: String(a.paperQuestion.paper.id),
    examId: String(a.paperQuestion.paper.examId),
    examName: a.paperQuestion.paper.exam.name,
    studentName: a.paperQuestion.paper.student.name,
    slot: a.paperQuestion.slot,
    questionLabel: a.paperQuestion.questionLabel,
    maxScore: Number(a.paperQuestion.maxScore),
    status: a.status,
    claimedById: a.claimedById === null ? null : String(a.claimedById),
    claimedByName: userName(a.claimedBy),
    score: a.score === null ? null : Number(a.score),
    roundScores: a.paperQuestion.markingTasks.map((t) => (t.score === null ? null : Number(t.score))),
    images: a.paperQuestion.images.map((image) => ({
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
    remark: a.remark,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }));
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function claimArbitration(userId: bigint, id: bigint): Promise<void> {
  const existing = await prisma.arbitration.findUnique({
    where: { id },
    include: { paperQuestion: { include: { paper: { select: { exam: { select: { status: true } } } } } } },
  });
  if (!existing) throw Errors.notFound('仲裁任务');
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELED') {
    throw Errors.validation('仲裁任务已完成或已取消');
  }
  const activeReview = await prisma.markingTask.findFirst({
    where: {
      paperQuestionId: existing.paperQuestionId,
      status: 'COMPLETED',
      allocation: { status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (!activeReview) throw Errors.validation('仲裁对应的阅卷批次已撤销');
  if (existing.claimedById === userId) return;
  if (existing.claimedById) throw Errors.forbidden();
  if (existing.paperQuestion.paper.exam.status !== 'PUBLISHED') {
    throw Errors.validation('考试非进行中状态，不可认领');
  }
  const changed = await prisma.arbitration.updateMany({
    where: { id, status: 'PENDING', claimedById: null },
    data: { status: 'CLAIMED', claimedById: userId },
  });
  if (changed.count !== 1) throw Errors.validation('仲裁任务已被他人认领或已完成');
  await prisma.auditLog.create({
    data: { operatorId: userId, action: 'ARBITRATION_CLAIM', remark: '认领仲裁任务 #' + id },
  });
}

export async function gradeArbitration(
  userId: bigint,
  id: bigint,
  input: GradeArbitrationInput,
): Promise<void> {
  const arbitration = await prisma.arbitration.findUnique({
    where: { id },
    include: { paperQuestion: { include: { paper: { select: { id: true, exam: { select: { status: true } }, finalizedAt: true } } } } },
  });
  if (!arbitration) throw Errors.notFound('仲裁任务');
  if (arbitration.status === 'COMPLETED' || arbitration.status === 'CANCELED') {
    throw Errors.validation('仲裁任务已完成或已取消');
  }
  if (arbitration.paperQuestion.paper.finalizedAt) {
    throw Errors.validation('整卷已定稿，不可再仲裁');
  }
  if (arbitration.paperQuestion.paper.exam.status !== 'PUBLISHED') {
    throw Errors.validation('考试非进行中状态，不可仲裁');
  }
  const activeReview = await prisma.markingTask.findFirst({
    where: {
      paperQuestionId: arbitration.paperQuestionId,
      status: 'COMPLETED',
      allocation: { status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (!activeReview) throw Errors.validation('仲裁对应的阅卷批次已撤销');
  if (arbitration.claimedById && arbitration.claimedById !== userId) {
    throw Errors.forbidden();
  }
  if (input.score > Number(arbitration.paperQuestion.maxScore)) {
    throw Errors.validation('分数不能超过题目满分');
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Paper" WHERE "id" = ${arbitration.paperQuestion.paper.id} FOR UPDATE`;
    const changed = await tx.arbitration.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'CLAIMED'] },
        OR: [{ claimedById: null }, { claimedById: userId }],
      },
      data: {
        status: 'COMPLETED',
        claimedById: userId,
        score: input.score,
        remark: input.remark ?? null,
        completedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw Errors.validation('仲裁任务状态已变化');

    await tx.markRecord.create({
      data: {
        taskType: 'ARBITRATION',
        taskId: id,
        operatorId: userId,
        score: input.score,
        remark: input.remark ?? null,
      },
    });
    await tx.paperQuestion.update({
      where: { id: arbitration.paperQuestionId },
      data: { finalScore: input.score },
    });
    await recomputePaper(tx, arbitration.paperQuestion.paperId);
    await tx.auditLog.create({
      data: { operatorId: userId, action: 'ARBITRATION_GRADE', remark: '仲裁打分任务 #' + id },
    });
  });
}
