import type {
  AccountDto,
  AccountListDto,
  CreateInternalInput,
  MemberDto,
  MemberListDto,
  UpdateMemberInput,
} from '@cphos/shared';
import { http } from './http';

export const adminMembersApi = {
  list: (params: { role?: string; q?: string; page?: number; pageSize?: number }) =>
    http.get<MemberListDto>('/admin/members', { params }).then((r) => r.data),

  get: (userId: string) => http.get<MemberDto>(`/admin/members/${userId}`).then((r) => r.data),

  update: (userId: string, input: UpdateMemberInput) =>
    http.patch<MemberDto>(`/admin/members/${userId}`, input).then((r) => r.data),
};

export const adminAccountsApi = {
  list: (params: { role?: string; status?: string; q?: string; page?: number; pageSize?: number }) =>
    http.get<AccountListDto>('/admin/accounts', { params }).then((r) => r.data),

  create: (input: CreateInternalInput) =>
    http.post<AccountDto>('/admin/accounts', input).then((r) => r.data),

  setRole: (id: string, role: 'ADMIN' | 'CPHOS_MEMBER') =>
    http.post<AccountDto>(`/admin/accounts/${id}/role`, { role }).then((r) => r.data),

  setStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    http.post<AccountDto>(`/admin/accounts/${id}/status`, { status }).then((r) => r.data),
};
