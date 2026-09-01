import type { FastifyInstance } from 'fastify';
import {
  idSchema,
  listApplicationsQuerySchema,
  listAuditLogsQuerySchema,
  reviewDecisionSchema,
} from '@cphos/shared';
import {
  getApplication,
  listApplications,
  listLogs,
  matchCandidates,
  review,
} from './audit.service.js';

/** 管理侧：审核工作台（列表/详情/认领候选/审核决策/日志），仅 ADMIN / SUPER_ADMIN */
export async function adminAuditRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/applications', { onRequest: guard }, async (req) => {
    const query = listApplicationsQuerySchema.parse(req.query);
    return listApplications(query);
  });

  app.get('/applications/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getApplication(BigInt(idSchema.parse(id)));
  });

  app.get('/applications/:id/candidates', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return matchCandidates(BigInt(idSchema.parse(id)));
  });

  app.post('/applications/:id/review', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = reviewDecisionSchema.parse(req.body);
    return review(BigInt(idSchema.parse(id)), BigInt(req.user.sub), input);
  });

  app.get('/logs', { onRequest: guard }, async (req) => {
    const query = listAuditLogsQuerySchema.parse(req.query);
    return listLogs({
      applicationId: query.applicationId ? BigInt(query.applicationId) : undefined,
      action: query.action,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}
