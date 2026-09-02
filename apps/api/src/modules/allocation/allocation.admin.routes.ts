import type { FastifyInstance } from 'fastify';
import {
  createAllocationSchema,
  idSchema,
  listAllocationBatchesQuerySchema,
  regradeAllocationSchema,
} from '@cphos/shared';
import {
  createAllocation,
  getBatch,
  listAllocationBatches,
  previewAllocation,
  regradeBatch,
  revokeBatch,
} from './allocation.service.js';

/** 管理侧：精确均衡分配与双阅批次 */
export async function adminAllocationRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];

  app.get('/exams/:examId/allocation/preview', { onRequest: guard }, async (req) => {
    const { examId } = req.params as { examId: string };
    return previewAllocation(BigInt(idSchema.parse(examId)));
  });

  app.post('/exams/:examId/allocation', { onRequest: guard }, async (req, reply) => {
    const { examId } = req.params as { examId: string };
    const batch = await createAllocation(
      BigInt(idSchema.parse(examId)),
      BigInt(req.user.sub),
      createAllocationSchema.parse(req.body ?? {}),
    );
    return reply.code(201).send(batch);
  });

  app.get('/exams/:examId/allocation/batches', { onRequest: guard }, async (req) => {
    const { examId } = req.params as { examId: string };
    return listAllocationBatches(
      BigInt(idSchema.parse(examId)),
      listAllocationBatchesQuerySchema.parse(req.query),
    );
  });

  app.get('/allocation/batches/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getBatch(BigInt(idSchema.parse(id)));
  });

  app.post('/allocation/batches/:id/revoke', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return revokeBatch(BigInt(idSchema.parse(id)), BigInt(req.user.sub));
  });

  app.post('/allocation/batches/:id/regrade', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const input = regradeAllocationSchema.parse(req.body);
    return regradeBatch(BigInt(idSchema.parse(id)), BigInt(req.user.sub), input);
  });
}
