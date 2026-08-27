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

  logout: () => http.post<MessageResponse>('/auth/logout', null, { withCredentials: true }),

  me: () => http.get<UserDto>('/auth/me').then((r) => r.data),
};
