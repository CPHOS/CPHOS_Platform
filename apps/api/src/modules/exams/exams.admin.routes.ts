import type { FastifyInstance } from 'fastify';
import {
  createExamSchema,
  idSchema,
  listExamsQuerySchema,
  updateExamSchema,
  upsertExamConfigSchema,
} from '@cphos/shared';
import {
  archiveExam,
  closeExam,
  createExam,
  deleteDraftExam,
  getExam,
  listExams,
  publishExam,
  updateExam,
  upsertExamConfig,
} from './exams.service.js';

/** 管理侧：考试批次与考试级配置，仅 ADMIN / SUPER_ADMIN */
export async function adminExamRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/exams', { onRequest: guard }, async (req) => {
    return listExams(listExamsQuerySchema.parse(req.query));
  });

  app.get('/exams/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getExam(BigInt(idSchema.parse(id)));
  });

  app.post('/exams', { onRequest: guard }, async (req, reply) => {
    const exam = await createExam(BigInt(req.user.sub), createExamSchema.parse(req.body));
    return reply.code(201).send(exam);
  });

  app.patch('/exams/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updateExam(BigInt(idSchema.parse(id)), BigInt(req.user.sub), updateExamSchema.parse(req.body));
  });

  app.put('/exams/:id/config', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return upsertExamConfig(
      BigInt(idSchema.parse(id)),
      BigInt(req.user.sub),
      upsertExamConfigSchema.parse(req.body),
    );
  });

  app.post('/exams/:id/publish', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return publishExam(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
  });

  app.post('/exams/:id/close', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return closeExam(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
  });

  app.post('/exams/:id/archive', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return archiveExam(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
  });

  app.delete('/exams/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteDraftExam(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
    return reply.code(204).send();
  });
}
