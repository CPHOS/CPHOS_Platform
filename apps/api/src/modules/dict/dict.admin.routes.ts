import type { FastifyInstance } from 'fastify';
import {
  createAreaSchema,
  createDictEntrySchema,
  createSchoolSchema,
  dictKindSchema,
  idSchema,
  listSchoolsQuerySchema,
  updateSchoolSchema,
} from '@cphos/shared';
import {
  createArea,
  createDictEntry,
  createSchool,
  deleteArea,
  deleteDictEntry,
  deleteSchool,
  listAreas,
  listDict,
  listSchools,
  renameArea,
  renameDictEntry,
  updateSchool,
} from './dict.service.js';

/** 管理侧：字典维护（赛区/学校/年级/奖项/题号）。
 *  新增/改名 = ADMIN/SUPER_ADMIN；删除 = 仅 SUPER_ADMIN（有引用时服务层拒绝）。 */
export async function adminDictRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];
  const superGuard = [app.authenticate, app.requireRole('SUPER_ADMIN')];

  // ---- 赛区 ----
  app.get('/areas', { onRequest: guard }, async () => listAreas());

  app.post('/areas', { onRequest: guard }, async (req, reply) => {
    const input = createAreaSchema.parse(req.body);
    return reply.code(201).send(await createArea(BigInt(req.user.sub), input.name));
  });

  app.patch('/areas/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = createAreaSchema.parse(req.body);
    return renameArea(BigInt(req.user.sub), BigInt(idSchema.parse(id)), input.name);
  });

  app.delete('/areas/:id', { onRequest: superGuard }, async (req) => {
    const { id } = req.params as { id: string };
    return deleteArea(BigInt(req.user.sub), BigInt(idSchema.parse(id)));
  });

  // ---- 学校 ----
  app.get('/schools', { onRequest: guard }, async (req) => {
    return listSchools(listSchoolsQuerySchema.parse(req.query));
  });

  app.post('/schools', { onRequest: guard }, async (req, reply) => {
    const input = createSchoolSchema.parse(req.body);
    const result = await createSchool(BigInt(req.user.sub), input.name, BigInt(input.areaId));
    return reply.code(201).send(result);
  });

  app.patch('/schools/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = updateSchoolSchema.parse(req.body);
    return updateSchool(BigInt(req.user.sub), BigInt(idSchema.parse(id)), input);
  });

  app.delete('/schools/:id', { onRequest: superGuard }, async (req) => {
    const { id } = req.params as { id: string };
    return deleteSchool(BigInt(req.user.sub), BigInt(idSchema.parse(id)));
  });

  // ---- 简单字典（年级/奖项/题号） ----
  app.get('/dicts/:kind', { onRequest: guard }, async (req) => {
    const { kind } = req.params as { kind: string };
    return listDict(dictKindSchema.parse(kind));
  });

  app.post('/dicts/:kind', { onRequest: guard }, async (req, reply) => {
    const { kind } = req.params as { kind: string };
    const input = createDictEntrySchema.parse(req.body);
    return reply.code(201).send(await createDictEntry(BigInt(req.user.sub), dictKindSchema.parse(kind), input.name));
  });

  app.patch('/dicts/:kind/:id', { onRequest: guard }, async (req) => {
    const { kind, id } = req.params as { kind: string; id: string };
    const input = createDictEntrySchema.parse(req.body);
    return renameDictEntry(BigInt(req.user.sub), dictKindSchema.parse(kind), BigInt(idSchema.parse(id)), input.name);
  });

  app.delete('/dicts/:kind/:id', { onRequest: superGuard }, async (req) => {
    const { kind, id } = req.params as { kind: string; id: string };
    return deleteDictEntry(BigInt(req.user.sub), dictKindSchema.parse(kind), BigInt(idSchema.parse(id)));
  });
}
