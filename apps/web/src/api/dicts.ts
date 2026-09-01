import type {
  AreaDto,
  CreateSchoolInput,
  DictEntryDto,
  DictKind,
  ManagedSchoolDto,
  ManagedSchoolListDto,
  UpdateSchoolInput,
} from '@cphos/shared';
import { http } from './http';

export const adminDictApi = {
  // 赛区
  areas: () => http.get<AreaDto[]>('/admin/areas').then((r) => r.data),
  createArea: (name: string) => http.post<AreaDto>('/admin/areas', { name }).then((r) => r.data),
  renameArea: (id: string, name: string) =>
    http.patch<AreaDto>(`/admin/areas/${id}`, { name }).then((r) => r.data),
  deleteArea: (id: string) => http.delete(`/admin/areas/${id}`).then((r) => r.data),

  // 学校
  schools: (params: { areaId?: string; q?: string; page?: number; pageSize?: number }) =>
    http.get<ManagedSchoolListDto>('/admin/schools', { params }).then((r) => r.data),
  createSchool: (input: CreateSchoolInput) =>
    http.post<ManagedSchoolDto>('/admin/schools', input).then((r) => r.data),
  updateSchool: (id: string, input: UpdateSchoolInput) =>
    http.patch<ManagedSchoolDto>(`/admin/schools/${id}`, input).then((r) => r.data),
  deleteSchool: (id: string) => http.delete(`/admin/schools/${id}`).then((r) => r.data),

  // 简单字典（年级/奖项/题号）
  dicts: (kind: DictKind) => http.get<DictEntryDto[]>(`/admin/dicts/${kind}`).then((r) => r.data),
  createDict: (kind: DictKind, name: string) =>
    http.post<DictEntryDto>(`/admin/dicts/${kind}`, { name }).then((r) => r.data),
  renameDict: (kind: DictKind, id: string, name: string) =>
    http.patch<DictEntryDto>(`/admin/dicts/${kind}/${id}`, { name }).then((r) => r.data),
  deleteDict: (kind: DictKind, id: string) =>
    http.delete(`/admin/dicts/${kind}/${id}`).then((r) => r.data),
};
