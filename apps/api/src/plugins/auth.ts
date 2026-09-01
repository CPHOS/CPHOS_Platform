import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AccountRole, UserStatus } from '@cphos/shared';
import { prisma } from '../db.js';
import { Errors } from '../lib/errors.js';
import { hashToken } from '../lib/security.js';

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
      const botLogin = req.headers['x-bot-login'];
      const botToken = req.headers['x-bot-token'];
      if (typeof botLogin === 'string' && typeof botToken === 'string') {
        const bot = await prisma.userAccount.findFirst({
          where: { loginName: botLogin.trim().toLowerCase(), role: 'BOT', status: 'ACTIVE' },
          select: { id: true, email: true, botTokenHash: true },
        });
        if (!bot?.botTokenHash || bot.botTokenHash !== hashToken(botToken)) {
          throw Errors.unauthorized();
        }
        req.user = { sub: String(bot.id), email: bot.email };
        return;
      }
      try {
        await req.jwtVerify();
      } catch {
        throw Errors.unauthorized();
      }
    });
  },
  { name: 'cphos-auth' },
);
