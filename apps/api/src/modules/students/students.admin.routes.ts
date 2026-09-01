import type { FastifyInstance } from 'fastify';
import { listStudentsQuerySchema } from '@cphos/shared';
import { listAllStudents } from './students.service.js';

/** 管理侧：全校学生名册只读查询 */
export async function adminStudentRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireRole('ADMIN', 'SUPER_ADMIN')];
  app.get('/students', { onRequest: guard }, async (req) => {
    return listAllStudents(listStudentsQuerySchema.parse(req.query));
  });
}
