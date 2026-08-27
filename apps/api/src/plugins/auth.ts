import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Errors } from '../lib/errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string | null };
    user: { sub: string; email: string | null };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * 认证守卫（fastify-plugin：装饰挂在根实例，对所有路由可见）
 * authenticate：校验 Bearer 访问令牌，失败 → 401
 */
export const authPlugin = fp(
  async (app) => {
    app.decorate('authenticate', async (req: FastifyRequest) => {
      try {
        await req.jwtVerify();
      } catch {
        throw Errors.unauthorized();
      }
    });
  },
  { name: 'cphos-auth' },
);
