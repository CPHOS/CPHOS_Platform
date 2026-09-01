import type {
  AddPaperPageInput,
  BindQuestionImageInput,
  CreatePaperInput,
  ListPapersQuery,
  MyRankingEntryDto,
  MyRankingListDto,
  PaperDto,
  PaperListDto,
  PaperPageDto,
  PaperQuestionDto,
  QuestionImageDto,
  RemoveQuestionImageInput,
  SetPaperStatusInput,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';

const PAPER_INCLUDE = {
  exam: { select: { name: true } },
  student: { select: { name: true } },
  uploadedBy: {
    select: {
      realName: true,
      school: { select: { name: true } },
      user: { select: { displayName: true, loginName: true, email: true } },
    },
  },
  pages: { orderBy: { pageNo: 'asc' as const } },
  questions: {
    orderBy: { slot: 'asc' as const },
    include: {
      images: { orderBy: { partIndex: 'asc' as const } },
      markingTasks: { orderBy: { roundNo: 'asc' as const }, select: { roundNo: true, status: true, score: true } },
      arbitration: { select: { status: true, score: true } },
    },
  },
} as const;

type PaperWithRelations = Prisma.PaperGetPayload<{ include: typeof PAPER_INCLUDE }>;

function num(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value) : 0;
}

function uploadedName(paper: PaperWithRelations): string | null {
  const u = paper.uploadedBy;
  return u.realName ?? u.user.displayName ?? u.user.loginName ?? u.user.email ?? null;
}

function toImageDto(
  image: PaperWithRelations['questions'][number]['images'][number],
  pages: Map<string, PaperWithRelations['pages'][number]>,
): QuestionImageDto {
  const page = pages.get(String(image.paperPageId));
  return {
    id: String(image.id),
    paperQuestionId: String(image.paperQuestionId),
    paperPageId: String(image.paperPageId),
    partIndex: image.partIndex,
    crop: (image.crop as QuestionImageDto['crop']) ?? null,
    fileKey: image.fileKey,
    pageNo: page?.pageNo ?? 0,
    pageFileKey: page?.fileKey ?? '',
    createdAt: image.createdAt.toISOString(),
  };
}

function toQuestionDto(
  question: PaperWithRelations['questions'][number],
  pages: Map<string, PaperWithRelations['pages'][number]>,
  revealProcess: boolean,
): PaperQuestionDto {
  return {
    id: String(question.id),
    slot: question.slot,
    questionLabel: question.questionLabel,
    maxScore: num(question.maxScore),
    finalScore: question.finalScore === null ? null : num(question.finalScore),
    roundScores: revealProcess
      ? question.markingTasks.map((t) => (t.score === null ? null : Number(t.score))).filter((v): v is number => v !== null)
      : [],
    arbitrationStatus: revealProcess ? question.arbitration?.status ?? null : null,
    arbitrationScore:
      revealProcess && question.arbitration?.score !== null && question.arbitration?.score !== undefined
        ? Number(question.arbitration.score)
        : null,
    images: question.images.map((image) => toImageDto(image, pages)),
    updatedAt: question.updatedAt.toISOString(),
  };
}

function toPageDto(page: PaperWithRelations['pages'][number]): PaperPageDto {
  return {
    id: String(page.id),
    pageNo: page.pageNo,
    fileKey: page.fileKey,
    mimeType: page.mimeType,
    sizeBytes: page.sizeBytes,
    createdAt: page.createdAt.toISOString(),
  };
}

function toPaperDto(paper: PaperWithRelations, includeInternal = false): PaperDto {
  const pages = new Map(paper.pages.map((p) => [String(p.id), p]));
  const revealProcess = includeInternal || paper.finalizedAt !== null;
  return {
    id: String(paper.id),
    examId: String(paper.examId),
    examName: paper.exam.name,
    studentId: String(paper.studentId),
    studentName: paper.student.name,
    uploadedById: String(paper.uploadedById),
    uploadedByName: uploadedName(paper),
    status: paper.status,
    score: paper.score === null ? null : Number(paper.score),
    finalizedAt: paper.finalizedAt?.toISOString() ?? null,
    pages: paper.pages.map(toPageDto),
    questions: paper.questions.map((q) => toQuestionDto(q, pages, revealProcess)),
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
  };
}

async function getProfileId(userId: bigint): Promise<bigint> {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw Errors.forbidden();
  return profile.id;
}

async function findPaperOrThrow(id: bigint): Promise<PaperWithRelations> {
  const paper = await prisma.paper.findUnique({ where: { id }, include: PAPER_INCLUDE });
  if (!paper) throw Errors.notFound('整卷');
  return paper;
}

