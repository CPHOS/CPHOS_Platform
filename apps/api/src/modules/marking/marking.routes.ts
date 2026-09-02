import type { FastifyInstance } from 'fastify';
import {
  gradeArbitrationSchema,
  gradeMarkingTaskSchema,
  idSchema,
  listArbitrationsQuerySchema,
} from '@cphos/shared';
import { getArbitrationImageStream, getArbitrationPageStream } from '../papers/papers.service.js';
import {
  assertArbitrationAccess,
  claimArbitration,
  gradeArbitration,
  gradeMarkingTask,
  listArbitrations,
} from './marking.service.js';

/** 平台打分 + CPHOS 仲裁 */
export async function markingRoutes(app: FastifyInstance): Promise<void> {
  const platformGuard = [app.authenticate, app.requireActivePlatformUser];
  const arbitrationGuard = [
    app.authenticate,
    app.requireRole('CPHOS_MEMBER', 'ADMIN', 'SUPER_ADMIN', 'BOT'),
  ];

  app.post('/tasks/:id/grade', { onRequest: platformGuard }, async (req) => {
    const { id } = req.params as { id: string };
    await gradeMarkingTask(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      gradeMarkingTaskSchema.parse(req.body),
    );
    return { message: '评分已提交' };
  });

  app.get('/arbitration/tasks', { onRequest: arbitrationGuard }, async (req) => {
    return listArbitrations(BigInt(req.user.sub), listArbitrationsQuerySchema.parse(req.query));
  });

  app.get('/arbitration/tasks/:id/images/:imageId/file', { onRequest: arbitrationGuard }, async (req, reply) => {
    const { id, imageId } = req.params as { id: string; imageId: string };
    const arbitrationId = BigInt(idSchema.parse(id));
    await assertArbitrationAccess(BigInt(req.user.sub), arbitrationId);
    const file = await getArbitrationImageStream(
      BigInt(req.user.sub),
      arbitrationId,
      BigInt(idSchema.parse(imageId)),
    );
    reply.type(file.mimeType);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(file.stream);
  });

  app.get('/arbitration/tasks/:id/pages/:pageId/file', { onRequest: arbitrationGuard }, async (req, reply) => {
    const { id, pageId } = req.params as { id: string; pageId: string };
    const arbitrationId = BigInt(idSchema.parse(id));
    await assertArbitrationAccess(BigInt(req.user.sub), arbitrationId);
    const file = await getArbitrationPageStream(
      BigInt(req.user.sub),
      arbitrationId,
      BigInt(idSchema.parse(pageId)),
    );
    reply.type(file.mimeType);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(file.stream);
  });

  app.post('/arbitration/tasks/:id/claim', { onRequest: arbitrationGuard }, async (req) => {
    const { id } = req.params as { id: string };
    await claimArbitration(BigInt(req.user.sub), BigInt(idSchema.parse(id)));
    return { message: '已认领仲裁任务' };
  });

  app.post('/arbitration/tasks/:id/grade', { onRequest: arbitrationGuard }, async (req) => {
    const { id } = req.params as { id: string };
    await gradeArbitration(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      gradeArbitrationSchema.parse(req.body),
    );
    return { message: '仲裁评分已提交' };
  });
}
