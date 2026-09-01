import type { FastifyInstance } from 'fastify';
import { idSchema, rankingExportQuerySchema, rankingQuerySchema } from '@cphos/shared';
import { exportRanking, getRanking } from './ranking.service.js';

/** 管理侧：成绩排名与导出 */
export async function adminRankingRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/exams/:examId/ranking', { onRequest: guard }, async (req) => {
    const { examId } = req.params as { examId: string };
    const query = rankingQuerySchema.parse(req.query);
    return getRanking(BigInt(idSchema.parse(examId)), query.segments);
  });

  app.get('/exams/:examId/ranking/export', { onRequest: guard }, async (req, reply) => {
    const { examId } = req.params as { examId: string };
    const query = rankingExportQuerySchema.parse(req.query);
    const rankingQuery = rankingQuerySchema.parse(req.query);
    const file = await exportRanking(
      BigInt(idSchema.parse(examId)),
      BigInt(req.user.sub),
      query.format,
      rankingQuery.segments,
    );
    reply.header(
      'Content-Disposition',
      "attachment; filename*=UTF-8''" + encodeURIComponent(file.filename),
    );
    reply.type(file.contentType);
    return reply.send(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer));
  });
}
