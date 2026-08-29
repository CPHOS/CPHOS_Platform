import { ERROR_CODES } from '@cphos/shared';

/** 业务错误：携带稳定错误码，统一由错误处理器转为 { code, message } */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (message: string) => new AppError(400, ERROR_CODES.VALIDATION, message),
  emailTaken: () => new AppError(409, ERROR_CODES.EMAIL_TAKEN, '该邮箱已注册'),
  invalidCredentials: () =>
    new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, '邮箱或密码不正确'),
  emailNotVerified: () =>
    new AppError(403, ERROR_CODES.EMAIL_NOT_VERIFIED, '请先完成邮箱验证'),
  userDisabled: () =>
    new AppError(403, ERROR_CODES.USER_DISABLED, '账号已禁用，请联系管理员'),
  codeInvalid: () => new AppError(400, ERROR_CODES.CODE_INVALID, '验证码不正确'),
  codeExpired: () => new AppError(400, ERROR_CODES.CODE_EXPIRED, '验证码已过期，请重新获取'),
  codeTooManyAttempts: () =>
    new AppError(400, ERROR_CODES.CODE_TOO_MANY_ATTEMPTS, '尝试次数过多，请重新获取验证码'),
  codeRateLimited: () =>
    new AppError(429, ERROR_CODES.CODE_RATE_LIMITED, '发送过于频繁，请稍后再试'),
  unauthorized: () => new AppError(401, ERROR_CODES.UNAUTHORIZED, '请先登录'),
  forbidden: () => new AppError(403, ERROR_CODES.FORBIDDEN, '没有权限执行该操作'),
  notFound: (what = '资源') => new AppError(404, ERROR_CODES.NOT_FOUND, `${what}不存在`),
  applicationExists: () =>
    new AppError(409, ERROR_CODES.APPLICATION_EXISTS, '已有待审核申请，请勿重复提交'),
  applicationNotEditable: () =>
    new AppError(409, ERROR_CODES.APPLICATION_NOT_EDITABLE, '当前申请状态不可修改'),
  alreadyReviewed: () =>
    new AppError(409, ERROR_CODES.ALREADY_REVIEWED, '该申请已审核，不可重复操作'),
  legacyAlreadyClaimed: () =>
    new AppError(409, ERROR_CODES.LEGACY_ALREADY_CLAIMED, '该旧账号已被其他用户认领'),
};
