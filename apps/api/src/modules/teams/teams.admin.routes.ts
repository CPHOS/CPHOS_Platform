import type { FastifyInstance } from 'fastify';
import {
  createTeamSchema,
  idSchema,
  listTeamsQuerySchema,
  teamMembersSchema,
  updateTeamSchema,
} from '@cphos/shared';
import {
  addMembers,
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  removeMembers,
  updateTeam,
} from './teams.service.js';

/** 管理侧：团队管理（列表/详情/创建/更新/成员增删/删除），仅 ADMIN / SUPER_ADMIN */
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

  app.post('/teams', { onRequest: guard }, async (req, reply) => {
    const input = createTeamSchema.parse(req.body);
    const team = await createTeam(BigInt(req.user.sub), input);
    return reply.code(201).send(team);
  });

  app.patch('/teams/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = updateTeamSchema.parse(req.body);
    return updateTeam(BigInt(idSchema.parse(id)), BigInt(req.user.sub), input);
  });

  app.post('/teams/:id/members', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = teamMembersSchema.parse(req.body);
    return addMembers(
      BigInt(idSchema.parse(id)),
      BigInt(req.user.sub),
      input.userIds.map((userId) => BigInt(userId)),
    );
  });

  app.delete('/teams/:id/members', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = teamMembersSchema.parse(req.body);
    return removeMembers(
      BigInt(idSchema.parse(id)),
      BigInt(req.user.sub),
      input.userIds.map((userId) => BigInt(userId)),
    );
  });

  app.delete('/teams/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteTeam(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
    return reply.code(204).send();
  });
}
