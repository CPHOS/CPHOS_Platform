import type { FastifyInstance } from 'fastify';
import { idSchema, listMarkingTasksQuerySchema } from '@cphos/shared';
import { getMarkingTaskPageStream } from '../papers/papers.service.js';
import { listMyMarkingTasks } from './allocation.service.js';

/** 平台用户：分配给我的双阅任务 */
export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];
  app.get('/tasks/mine', { onRequest: guard }, async (req) => {
    return listMyMarkingTasks(BigInt(req.user.sub), listMarkingTasksQuerySchema.parse(req.query));
  });

  app.get('/tasks/:taskId/pages/:pageId/file', { onRequest: guard }, async (req, reply) => {
    const { taskId, pageId } = req.params as { taskId: string; pageId: string };
    const file = await getMarkingTaskPageStream(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(taskId)),
      BigInt(idSchema.parse(pageId)),
    );
    reply.type(file.mimeType);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(file.stream);
  });
}
