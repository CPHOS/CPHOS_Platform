import type { FastifyInstance } from 'fastify';
import {
  gradeArbitrationSchema,
  gradeMarkingTaskSchema,
  idSchema,
  listArbitrationsQuerySchema,
} from '@cphos/shared';
import { claimArbitration, gradeArbitration, gradeMarkingTask, listArbitrations } from './marking.service.js';

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
