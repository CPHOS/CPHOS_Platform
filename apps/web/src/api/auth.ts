import type { AuthResponse, MessageResponse, UserDto } from '@cphos/shared';
import { http } from './http';

export const authApi = {
  register: (input: { email: string; password: string }) =>
    http.post<MessageResponse>('/auth/register', input).then((r) => r.data),

  sendCode: (input: { email: string; purpose: 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_EMAIL' }) =>
    http.post<MessageResponse>('/auth/send-code', input).then((r) => r.data),

  verifyEmail: (input: { email: string; code: string }) =>
    http.post<MessageResponse>('/auth/verify-email', input).then((r) => r.data),

  login: (input: { account: string; password: string }) =>
    http.post<AuthResponse>('/auth/login', input, { withCredentials: true }).then((r) => r.data),

  logout: () => http.post<MessageResponse>('/auth/logout', {}, { withCredentials: true }),

  me: () => http.get<UserDto>('/auth/me').then((r) => r.data),

  forgotPassword: (input: { email: string }) =>
    http.post<MessageResponse>('/auth/password/forgot', input).then((r) => r.data),

  resetPassword: (input: { email: string; code: string; newPassword: string }) =>
    http.post<MessageResponse>('/auth/password/reset', input).then((r) => r.data),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    http.post<MessageResponse>('/auth/password/change', input).then((r) => r.data),

  requestEmailChange: (input: { newEmail: string; currentPassword: string }) =>
    http.post<MessageResponse>('/auth/email/change/request', input).then((r) => r.data),

  confirmEmailChange: (input: { newEmail: string; code: string }) =>
    http.post<UserDto>('/auth/email/change/confirm', input).then((r) => r.data),
};
