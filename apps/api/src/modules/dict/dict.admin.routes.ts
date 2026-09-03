import type { FastifyInstance } from 'fastify';
import {
  dictNameSchema,
  idSchema,
  schoolInputSchema,
  updateSchoolSchema,
} from '@cphos/shared';
import {
  createArea,
  createGrade,
  createPrize,
  createSchool,
  deleteArea,
  deleteGrade,
  deletePrize,
  deleteSchool,
  getDictBundle,
  updateArea,
  updateGrade,
  updatePrize,
  updateSchool,
} from './dict.service.js';

/** 管理侧：字典维护（赛区/学校/年级/奖项），仅 ADMIN / SUPER_ADMIN。所有增删改均写审计日志。 */
export async function adminDictRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/dict', { onRequest: guard }, async () => getDictBundle());

  app.post('/dict/areas', { onRequest: guard }, async (req, reply) => {
    const item = await createArea(BigInt((req.user as { sub: string }).sub), dictNameSchema.parse(req.body));
    return reply.code(201).send(item);
  });
  app.patch('/dict/areas/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updateArea(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)), dictNameSchema.parse(req.body));
  });
  app.delete('/dict/areas/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteArea(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)));
    return reply.code(204).send();
  });

  app.post('/dict/schools', { onRequest: guard }, async (req, reply) => {
    const item = await createSchool(BigInt((req.user as { sub: string }).sub), schoolInputSchema.parse(req.body));
    return reply.code(201).send(item);
  });
  app.patch('/dict/schools/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updateSchool(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)), updateSchoolSchema.parse(req.body));
  });
  app.delete('/dict/schools/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteSchool(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)));
    return reply.code(204).send();
  });

  app.post('/dict/grades', { onRequest: guard }, async (req, reply) => {
    const item = await createGrade(BigInt((req.user as { sub: string }).sub), dictNameSchema.parse(req.body));
    return reply.code(201).send(item);
  });
  app.patch('/dict/grades/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updateGrade(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)), dictNameSchema.parse(req.body));
  });
  app.delete('/dict/grades/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteGrade(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)));
    return reply.code(204).send();
  });

  app.post('/dict/prizes', { onRequest: guard }, async (req, reply) => {
    const item = await createPrize(BigInt((req.user as { sub: string }).sub), dictNameSchema.parse(req.body));
    return reply.code(201).send(item);
  });
  app.patch('/dict/prizes/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updatePrize(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)), dictNameSchema.parse(req.body));
  });
  app.delete('/dict/prizes/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deletePrize(BigInt((req.user as { sub: string }).sub), BigInt(idSchema.parse(id)));
    return reply.code(204).send();
  });
}
