import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { ERROR_CODES } from '@cphos/shared';
import { authPlugin } from './plugins/auth.js';
import { authorizePlugin } from './plugins/authorize.js';
import { installErrorHandler } from './plugins/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { adminAuditRoutes } from './modules/audit/audit.admin.routes.js';
import { dictRoutes } from './modules/dict/dict.routes.js';
import { adminMemberRoutes } from './modules/members/members.admin.routes.js';
import { adminAccountRoutes } from './modules/members/accounts.admin.routes.js';
import { adminTeamRoutes } from './modules/teams/teams.admin.routes.js';
import { adminDictRoutes } from './modules/dict/dict.admin.routes.js';
import { adminExamRoutes } from './modules/exams/exams.admin.routes.js';
import { examRoutes } from './modules/exams/exams.routes.js';
import { studentRoutes } from './modules/students/students.routes.js';
import { adminStudentRoutes } from './modules/students/students.admin.routes.js';
import { paperRoutes } from './modules/papers/papers.routes.js';
import { adminPaperRoutes } from './modules/papers/papers.admin.routes.js';
import { adminAllocationRoutes } from './modules/allocation/allocation.admin.routes.js';
import { taskRoutes } from './modules/allocation/tasks.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });
  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: '1 minute',
  });
  await app.register(authPlugin);
  await app.register(authorizePlugin);

  installErrorHandler(app);

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ code: ERROR_CODES.NOT_FOUND, message: '资源不存在' });
  });

  app.get('/api/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(dictRoutes, { prefix: '/api/dict' });
  await app.register(auditRoutes, { prefix: '/api/audit' });
  await app.register(adminAuditRoutes, { prefix: '/api/admin/audit' });
  await app.register(adminMemberRoutes, { prefix: '/api/admin' });
  await app.register(adminAccountRoutes, { prefix: '/api/admin' });
  await app.register(adminTeamRoutes, { prefix: '/api/admin' });
  await app.register(adminDictRoutes, { prefix: '/api/admin' });
  await app.register(adminExamRoutes, { prefix: '/api/admin' });
  await app.register(examRoutes, { prefix: '/api' });
  await app.register(studentRoutes, { prefix: '/api' });
  await app.register(adminStudentRoutes, { prefix: '/api/admin' });
  await app.register(paperRoutes, { prefix: '/api' });
  await app.register(adminPaperRoutes, { prefix: '/api/admin' });
  await app.register(adminAllocationRoutes, { prefix: '/api/admin' });
  await app.register(taskRoutes, { prefix: '/api' });

  return app;
}
