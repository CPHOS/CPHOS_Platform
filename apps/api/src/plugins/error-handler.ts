import { ZodError } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';
import { ERROR_CODES } from '@cphos/shared';

/** 统一错误处理：业务错误 → { code, message }；Zod 校验错误 → VALIDATION */
export function installErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (err: Error, req: FastifyRequest, reply: FastifyReply) => {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err instanceof ZodError) {
        return reply.code(400).send({
          code: ERROR_CODES.VALIDATION,
          message: err.issues.map((i) => i.message).join('；'),
        });
      }
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 429) {
        return reply.code(429).send({ code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' });
      }
      req.log.error(err);
      return reply.code(500).send({ code: ERROR_CODES.INTERNAL, message: '服务器内部错误' });
    },
  );
}
