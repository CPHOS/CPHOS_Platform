import type {
  AreaDto,
  DictEntryDto,
  DictKind,
  ListSchoolsQuery,
  ManagedSchoolDto,
  ManagedSchoolListDto,
} from '@cphos/shared';
import type { Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

/** 业务规则依赖的特殊条目：禁止改名/删除 */
const PROTECTED_SCHOOL_IDS = new Set([134n, 174n]);
const PROTECTED_AREA_IDS = new Set([2n, 21n]);

const DICT_LABELS: Record<DictKind, string> = { grades: '年级', prizes: '奖项', topics: '题号' };

/** id 分配：max(id)+1（保留旧库种子 id 语义；管理员低频操作足够安全） */
async function nextId(loadMax: () => Promise<bigint | null>): Promise<bigint> {
  const last = await loadMax();
  return (last ?? 0n) + 1n;
}

async function audit(action: 'DICT_CREATE' | 'DICT_UPDATE' | 'DICT_DELETE', operatorId: bigint, remark: string) {
  await prisma.auditLog.create({ data: { operatorId, action, remark } });
}

// ---------- 赛区 ----------

export async function listAreas(): Promise<AreaDto[]> {
  const areas = await prisma.area.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { schools: true } } },
  });
  return areas.map((a) => ({ id: String(a.id), name: a.name, schoolCount: a._count.schools }));
}

export async function createArea(operatorId: bigint, name: string): Promise<AreaDto> {
  const area = await prisma.area.create({
    data: { id: await nextId(async () => (await prisma.area.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null), name },
    include: { _count: { select: { schools: true } } },
  });
  await audit('DICT_CREATE', operatorId, `新增赛区 ${name}`);
  return { id: String(area.id), name: area.name, schoolCount: area._count.schools };
}

export async function renameArea(operatorId: bigint, id: bigint, name: string): Promise<AreaDto> {
  if (PROTECTED_AREA_IDS.has(id)) throw Errors.validation('该赛区为系统内置，不可修改');
  const area = await prisma.area.update({
    where: { id },
    data: { name },
    include: { _count: { select: { schools: true } } },
  });
  await audit('DICT_UPDATE', operatorId, `赛区改名 → ${name}`);
  return { id: String(area.id), name: area.name, schoolCount: area._count.schools };
}

export async function deleteArea(operatorId: bigint, id: bigint): Promise<void> {
  if (PROTECTED_AREA_IDS.has(id)) throw Errors.validation('该赛区为系统内置，不可删除');
  const schools = await prisma.school.count({ where: { areaId: id } });
  if (schools > 0) throw Errors.validation('该赛区下存在学校，无法删除');
  await prisma.area.delete({ where: { id } });
  await audit('DICT_DELETE', operatorId, `删除赛区 #${id}`);
}

// ---------- 学校 ----------

export async function listSchools(query: ListSchoolsQuery): Promise<ManagedSchoolListDto> {
  const { areaId, q, page, pageSize } = query;
  const where: Prisma.SchoolWhereInput = {
    ...(areaId ? { areaId: BigInt(areaId) } : {}),
    ...(q ? { name: { contains: q } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.school.count({ where }),
    prisma.school.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { area: true, _count: { select: { members: true } } },
    }),
  ]);
  return {
    items: rows.map((s) => ({
      id: String(s.id),
      name: s.name,
      areaId: String(s.areaId),
      areaName: s.area.name,
      memberCount: s._count.members,
    })),
    total,
    page,
    pageSize,
  };
}

export async function createSchool(operatorId: bigint, name: string, areaId: bigint): Promise<ManagedSchoolDto> {
  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) throw Errors.validation('所选赛区不存在');
  try {
    const school = await prisma.school.create({
      data: {
        id: await nextId(async () => (await prisma.school.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null),
        name,
        areaId,
      },
      include: { area: true, _count: { select: { members: true } } },
    });
    await audit('DICT_CREATE', operatorId, `新增学校 ${name}`);
    return {
      id: String(school.id),
      name: school.name,
      areaId: String(school.areaId),
      areaName: school.area.name,
      memberCount: school._count.members,
    };
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该学校名称已存在');
    }
    throw err;
  }
}

