import type {
  AreaDto,
  DictBundleDto,
  DictNameInput,
  NameDictDto,
  SchoolDto,
  SchoolInput,
  UpdateSchoolInput,
} from '@cphos/shared';
import { AuditAction, Prisma } from '@prisma/client';
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

function writeDictAudit(
  tx: Prisma.TransactionClient,
  operatorId: bigint,
  action: AuditAction,
  remark: string,
) {
  return tx.auditLog.create({ data: { operatorId, action, remark } });
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
  const [areas, schools, grades, prizes, counts] = await Promise.all([
    prisma.area.findMany({ orderBy: { id: 'asc' } }),
    prisma.school.findMany({ orderBy: { id: 'asc' }, include: { area: true } }),
    prisma.grade.findMany({ orderBy: { id: 'asc' } }),
    prisma.prize.findMany({ orderBy: { id: 'asc' } }),
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
  };
}

// ---------- 赛区 ----------

export async function createArea(operatorId: bigint, input: DictNameInput): Promise<AreaDto> {
  try {
    const area = await prisma.$transaction(async (tx) => {
      const created = await tx.area.create({ data: { name: input.name } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_CREATE, '新增赛区「' + created.name + '」');
      return created;
    });
    return { id: String(area.id), name: area.name, schoolCount: 0 };
  } catch (err) {
    return rethrowUnique(err, '赛区名称已存在');
  }
}

export async function updateArea(operatorId: bigint, id: bigint, input: DictNameInput): Promise<AreaDto> {
  try {
    const { area, schoolCount } = await prisma.$transaction(async (tx) => {
      const existing = await tx.area.findUnique({ where: { id } });
      if (!existing) throw Errors.notFound('赛区');
      const updated = await tx.area.update({ where: { id }, data: { name: input.name } });
      const count = await tx.school.count({ where: { areaId: id } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_UPDATE, '修改赛区「' + existing.name + '」为「' + updated.name + '」');
      return { area: updated, schoolCount: count };
    });
    return { id: String(area.id), name: area.name, schoolCount };
  } catch (err) {
    return rethrowUnique(err, '赛区名称已存在');
  }
}

export async function deleteArea(operatorId: bigint, id: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.area.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('赛区');
    const count = await tx.school.count({ where: { areaId: id } });
    if (count > 0) throw Errors.dictInUse();
    await tx.area.delete({ where: { id } });
    await writeDictAudit(tx, operatorId, AuditAction.DICT_DELETE, '删除赛区「' + existing.name + '」#' + existing.id);
  });
}

// ---------- 学校 ----------

export async function createSchool(operatorId: bigint, input: SchoolInput): Promise<SchoolDto> {
  const areaId = BigInt(input.areaId);
  try {
    const school = await prisma.$transaction(async (tx) => {
      const area = await tx.area.findUnique({ where: { id: areaId } });
      if (!area) throw Errors.notFound('赛区');
      const created = await tx.school.create({ data: { name: input.name, areaId }, include: { area: true } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_CREATE, '新增学校「' + created.name + '」（赛区「' + area.name + '」）');
      return created;
    });
    return toSchoolDto(school);
  } catch (err) {
    return rethrowUnique(err, '该赛区下已存在同名学校');
  }
}

export async function updateSchool(operatorId: bigint, id: bigint, input: UpdateSchoolInput): Promise<SchoolDto> {
  try {
    const school = await prisma.$transaction(async (tx) => {
      const existing = await tx.school.findUnique({ where: { id }, include: { area: true } });
      if (!existing) throw Errors.notFound('学校');
      if (existing.isIndividual && (input.name !== undefined || input.areaId !== undefined)) {
        throw Errors.validation('个人/特殊保护学校不允许改名或移区');
      }
      const nextAreaId = input.areaId === undefined ? existing.areaId : BigInt(input.areaId);
      const nextArea = input.areaId === undefined
        ? existing.area
        : await tx.area.findUnique({ where: { id: nextAreaId } });
      if (!nextArea) throw Errors.notFound('赛区');
      const updated = await tx.school.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.areaId !== undefined ? { areaId: nextAreaId } : {}),
        },
        include: { area: true },
      });
      const changes: string[] = [];
      if (input.name !== undefined) {
        changes.push('名称「' + existing.name + '」→「' + updated.name + '」');
      }
      if (nextAreaId !== existing.areaId) {
        changes.push('赛区「' + (existing.area?.name ?? String(existing.areaId)) + '」→「' + nextArea.name + '」');
      }
      const detail = changes.length > 0 ? changes.join('；') : '无字段变化';
      await writeDictAudit(
        tx,
        operatorId,
        AuditAction.DICT_UPDATE,
        '修改学校「' + existing.name + '」#' + existing.id + '：' + detail,
      );
      return updated;
    });
    return toSchoolDto(school);
  } catch (err) {
    return rethrowUnique(err, '该赛区下已存在同名学校');
  }
}

