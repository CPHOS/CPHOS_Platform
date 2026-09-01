import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import type { AccountRole } from '@cphos/shared';
import { prisma } from '../db.js';
import { Errors } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** 按账号层级授权：非指定角色 → 403（要求先 authenticate） */
    requireRole: (...roles: AccountRole[]) => (req: FastifyRequest) => Promise<void>;
    /** 仅限普通用户（邮箱已验证），用于提交审核资料等前置动作 */
    requireActivePlatformUser: (req: FastifyRequest) => Promise<void>;
  }
}

/**
 * 授权守卫（fastify-plugin）。
 * 在 authenticate（校验 JWT）之后运行，按 sub 查库校验角色/状态，
 * 并把 role/status 回填到 req.user 供路由层使用。
 */
export const authorizePlugin = fp(
  async (app) => {
    const loadUser = async (req: FastifyRequest) => {
      const user = await prisma.userAccount.findUnique({
        where: { id: BigInt(req.user.sub) },
      });
      if (!user) throw Errors.unauthorized();
      if (typeof req.user.tv === 'number' && req.user.tv !== user.tokenVersion) {
        throw Errors.unauthorized();
      }
      return user;
    };

    app.decorate('requireRole', (...roles: AccountRole[]) => {
      return async (req: FastifyRequest) => {
        const user = await loadUser(req);
        if (user.status === 'DISABLED') throw Errors.userDisabled();
        if (!roles.includes(user.role)) throw Errors.forbidden();
        req.user = { ...req.user, role: user.role, status: user.status };
      };
    });

    app.decorate('requireActivePlatformUser', async (req: FastifyRequest) => {
      const user = await loadUser(req);
      if (user.role !== 'PLATFORM_USER') throw Errors.forbidden();
      if (!user.emailVerifiedAt) throw Errors.emailNotVerified();
      if (user.status === 'DISABLED') throw Errors.userDisabled();
      req.user = { ...req.user, role: user.role, status: user.status };
    });
  },
  { name: 'cphos-authorize' },
);
