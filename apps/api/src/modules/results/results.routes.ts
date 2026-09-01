import type { FastifyInstance } from 'fastify';
import { idSchema, listPapersQuerySchema } from '@cphos/shared';
import { getMyRanking, listMyFinalizedPapers } from '../papers/papers.service.js';

/** 平台用户：我的定稿成绩与考试内排名 */
export async function resultRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];

  app.get('/results/mine', { onRequest: guard }, async (req) => {
    return listMyFinalizedPapers(BigInt(req.user.sub), listPapersQuerySchema.parse(req.query));
  });

  app.get('/results/my-ranking', { onRequest: guard }, async (req) => {
    const raw = (req.query as { examId?: string }).examId;
    return getMyRanking(
      BigInt(req.user.sub),
      raw ? BigInt(idSchema.parse(raw)) : undefined,
    );
  });
}
