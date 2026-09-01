import type { FastifyInstance } from 'fastify';
import {
  createSubAccountSchema,
  idSchema,
  listTeamsQuerySchema,
  updateTeamSchema,
} from '@cphos/shared';
import {
  addSubAccount,
  getTeam,
  listTeams,
  removeMember,
  updateTeam,
} from './teams.service.js';

/** 管理侧：团队管理（列表/详情/更新/子账号/移除成员），仅 ADMIN / SUPER_ADMIN */
export async function adminTeamRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/teams', { onRequest: guard }, async (req) => {
    const query = listTeamsQuerySchema.parse(req.query);
    return listTeams(query);
  });

  app.get('/teams/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getTeam(BigInt(idSchema.parse(id)));
  });

  app.patch('/teams/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = updateTeamSchema.parse(req.body);
    return updateTeam(BigInt(idSchema.parse(id)), BigInt(req.user.sub), input);
  });

  app.post('/teams/:id/members', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = createSubAccountSchema.parse(req.body);
    const result = await addSubAccount(BigInt(idSchema.parse(id)), BigInt(req.user.sub), input);
    return reply.code(201).send(result);
  });

  app.delete('/teams/:id/members/:userId', { onRequest: guard }, async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    return removeMember(BigInt(idSchema.parse(id)), BigInt(idSchema.parse(userId)), BigInt(req.user.sub));
  });
}