export async function updateSchool(
  operatorId: bigint,
  id: bigint,
  input: { name?: string; areaId?: string },
): Promise<ManagedSchoolDto> {
  if (PROTECTED_SCHOOL_IDS.has(id)) throw Errors.validation('该学校为系统内置，不可修改');
  try {
    const school = await prisma.school.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.areaId !== undefined ? { areaId: BigInt(input.areaId) } : {}),
      },
      include: { area: true, _count: { select: { members: true } } },
    });
    await audit('DICT_UPDATE', operatorId, `学校修改 #${id}`);
    return {
      id: String(school.id),
      name: school.name,
      areaId: String(school.areaId),
      areaName: school.area.name,
      memberCount: school._count.members,
    };
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该学校名称已存在');
    }
    throw err;
  }
}

export async function deleteSchool(operatorId: bigint, id: bigint): Promise<void> {
  if (PROTECTED_SCHOOL_IDS.has(id)) throw Errors.validation('该学校为系统内置，不可删除');
  const members = await prisma.memberProfile.count({ where: { schoolId: id } });
  if (members > 0) throw Errors.validation('该学校下存在成员，无法删除');
  await prisma.school.delete({ where: { id } });
  await audit('DICT_DELETE', operatorId, `删除学校 #${id}`);
}

// ---------- 简单字典（年级/奖项/题号） ----------

type DictRow = { id: bigint; name: string };

async function dictFindMany(kind: DictKind): Promise<DictRow[]> {
  switch (kind) {
    case 'grades':
      return prisma.grade.findMany({ orderBy: { id: 'asc' } });
    case 'prizes':
      return prisma.prize.findMany({ orderBy: { id: 'asc' } });
    case 'topics':
      return prisma.topic.findMany({ orderBy: { id: 'asc' } });
  }
}

async function dictMaxId(kind: DictKind): Promise<bigint | null> {
  switch (kind) {
    case 'grades':
      return (await prisma.grade.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
    case 'prizes':
      return (await prisma.prize.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
    case 'topics':
      return (await prisma.topic.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
  }
}

async function dictCreate(kind: DictKind, id: bigint, name: string): Promise<DictRow> {
  switch (kind) {
    case 'grades':
      return prisma.grade.create({ data: { id, name } });
    case 'prizes':
      return prisma.prize.create({ data: { id, name } });
    case 'topics':
      return prisma.topic.create({ data: { id, name } });
  }
}

async function dictUpdate(kind: DictKind, id: bigint, name: string): Promise<DictRow> {
  switch (kind) {
    case 'grades':
      return prisma.grade.update({ where: { id }, data: { name } });
    case 'prizes':
      return prisma.prize.update({ where: { id }, data: { name } });
    case 'topics':
      return prisma.topic.update({ where: { id }, data: { name } });
  }
}

async function dictDelete(kind: DictKind, id: bigint): Promise<void> {
  switch (kind) {
    case 'grades':
      await prisma.grade.delete({ where: { id } });
      return;
    case 'prizes':
      await prisma.prize.delete({ where: { id } });
      return;
    case 'topics':
      await prisma.topic.delete({ where: { id } });
      return;
  }
}

export async function listDict(kind: DictKind): Promise<DictEntryDto[]> {
  const rows = await dictFindMany(kind);
  return rows.map((r) => ({ id: String(r.id), name: r.name }));
}

export async function createDictEntry(operatorId: bigint, kind: DictKind, name: string): Promise<DictEntryDto> {
  const row = await dictCreate(kind, await nextId(() => dictMaxId(kind)), name);
  await audit('DICT_CREATE', operatorId, `新增${DICT_LABELS[kind]} ${name}`);
  return { id: String(row.id), name: row.name };
}

export async function renameDictEntry(operatorId: bigint, kind: DictKind, id: bigint, name: string): Promise<DictEntryDto> {
  const row = await dictUpdate(kind, id, name);
  await audit('DICT_UPDATE', operatorId, `${DICT_LABELS[kind]}改名 → ${name}`);
  return { id: String(row.id), name: row.name };
}

export async function deleteDictEntry(operatorId: bigint, kind: DictKind, id: bigint): Promise<void> {
  // TODO(M2)：学生建档引用年级/奖项/题号后，删除前需校验引用
  await dictDelete(kind, id);
  await audit('DICT_DELETE', operatorId, `删除${DICT_LABELS[kind]} #${id}`);
}
