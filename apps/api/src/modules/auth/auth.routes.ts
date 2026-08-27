import type { FastifyInstance } from 'fastify';
import {
  loginSchema,
  registerSchema,
  sendCodeSchema,
  verifyEmailSchema,
  type AuthResponse,
} from '@cphos/shared';
import { Errors } from '../../lib/errors.js';
import {
  getUserDto,
  login,
  logout,
  register,
  rotateRefreshToken,
  sendCode,
  verifyEmail,
} from './auth.service.js';

export const REFRESH_COOKIE = 'cphos_refresh';

interface JwtPayload {
  sub: string;
  email: string;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** 为某个用户签发访问令牌 */
  const signAccess = (app: FastifyInstance, userId: bigint, email: string | null) =>
    app.jwt.sign({ sub: String(userId), email });

  const setRefreshCookie = (
    reply: { setCookie: (name: string, value: string, opts: object) => void },
    token: string,
  ) => {
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 30 * 86_400,
    });
  };

  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    return reply.code(201).send(result);
  });

  app.post('/send-code', async (req) => {
    const input = sendCodeSchema.parse(req.body);
    return sendCode(input);
  });

  app.post('/verify-email', async (req) => {
    const input = verifyEmailSchema.parse(req.body);
    return verifyEmail(input);
  });

  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { user, refreshToken } = await login(input);
    const accessToken = await signAccess(app, BigInt(user.id), user.email);
    setRefreshCookie(reply, refreshToken);
    const body: AuthResponse = { user, accessToken };
    return body;
  });

  app.post('/refresh', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw Errors.unauthorized();
    const { user, refreshToken } = await rotateRefreshToken(token);
    const accessToken = await signAccess(app, BigInt(user.id), user.email);
    setRefreshCookie(reply, refreshToken);
    const body: AuthResponse = { user, accessToken };
    return body;
  });

  app.post('/logout', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    await logout(token);
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { message: '已退出登录' };
  });

  app.get(
    '/me',
    { onRequest: [app.authenticate] },
    async (req): Promise<AuthResponse['user']> => {
      const payload = req.user as JwtPayload;
      return getUserDto(BigInt(payload.sub));
    },
  );
}
