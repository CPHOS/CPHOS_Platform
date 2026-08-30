import type { FastifyInstance } from 'fastify';
import { idSchema, listMembersQuerySchema, updateMemberSchema } from '@cphos/shared';
import { getMember, listMembers, updateMember } from './members.service.js';

/** 管理侧：成员档案管理（列表/详情/更新），仅 ADMIN / SUPER_ADMIN */
export async function adminMemberRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/members', { onRequest: guard }, async (req) => {
    const query = listMembersQuerySchema.parse(req.query);
    return listMembers(query);
  });

  app.get('/members/:userId', { onRequest: guard }, async (req) => {
    const { userId } = req.params as { userId: string };
    return getMember(BigInt(idSchema.parse(userId)));
  });

  app.patch('/members/:userId', { onRequest: guard }, async (req) => {
    const { userId } = req.params as { userId: string };
    const input = updateMemberSchema.parse(req.body);
    return updateMember(BigInt(idSchema.parse(userId)), BigInt(req.user.sub), input);
  });
}
