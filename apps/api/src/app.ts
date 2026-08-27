import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { authPlugin } from './plugins/auth.js';
import { installErrorHandler } from './plugins/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';

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

  installErrorHandler(app);

  app.get('/api/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}
