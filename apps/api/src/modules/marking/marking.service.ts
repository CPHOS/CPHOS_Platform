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
  const total = questions.reduce((sum, q) => sum + (q.finalScore ? Number(q.finalScore) : 0), 0);
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
      paperQuestion: {
        include: {
          paper: { include: { exam: { include: { config: true } } } },
        },
      },
    },
  });
  if (!task || task.assigneeId !== profile.id) throw Errors.notFound('阅卷任务');
  if (task.status !== 'PENDING') throw Errors.validation('该任务已完成或已取消');
  if (input.score > Number(task.paperQuestion.maxScore)) {
    throw Errors.validation('分数不能超过题目满分');
  }

  await prisma.$transaction(async (tx) => {
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

    const tasks = await tx.markingTask.findMany({
      where: { paperQuestionId: task.paperQuestionId },
      select: { id: true, roundNo: true, score: true, status: true },
    });
    if (tasks.length === 2 && tasks.every((t) => t.status === 'COMPLETED')) {
      const first = tasks.find((t) => t.roundNo === 1);
      const second = tasks.find((t) => t.roundNo === 2);
      const s1 = first?.score ? Number(first.score) : 0;
      const s2 = second?.score ? Number(second.score) : 0;
      const gap = Number(task.paperQuestion.paper.exam.config?.gap ?? 0);
      const diff = Math.abs(s1 - s2);
      if (diff > gap) {
        await tx.arbitration.upsert({
          where: { paperQuestionId: task.paperQuestionId },
          create: { paperQuestionId: task.paperQuestionId, status: 'PENDING' },
          update: { status: 'PENDING', score: null, claimedById: null, completedAt: null },
        });
        await tx.paperQuestion.update({
          where: { id: task.paperQuestionId },
          data: { finalScore: null },
        });
        await recomputePaper(tx, task.paperQuestion.paper.id);
      } else {
        const final = (s1 + s2) / 2;
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
            markingTasks: { orderBy: { roundNo: 'asc' }, select: { score: true } },
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
    remark: a.remark,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }));
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function claimArbitration(userId: bigint, id: bigint): Promise<void> {
  const changed = await prisma.arbitration.updateMany({
    where: {
      id,
      OR: [{ status: 'PENDING' }, { status: 'CLAIMED', claimedById: userId }],
    },
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
    include: { paperQuestion: true },
  });
  if (!arbitration) throw Errors.notFound('仲裁任务');
  if (arbitration.status === 'COMPLETED' || arbitration.status === 'CANCELED') {
    throw Errors.validation('仲裁任务已完成或已取消');
  }
  if (arbitration.claimedById && arbitration.claimedById !== userId) {
    throw Errors.forbidden();
  }
  if (input.score > Number(arbitration.paperQuestion.maxScore)) {
    throw Errors.validation('分数不能超过题目满分');
  }

  await prisma.$transaction(async (tx) => {
    const changed = await tx.arbitration.updateMany({
      where: { id, status: { in: ['PENDING', 'CLAIMED'] } },
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
