import type {
  CreateTeamInput,
  TeamDto,
  TeamListDto,
  UpdateTeamInput,
} from '@cphos/shared';
import { http } from './http';

export const adminTeamsApi = {
  list: (params: { q?: string; page?: number; pageSize?: number }) =>
    http.get<TeamListDto>('/admin/teams', { params }).then((r) => r.data),

  get: (id: string) => http.get<TeamDto>('/admin/teams/' + id).then((r) => r.data),

  create: (input: CreateTeamInput) =>
    http.post<TeamDto>('/admin/teams', input).then((r) => r.data),

  update: (id: string, input: UpdateTeamInput) =>
    http.patch<TeamDto>('/admin/teams/' + id, input).then((r) => r.data),

  addMembers: (id: string, userIds: string[]) =>
    http.post<TeamDto>('/admin/teams/' + id + '/members', { userIds }).then((r) => r.data),

  removeMembers: (id: string, userIds: string[]) =>
    http.delete<TeamDto>('/admin/teams/' + id + '/members', { data: { userIds } }).then((r) => r.data),

  remove: (id: string) => http.delete('/admin/teams/' + id),
};
