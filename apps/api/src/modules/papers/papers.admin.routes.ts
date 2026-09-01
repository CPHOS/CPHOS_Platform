import type { FastifyInstance } from 'fastify';
import { idSchema, listPapersQuerySchema } from '@cphos/shared';
import { getPaperForAdmin, listAllPapers } from './papers.service.js';

/** 管理侧：整卷只读查询 */
export async function adminPaperRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];
  app.get('/papers', { onRequest: guard }, async (req) => {
    return listAllPapers(listPapersQuerySchema.parse(req.query));
  });
  app.get('/papers/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getPaperForAdmin(BigInt(idSchema.parse(id)));
  });
}
