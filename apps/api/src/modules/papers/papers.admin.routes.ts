import type { FastifyInstance } from 'fastify';
import { idSchema, listPapersQuerySchema, setPaperReviewCountSchema } from '@cphos/shared';
import { getPaperForAdmin, listAllPapers, setPaperReviewCount } from './papers.service.js';

/** 管理侧：整卷查询与逐卷评阅次数调整 */
export async function adminPaperRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];
  app.get('/papers', { onRequest: guard }, async (req) => {
    return listAllPapers(listPapersQuerySchema.parse(req.query));
  });
  app.get('/papers/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getPaperForAdmin(BigInt(idSchema.parse(id)));
  });
  app.patch('/papers/:id/review-count', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = setPaperReviewCountSchema.parse(req.body);
    return setPaperReviewCount(BigInt(req.user.sub), BigInt(idSchema.parse(id)), input.reviewCount);
  });
}