export async function deleteSchool(operatorId: bigint, id: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.school.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('学校');
    if (existing.isIndividual) throw Errors.validation('个人/特殊保护学校不允许删除');
    const [members, applications, refs] = await Promise.all([
      tx.memberProfile.count({ where: { schoolId: id } }),
      tx.auditApplication.count({ where: { schoolId: id } }),
      tx.legacyMemberRef.count({ where: { schoolId: id } }),
    ]);
    if (members + applications + refs > 0) throw Errors.dictInUse();
    await tx.school.delete({ where: { id } });
    await writeDictAudit(tx, operatorId, AuditAction.DICT_DELETE, '删除学校「' + existing.name + '」#' + existing.id);
  });
}

// ---------- 名称字典：年级 / 奖项 ----------

export async function createGrade(operatorId: bigint, input: DictNameInput): Promise<NameDictDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const grade = await tx.grade.create({ data: { name: input.name } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_CREATE, '新增年级「' + grade.name + '」');
      return toNameDto(grade);
    });
  } catch (err) {
    return rethrowUnique(err, '年级名称已存在');
  }
}

export async function updateGrade(operatorId: bigint, id: bigint, input: DictNameInput): Promise<NameDictDto> {
  try {
    const grade = await prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findUnique({ where: { id } });
      if (!existing) throw Errors.notFound('年级');
      const updated = await tx.grade.update({ where: { id }, data: { name: input.name } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_UPDATE, '修改年级「' + existing.name + '」为「' + updated.name + '」');
      return updated;
    });
    return toNameDto(grade);
  } catch (err) {
    return rethrowUnique(err, '年级名称已存在');
  }
}

export async function deleteGrade(operatorId: bigint, id: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.grade.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('年级');
    await tx.grade.delete({ where: { id } });
    await writeDictAudit(tx, operatorId, AuditAction.DICT_DELETE, '删除年级「' + existing.name + '」#' + existing.id);
  });
}

export async function createPrize(operatorId: bigint, input: DictNameInput): Promise<NameDictDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const prize = await tx.prize.create({ data: { name: input.name } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_CREATE, '新增奖项「' + prize.name + '」');
      return toNameDto(prize);
    });
  } catch (err) {
    return rethrowUnique(err, '奖项名称已存在');
  }
}

export async function updatePrize(operatorId: bigint, id: bigint, input: DictNameInput): Promise<NameDictDto> {
  try {
    const prize = await prisma.$transaction(async (tx) => {
      const existing = await tx.prize.findUnique({ where: { id } });
      if (!existing) throw Errors.notFound('奖项');
      const updated = await tx.prize.update({ where: { id }, data: { name: input.name } });
      await writeDictAudit(tx, operatorId, AuditAction.DICT_UPDATE, '修改奖项「' + existing.name + '」为「' + updated.name + '」');
      return updated;
    });
    return toNameDto(prize);
  } catch (err) {
    return rethrowUnique(err, '奖项名称已存在');
  }
}

export async function deletePrize(operatorId: bigint, id: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.prize.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('奖项');
    await tx.prize.delete({ where: { id } });
    await writeDictAudit(tx, operatorId, AuditAction.DICT_DELETE, '删除奖项「' + existing.name + '」#' + existing.id);
  });
}
