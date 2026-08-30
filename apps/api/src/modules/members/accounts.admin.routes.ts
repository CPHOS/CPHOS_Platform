import type { FastifyInstance } from 'fastify';
import {
  createInternalSchema,
  idSchema,
  listAccountsQuerySchema,
  setAccountRoleSchema,
  setAccountStatusSchema,
} from '@cphos/shared';
import {
  createInternalAccount,
  listAccounts,
  setAccountRole,
  setAccountStatus,
} from './members.service.js';

/** 管理侧：账号管理（列表/建档/角色/状态） */
export async function adminAccountRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];
  const superGuard = [app.authenticate, app.requireRole('SUPER_ADMIN')];

  app.get('/accounts', { onRequest: adminGuard }, async (req) => {
    const query = listAccountsQuerySchema.parse(req.query);
    return listAccounts(query);
  });

  app.post('/accounts', { onRequest: adminGuard }, async (req, reply) => {
    const input = createInternalSchema.parse(req.body);
    const result = await createInternalAccount(input, BigInt(req.user.sub));
    return reply.code(201).send(result);
  });

  app.post('/accounts/:id/role', { onRequest: superGuard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = setAccountRoleSchema.parse(req.body);
    return setAccountRole(BigInt(idSchema.parse(id)), input.role, BigInt(req.user.sub));
  });

  app.post('/accounts/:id/status', { onRequest: adminGuard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = setAccountStatusSchema.parse(req.body);
    return setAccountStatus(BigInt(idSchema.parse(id)), input.status, BigInt(req.user.sub));
  });
}
