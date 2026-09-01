import type { FastifyInstance } from 'fastify';
import { listExamsQuerySchema } from '@cphos/shared';
import { listExams } from './exams.service.js';

/** 已登录平台用户：可报名/上传的已发布考试 */
export async function examRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];
  app.get('/exams/published', { onRequest: guard }, async (req) => {
    const query = listExamsQuerySchema.parse({ ...(req.query as object), status: 'PUBLISHED', pageSize: 100 });
    return listExams(query);
  });
}
