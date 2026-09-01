import type {
  CreateSubAccountInput,
  TeamDetailDto,
  TeamListDto,
  UpdateTeamInput,
} from '@cphos/shared';
import { http } from './http';

export const adminTeamsApi = {
  list: (params: { q?: string; page?: number; pageSize?: number }) =>
    http.get<TeamListDto>('/admin/teams', { params }).then((r) => r.data),

  get: (id: string) => http.get<TeamDetailDto>(`/admin/teams/${id}`).then((r) => r.data),

  update: (id: string, input: UpdateTeamInput) =>
    http.patch<TeamDetailDto>(`/admin/teams/${id}`, input).then((r) => r.data),

  addMember: (id: string, input: CreateSubAccountInput) =>
    http.post<TeamDetailDto>(`/admin/teams/${id}/members`, input).then((r) => r.data),

  removeMember: (id: string, userId: string) =>
    http.delete<TeamDetailDto>(`/admin/teams/${id}/members/${userId}`).then((r) => r.data),
};
