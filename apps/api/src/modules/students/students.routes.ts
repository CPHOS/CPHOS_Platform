import type { FastifyInstance } from 'fastify';
import {
  createStudentSchema,
  idSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from '@cphos/shared';
import {
  archiveMyStudent,
  createMyStudent,
  listMyStudents,
  updateMyStudent,
} from './students.service.js';

/** 平台用户：本人学生名册 */
export async function studentRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];

  app.get('/students/mine', { onRequest: guard }, async (req) => {
    const query = listStudentsQuerySchema.parse(req.query);
    return listMyStudents(BigInt(req.user.sub), query);
  });

  app.post('/students', { onRequest: guard }, async (req, reply) => {
    const student = await createMyStudent(BigInt(req.user.sub), createStudentSchema.parse(req.body));
    return reply.code(201).send(student);
  });

  app.patch('/students/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return updateMyStudent(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      updateStudentSchema.parse(req.body),
    );
  });

  app.delete('/students/:id', { onRequest: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await archiveMyStudent(BigInt(req.user.sub), BigInt(idSchema.parse(id)));
    return reply.code(204).send();
  });
}