async function findOwnPaperOrThrow(id: bigint, profileId: bigint): Promise<PaperWithRelations> {
  const paper = await prisma.paper.findUnique({ where: { id }, include: PAPER_INCLUDE });
  if (!paper || paper.uploadedById !== profileId) throw Errors.notFound('整卷');
  return paper;
}

function writeAudit(
  tx: Prisma.TransactionClient,
  operatorId: bigint,
  action: 'PAPER_CREATE' | 'PAPER_PAGE_ADD' | 'PAPER_QUESTION_BIND' | 'PAPER_READY' | 'PAPER_ARCHIVE',
  paper: { examId: bigint; studentId: bigint },
  remark: string,
) {
  return tx.auditLog.create({
    data: {
      operatorId,
      action,
      examId: paper.examId,
      studentId: paper.studentId,
      remark,
    },
  });
}

export async function listMyPapers(
  userId: bigint,
  query: ListPapersQuery,
): Promise<PaperListDto> {
  const profileId = await getProfileId(userId);
  const where: Prisma.PaperWhereInput = {
    uploadedById: profileId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.examId ? { examId: BigInt(query.examId) } : {}),
    ...(query.q
      ? {
          OR: [
            { exam: { name: { contains: query.q } } },
            { student: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: PAPER_INCLUDE,
    }),
  ]);
  return { items: rows.map((paper) => toPaperDto(paper)), total, page: query.page, pageSize: query.pageSize };
}

export async function listAllPapers(query: ListPapersQuery): Promise<PaperListDto> {
  const where: Prisma.PaperWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.examId ? { examId: BigInt(query.examId) } : {}),
    ...(query.q
      ? {
          OR: [
            { exam: { name: { contains: query.q } } },
            { student: { name: { contains: query.q } } },
            { uploadedBy: { realName: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: PAPER_INCLUDE,
    }),
  ]);
  return { items: rows.map((paper) => toPaperDto(paper, true)), total, page: query.page, pageSize: query.pageSize };
}

export async function getMyPaper(userId: bigint, id: bigint): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  return toPaperDto(await findOwnPaperOrThrow(id, profileId));
}

export async function getPaperForAdmin(id: bigint): Promise<PaperDto> {
  return toPaperDto(await findPaperOrThrow(id), true);
}

