import type {
  AreaDto,
  DictBundleDto,
  DictNameInput,
  NameDictDto,
  SchoolDto,
  SchoolInput,
  UpdateSchoolInput,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

function toSchoolDto(s: {
  id: bigint;
  name: string;
  areaId: bigint;
  area?: { name: string } | null;
}): SchoolDto {
  return {
    id: String(s.id),
    name: s.name,
    areaId: String(s.areaId),
    areaName: s.area?.name ?? null,
  };
}

function toNameDto(s: { id: bigint; name: string }): NameDictDto {
  return { id: String(s.id), name: s.name };
}

async function rethrowUnique(err: unknown, message: string): Promise<never> {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw Errors.validation(message);
  }
  throw err;
}

export async function listSchools(): Promise<SchoolDto[]> {
  const rows = await prisma.school.findMany({ orderBy: { id: 'asc' }, include: { area: true } });
  return rows.map(toSchoolDto);
}

export async function getDictBundle(): Promise<DictBundleDto> {
  const [areas, schools, grades, prizes, topics, counts] = await Promise.all([
    prisma.area.findMany({ orderBy: { id: 'asc' } }),
    prisma.school.findMany({ orderBy: { id: 'asc' }, include: { area: true } }),
    prisma.grade.findMany({ orderBy: { id: 'asc' } }),
    prisma.prize.findMany({ orderBy: { id: 'asc' } }),
    prisma.topic.findMany({ orderBy: { id: 'asc' } }),
    prisma.school.groupBy({ by: ['areaId'], _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [String(c.areaId), c._count._all]));
  const areaDtos: AreaDto[] = areas.map((a) => ({
    id: String(a.id),
    name: a.name,
    schoolCount: countMap.get(String(a.id)) ?? 0,
  }));
  return {
    areas: areaDtos,
    schools: schools.map(toSchoolDto),
    grades: grades.map(toNameDto),
    prizes: prizes.map(toNameDto),
    topics: topics.map(toNameDto),
  };
}

// ---------- 赛区 ----------

export async function createArea(input: DictNameInput): Promise<AreaDto> {
  try {
    const area = await prisma.area.create({ data: { name: input.name } });
    return { id: String(area.id), name: area.name, schoolCount: 0 };
  } catch (err) {
    return rethrowUnique(err, '赛区名称已存在');
  }
}

export async function updateArea(id: bigint, input: DictNameInput): Promise<AreaDto> {
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound('赛区');
  try {
    const area = await prisma.area.update({ where: { id }, data: { name: input.name } });
    const schoolCount = await prisma.school.count({ where: { areaId: id } });
    return { id: String(area.id), name: area.name, schoolCount };
  } catch (err) {
    return rethrowUnique(err, '赛区名称已存在');
  }
}

export async function deleteArea(id: bigint): Promise<void> {
  const existing = await prisma.area.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound('赛区');
  const count = await prisma.school.count({ where: { areaId: id } });
  if (count > 0) throw Errors.dictInUse();
  await prisma.area.delete({ where: { id } });
}

// ---------- 学校 ----------

export async function createSchool(input: SchoolInput): Promise<SchoolDto> {
  const areaId = BigInt(input.areaId);
  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) throw Errors.notFound('赛区');
  try {
    const school = await prisma.school.create({ data: { name: input.name, areaId }, include: { area: true } });
    return toSchoolDto(school);
  } catch (err) {
    return rethrowUnique(err, '该赛区下已存在同名学校');
  }
}

export async function updateSchool(id: bigint, input: UpdateSchoolInput): Promise<SchoolDto> {
  const existing = await prisma.school.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound('学校');
  if (existing.isIndividual && (input.name !== undefined || input.areaId !== undefined)) {
    throw Errors.validation('个人/特殊保护学校不允许改名或移区');
  }
  if (input.areaId !== undefined) {
    const area = await prisma.area.findUnique({ where: { id: BigInt(input.areaId) } });
    if (!area) throw Errors.notFound('赛区');
  }
  try {
    const school = await prisma.school.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.areaId !== undefined ? { areaId: BigInt(input.areaId) } : {}),
      },
      include: { area: true },
    });
    return toSchoolDto(school);
  } catch (err) {
    return rethrowUnique(err, '该赛区下已存在同名学校');
  }
}

export async function deleteSchool(id: bigint): Promise<void> {
  const existing = await prisma.school.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound('学校');
  if (existing.isIndividual) throw Errors.validation('个人/特殊保护学校不允许删除');
  const [members, applications, refs] = await Promise.all([
    prisma.memberProfile.count({ where: { schoolId: id } }),
    prisma.auditApplication.count({ where: { schoolId: id } }),
    prisma.legacyMemberRef.count({ where: { schoolId: id } }),
  ]);
  if (members + applications + refs > 0) throw Errors.dictInUse();
  await prisma.school.delete({ where: { id } });
}

// ---------- 名称字典 ----------

export async function createGrade(input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.grade.create({ data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '年级名称已存在'); }
}
export async function updateGrade(id: bigint, input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.grade.update({ where: { id }, data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '年级名称已存在'); }
}
export async function deleteGrade(id: bigint): Promise<void> {
  await prisma.grade.delete({ where: { id } }).catch(() => { throw Errors.notFound('年级'); });
}

export async function createPrize(input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.prize.create({ data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '奖项名称已存在'); }
}
export async function updatePrize(id: bigint, input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.prize.update({ where: { id }, data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '奖项名称已存在'); }
}
export async function deletePrize(id: bigint): Promise<void> {
  await prisma.prize.delete({ where: { id } }).catch(() => { throw Errors.notFound('奖项'); });
}

export async function createTopic(input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.topic.create({ data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '题号名称已存在'); }
}
export async function updateTopic(id: bigint, input: DictNameInput): Promise<NameDictDto> {
  try { return toNameDto(await prisma.topic.update({ where: { id }, data: { name: input.name } })); }
  catch (err) { return rethrowUnique(err, '题号名称已存在'); }
}
export async function deleteTopic(id: bigint): Promise<void> {
  const existing = await prisma.topic.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound('题号');
  const refs = await prisma.legacyMemberRef.count({
    where: { defaultTopicId: Number(id) },
  });
  if (refs > 0) throw Errors.dictInUse();
  try {
    await prisma.topic.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw Errors.notFound('题号');
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw Errors.dictInUse();
    }
    throw err;
  }
}
