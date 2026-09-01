import type {
  CreateStudentInput,
  ListStudentsQuery,
  StudentDto,
  StudentListDto,
  UpdateStudentInput,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

const STUDENT_INCLUDE = {
  owner: {
    select: {
      realName: true,
      school: { select: { name: true } },
      user: { select: { email: true, loginName: true, displayName: true } },
    },
  },
  school: { select: { name: true } },
  grade: { select: { name: true } },
  prize: { select: { name: true } },
} as const;

type StudentWithRelations = Prisma.StudentGetPayload<{ include: typeof STUDENT_INCLUDE }>;

function ownerName(owner: StudentWithRelations['owner']): string | null {
  return (
    owner.realName ??
    owner.user.displayName ??
    owner.user.loginName ??
    owner.user.email ??
    null
  );
}

function toStudentDto(student: StudentWithRelations): StudentDto {
  return {
    id: String(student.id),
    ownerId: String(student.ownerId),
    ownerName: ownerName(student.owner),
    ownerSchoolName: student.owner.school?.name ?? null,
    name: student.name,
    schoolId: student.schoolId === null ? null : String(student.schoolId),
    schoolName: student.school?.name ?? null,
    gradeId: student.gradeId === null ? null : String(student.gradeId),
    gradeName: student.grade?.name ?? null,
    prizeId: student.prizeId === null ? null : String(student.prizeId),
    prizeName: student.prize?.name ?? null,
    archivedAt: student.archivedAt?.toISOString() ?? null,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  };
}

async function getProfile(userId: bigint): Promise<{ id: bigint; schoolId: bigint | null }> {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true, schoolId: true },
  });
  if (!profile) throw Errors.forbidden();
  return profile;
}

async function assertDictReferences(input: {
  schoolId?: bigint | null;
  gradeId?: bigint | null;
  prizeId?: bigint | null;
}): Promise<void> {
  if (input.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
    if (!school) throw Errors.notFound('学校');
  }
  if (input.gradeId) {
    const grade = await prisma.grade.findUnique({ where: { id: input.gradeId } });
    if (!grade) throw Errors.notFound('年级');
  }
  if (input.prizeId) {
    const prize = await prisma.prize.findUnique({ where: { id: input.prizeId } });
    if (!prize) throw Errors.notFound('奖项');
  }
}

function buildWhere(query: ListStudentsQuery, ownerId?: bigint): Prisma.StudentWhereInput {
  return {
    archivedAt: null,
    ...(ownerId ? { ownerId } : {}),
    ...(query.schoolId ? { schoolId: BigInt(query.schoolId) } : {}),
    ...(query.gradeId ? { gradeId: BigInt(query.gradeId) } : {}),
    ...(query.prizeId ? { prizeId: BigInt(query.prizeId) } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { school: { name: { contains: query.q } } },
            { owner: { realName: { contains: query.q } } },
            { owner: { user: { email: { contains: query.q } } } },
            { owner: { user: { loginName: { contains: query.q } } } },
          ],
        }
      : {}),
  };
}

async function listStudentRows(
  query: ListStudentsQuery,
  ownerId?: bigint,
): Promise<StudentListDto> {
  const where = buildWhere(query, ownerId);
  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: STUDENT_INCLUDE,
    }),
  ]);
  return { items: rows.map(toStudentDto), total, page: query.page, pageSize: query.pageSize };
}

export async function listMyStudents(
  userId: bigint,
  query: ListStudentsQuery,
): Promise<StudentListDto> {
  const profile = await getProfile(userId);
  return listStudentRows(query, profile.id);
}

export async function listAllStudents(query: ListStudentsQuery): Promise<StudentListDto> {
  return listStudentRows(query);
}

export async function createMyStudent(
  userId: bigint,
  input: CreateStudentInput,
): Promise<StudentDto> {
  const profile = await getProfile(userId);
  // 用户未指定学校时，默认继承其成员资料上的学校
  const schoolId = input.schoolId ? BigInt(input.schoolId) : profile.schoolId;
  const gradeId = input.gradeId ? BigInt(input.gradeId) : null;
  const prizeId = input.prizeId ? BigInt(input.prizeId) : null;
  await assertDictReferences({ schoolId, gradeId, prizeId });
  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: { ownerId: profile.id, name: input.name, schoolId, gradeId, prizeId },
      include: STUDENT_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        operatorId: userId,
        action: 'STUDENT_CREATE',
        studentId: created.id,
        remark: '新增学生「' + created.name + '」',
      },
    });
    return created;
  });
  return toStudentDto(student);
}

export async function updateMyStudent(
  userId: bigint,
  id: bigint,
  input: UpdateStudentInput,
): Promise<StudentDto> {
  const profile = await getProfile(userId);
  const existing = await prisma.student.findFirst({ where: { id, ownerId: profile.id } });
  if (!existing) throw Errors.notFound('学生');

  const schoolId = input.schoolId === undefined ? undefined : input.schoolId ? BigInt(input.schoolId) : null;
  const gradeId = input.gradeId === undefined ? undefined : input.gradeId ? BigInt(input.gradeId) : null;
  const prizeId = input.prizeId === undefined ? undefined : input.prizeId ? BigInt(input.prizeId) : null;
  await assertDictReferences({ schoolId, gradeId, prizeId });

  const student = await prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(schoolId !== undefined ? { schoolId } : {}),
        ...(gradeId !== undefined ? { gradeId } : {}),
        ...(prizeId !== undefined ? { prizeId } : {}),
      },
      include: STUDENT_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        operatorId: userId,
        action: 'STUDENT_UPDATE',
        studentId: id,
        remark: '更新学生「' + updated.name + '」',
      },
    });
    return updated;
  });
  return toStudentDto(student);
}

export async function archiveMyStudent(userId: bigint, id: bigint): Promise<void> {
  const profile = await getProfile(userId);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.student.findFirst({
      where: { id, ownerId: profile.id, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) throw Errors.notFound('学生');
    await tx.student.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        operatorId: userId,
        action: 'STUDENT_DELETE',
        studentId: id,
        remark: '归档学生「' + existing.name + '」',
      },
    });
  });
}

export type { StudentWithRelations };
