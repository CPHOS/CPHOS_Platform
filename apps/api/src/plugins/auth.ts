import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AccountRole, UserStatus } from '@cphos/shared';
import { Errors } from '../lib/errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string | null };
    user: {
      sub: string;
      email: string | null;
      /** 授权守卫（authorize）填充，authenticate 阶段不存在 */
      role?: AccountRole;
      status?: UserStatus;
    };
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
