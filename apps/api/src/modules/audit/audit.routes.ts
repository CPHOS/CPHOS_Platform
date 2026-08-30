import type { FastifyInstance } from 'fastify';
import { submitApplicationSchema } from '@cphos/shared';
import {
  getMyApplication,
  submitApplication,
  updateApplication,
} from './audit.service.js';

/** 平台用户侧：提交 / 查看 / 修改审核资料（认证 + 普通用户守卫） */
export async function auditRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];

  app.post('/applications', { onRequest: guard }, async (req, reply) => {
    const input = submitApplicationSchema.parse(req.body);
    const result = await submitApplication(BigInt(req.user.sub), input);
    return reply.code(201).send(result);
  });

  app.get('/applications/me', { onRequest: guard }, async (req) => {
    return getMyApplication(BigInt(req.user.sub));
  });

  app.put('/applications/me', { onRequest: guard }, async (req) => {
    const input = submitApplicationSchema.parse(req.body);
    return updateApplication(BigInt(req.user.sub), input);
  });
}