export async function createPaper(
  userId: bigint,
  input: CreatePaperInput,
): Promise<PaperDto> {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      uploadLimit: true,
      teamId: true,
      team: { select: { uploadLimit: true } },
    },
  });
  if (!profile) throw Errors.forbidden();
  const profileId = profile.id;
  const examId = BigInt(input.examId);
  const studentId = BigInt(input.studentId);

  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { config: true } });
  if (!exam) throw Errors.notFound('考试');
  if (exam.status !== 'PUBLISHED') throw Errors.validation('仅已发布考试可创建整卷');
  if (!exam.config) throw Errors.validation('考试未配置槽位，无法创建整卷');

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.ownerId !== profileId) throw Errors.notFound('学生');

  const mapping = Array.isArray(exam.config.titleMapping)
    ? (exam.config.titleMapping as unknown as { slot: number; questionLabel?: string; title?: string; point?: number }[])
    : [];
  const mappingBySlot = new Map(mapping.map((m) => [m.slot, m]));

  try {
    const paper = await prisma.$transaction(async (tx) => {
      // 同考试上传串行化，防止并发绕过个人/团队共享限额
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${examId})`;
      const quotaWhere = profile.teamId
        ? { examId, uploadedBy: { teamId: profile.teamId } }
        : { examId, uploadedById: profile.id };
      const used = await tx.paper.count({ where: quotaWhere });
      const limit = profile.team?.uploadLimit ?? profile.uploadLimit;
      if (limit > 0 && used >= limit) {
        throw Errors.validation('本场考试上传额度已用完');
      }
      const created = await tx.paper.create({
        data: {
          examId,
          studentId,
          uploadedById: profileId,
          questions: {
            create: Array.from({ length: exam.config!.slotCount }, (_, index) => {
              const slot = index + 1;
              const item = mappingBySlot.get(slot);
              return {
                slot,
                questionLabel: item?.questionLabel ?? item?.title ?? null,
                maxScore: item?.point ?? exam.config!.defaultPoint,
              };
            }),
          },
        },
        include: PAPER_INCLUDE,
      });
      await writeAudit(tx, userId, 'PAPER_CREATE', created, '创建整卷：学生 ' + student.name);
      return created;
    });
    return toPaperDto(paper);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该学生在这场考试中已有整卷');
    }
    throw err;
  }
}

function assertPaperEditable(paper: PaperWithRelations): void {
  if (paper.status === 'ARCHIVED') throw Errors.validation('已归档整卷不可修改');
  if (paper.finalizedAt) throw Errors.validation('成绩已定稿，整卷不可修改');
  if (paper.questions.some((q) => q.markingTasks.length > 0)) {
    throw Errors.validation('已进入分配/阅卷的整卷不可修改');
  }
}

export async function addPaperPage(
  userId: bigint,
  paperId: bigint,
  input: AddPaperPageInput,
): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  const paper = await findOwnPaperOrThrow(paperId, profileId);
  assertPaperEditable(paper);
  if (input.pageNo > env.PAPER_MAX_PAGES) throw Errors.validation('超过单卷页数上限');

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.paperPage.create({
        data: {
          paperId,
          pageNo: input.pageNo,
          fileKey: input.fileKey,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null,
        },
      });
      await writeAudit(tx, userId, 'PAPER_PAGE_ADD', paper, '添加答题卡页 ' + input.pageNo);
      return tx.paper.findUniqueOrThrow({ where: { id: paperId }, include: PAPER_INCLUDE });
    });
    return toPaperDto(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该页码已存在');
    }
    throw err;
  }
}

export async function bindQuestionImage(
  userId: bigint,
  paperId: bigint,
  input: BindQuestionImageInput,
): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  const paper = await findOwnPaperOrThrow(paperId, profileId);
  assertPaperEditable(paper);

  const questionId = BigInt(input.paperQuestionId);
  const pageId = BigInt(input.paperPageId);
  const question = paper.questions.find((q) => q.id === questionId);
  if (!question) throw Errors.notFound('题目');
  if (!paper.pages.some((p) => p.id === pageId)) throw Errors.notFound('答题卡页');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.questionImage.upsert({
      where: {
        paperQuestionId_paperPageId_partIndex: {
          paperQuestionId: questionId,
          paperPageId: pageId,
          partIndex: input.partIndex,
        },
      },
      create: {
        paperQuestionId: questionId,
        paperPageId: pageId,
        partIndex: input.partIndex,
        crop: input.crop ?? Prisma.JsonNull,
        fileKey: input.fileKey ?? null,
      },
      update: {
        crop: input.crop ?? Prisma.JsonNull,
        fileKey: input.fileKey ?? null,
      },
    });
    await writeAudit(tx, userId, 'PAPER_QUESTION_BIND', paper, '绑定题目槽位 ' + question.slot);
    return tx.paper.findUniqueOrThrow({ where: { id: paperId }, include: PAPER_INCLUDE });
  });
  return toPaperDto(updated);
}

export async function removeQuestionImage(
  userId: bigint,
  paperId: bigint,
  input: RemoveQuestionImageInput,
): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  const paper = await findOwnPaperOrThrow(paperId, profileId);
  assertPaperEditable(paper);

  const questionId = BigInt(input.paperQuestionId);
  const pageId = BigInt(input.paperPageId);
  if (!paper.questions.some((q) => q.id === questionId)) throw Errors.notFound('题目');
  if (!paper.pages.some((p) => p.id === pageId)) throw Errors.notFound('答题卡页');
  await prisma.$transaction(async (tx) => {
    const removed = await tx.questionImage.deleteMany({
      where: {
        paperQuestionId: questionId,
        paperPageId: pageId,
        partIndex: input.partIndex,
      },
    });
    if (removed.count === 0) throw Errors.notFound('图片绑定');
    await writeAudit(tx, userId, 'PAPER_QUESTION_BIND', paper, '移除题目槽位 ' + questionId + ' 的图片绑定');
  });
  const updated = await findOwnPaperOrThrow(paperId, profileId);
  return toPaperDto(updated);
}

export async function setPaperStatus(
  userId: bigint,
  paperId: bigint,
  input: SetPaperStatusInput,
): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  const paper = await findOwnPaperOrThrow(paperId, profileId);
  if (paper.status === 'ARCHIVED' && input.status !== 'ARCHIVED') {
    throw Errors.validation('已归档整卷不可恢复');
  }
  if (paper.finalizedAt && input.status !== 'ARCHIVED') {
    throw Errors.validation('成绩已定稿，仅可随考试归档');
  }

  if (input.status === 'READY') {
    const missing = paper.questions.filter((q) => q.images.length === 0);
    if (missing.length > 0) {
      throw Errors.validation('仍有题目未绑定图片，不能标记就绪');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.paper.updateMany({
      where: { id: paperId, uploadedById: profileId },
      data: { status: input.status },
    });
    if (changed.count !== 1) throw Errors.notFound('整卷');
    await writeAudit(
      tx,
      userId,
      input.status === 'READY' ? 'PAPER_READY' : 'PAPER_ARCHIVE',
      paper,
      input.status === 'READY' ? '整卷标记就绪' : '归档整卷',
    );
    return tx.paper.findUniqueOrThrow({ where: { id: paperId }, include: PAPER_INCLUDE });
  });
  return toPaperDto(updated);
}

export async function listMyFinalizedPapers(
  userId: bigint,
  query: ListPapersQuery,
): Promise<PaperListDto> {
  const profileId = await getProfileId(userId);
  const where: Prisma.PaperWhereInput = {
    uploadedById: profileId,
    finalizedAt: { not: null },
    ...(query.status ? { status: query.status } : {}),
    ...(query.examId ? { examId: BigInt(query.examId) } : {}),
    ...(query.q
      ? {
          OR: [
            { exam: { name: { contains: query.q } } },
            { student: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where,
      orderBy: { finalizedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: PAPER_INCLUDE,
    }),
  ]);
  return { items: rows.map((paper) => toPaperDto(paper)), total, page: query.page, pageSize: query.pageSize };
}

export async function getMyRanking(
  userId: bigint,
  examId?: bigint,
): Promise<MyRankingListDto> {
  const profileId = await getProfileId(userId);
  const ownPapers = await prisma.paper.findMany({
    where: {
      uploadedById: profileId,
      finalizedAt: { not: null },
      ...(examId ? { examId } : {}),
    },
    select: { examId: true },
  });
  const examIds = [...new Set(ownPapers.map((p) => p.examId))];
  const items: MyRankingEntryDto[] = [];

  for (const id of examIds) {
    const papers = await prisma.paper.findMany({
      where: { examId: id, finalizedAt: { not: null }, score: { not: null } },
      orderBy: [{ score: 'desc' }, { finalizedAt: 'asc' }, { id: 'asc' }],
      include: {
        exam: { select: { name: true } },
        student: { select: { name: true } },
      },
    });
    const total = papers.length;
    papers.forEach((paper, index) => {
      if (paper.uploadedById === profileId) {
        items.push({
          rank: index + 1,
          total,
          paperId: String(paper.id),
          examId: String(paper.examId),
          examName: paper.exam.name,
          studentName: paper.student.name,
          score: paper.score === null ? 0 : Number(paper.score),
          finalizedAt: paper.finalizedAt?.toISOString() ?? null,
        });
      }
    });
  }
  return { items };
}

export interface UploadPaperPageInput {
  pageNo: number;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function safeUploadExt(mimeType: string): string {
  const ext = ALLOWED_UPLOAD_MIME[mimeType.toLowerCase()];
  if (!ext) throw Errors.validation('仅支持 JPG/PNG/WebP 答题卡图片');
  return ext;
}

function assertInsideUploadDir(absolutePath: string): void {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const relative = path.relative(uploadRoot, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw Errors.validation('文件路径非法');
  }
}

export async function uploadPaperPage(
  userId: bigint,
  paperId: bigint,
  input: UploadPaperPageInput,
): Promise<PaperDto> {
  const profileId = await getProfileId(userId);
  const paper = await findOwnPaperOrThrow(paperId, profileId);
  assertPaperEditable(paper);
  if (paper.pages.length >= env.PAPER_MAX_PAGES) throw Errors.validation('超过单卷页数上限');
  if (!ALLOWED_UPLOAD_MIME[input.mimeType.toLowerCase()]) {
    throw Errors.validation('仅支持 JPG/PNG/WebP 答题卡图片');
  }

  const fileKey =
    'papers/' + String(paperId) + '/' + randomUUID() + safeUploadExt(input.mimeType);
  const absolute = path.resolve(process.cwd(), env.UPLOAD_DIR, fileKey);
  assertInsideUploadDir(absolute);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.paperPage.create({
        data: {
          paperId,
          pageNo: input.pageNo,
          fileKey,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
      await writeAudit(tx, userId, 'PAPER_PAGE_ADD', paper, '上传答题卡页 ' + input.pageNo);
      return tx.paper.findUniqueOrThrow({ where: { id: paperId }, include: PAPER_INCLUDE });
    });
    return toPaperDto(updated);
  } catch (err) {
    await fs.unlink(absolute).catch(() => undefined);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该页码已存在');
    }
    throw err;
  }
}

export async function getPaperPageStream(
  userId: bigint,
  paperId: bigint,
  pageId: bigint,
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  const profileId = await getProfileId(userId);
  const page = await prisma.paperPage.findFirst({
    where: {
      id: pageId,
      paperId,
      paper: { uploadedById: profileId },
    },
    select: { fileKey: true, mimeType: true },
  });
  if (!page) throw Errors.notFound('答题卡页');
  const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, page.fileKey);
  assertInsideUploadDir(absolutePath);
  if (!existsSync(absolutePath)) throw Errors.notFound('文件');
  const mime = Object.keys(ALLOWED_UPLOAD_MIME).includes((page.mimeType ?? '').toLowerCase())
    ? page.mimeType!
    : 'application/octet-stream';
  return { stream: createReadStream(absolutePath), mimeType: mime };
}
