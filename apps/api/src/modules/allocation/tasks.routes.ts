import type { FastifyInstance } from 'fastify';
import { listMarkingTasksQuerySchema } from '@cphos/shared';
import { listMyMarkingTasks } from './allocation.service.js';

/** 平台用户：分配给我的双阅任务 */
export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];
  app.get('/tasks/mine', { onRequest: guard }, async (req) => {
    return listMyMarkingTasks(BigInt(req.user.sub), listMarkingTasksQuerySchema.parse(req.query));
  });
}
