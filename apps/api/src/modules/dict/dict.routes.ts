import type { FastifyInstance } from 'fastify';
import type { SchoolDto } from '@cphos/shared';
import { prisma } from '../../db.js';

/** 字典只读接口：供提交资料表单等下拉使用（当前仅学校/赛区） */
export async function dictRoutes(app: FastifyInstance): Promise<void> {
  app.get('/schools', { onRequest: [app.authenticate] }, async (): Promise<SchoolDto[]> => {
    const schools = await prisma.school.findMany({ orderBy: { id: 'asc' }, include: { area: true } });
    return schools.map((s) => ({
      id: String(s.id),
      name: s.name,
      areaId: String(s.areaId),
      areaName: s.area.name,
    }));
  });
}
