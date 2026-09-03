import type {
  AreaDto,
  DictBundleDto,
  NameDictDto,
  SchoolDto,
} from '@cphos/shared';
import { http } from './http';

export const dictApi = {
  schools: () => http.get<SchoolDto[]>('/dict/schools').then((r) => r.data),
  all: () => http.get<DictBundleDto>('/dict/all').then((r) => r.data),
};

export const adminDictApi = {
  get: () => http.get<DictBundleDto>('/admin/dict').then((r) => r.data),

  createArea: (name: string) =>
    http.post<AreaDto>('/admin/dict/areas', { name }).then((r) => r.data),
  updateArea: (id: string, name: string) =>
    http.patch<AreaDto>('/admin/dict/areas/' + id, { name }).then((r) => r.data),
  deleteArea: (id: string) => http.delete('/admin/dict/areas/' + id),

  createSchool: (input: { name: string; areaId: string }) =>
    http.post<SchoolDto>('/admin/dict/schools', input).then((r) => r.data),
  updateSchool: (id: string, input: { name?: string; areaId?: string }) =>
    http.patch<SchoolDto>('/admin/dict/schools/' + id, input).then((r) => r.data),
  deleteSchool: (id: string) => http.delete('/admin/dict/schools/' + id),

  createGrade: (name: string) =>
    http.post<NameDictDto>('/admin/dict/grades', { name }).then((r) => r.data),
  updateGrade: (id: string, name: string) =>
    http.patch<NameDictDto>('/admin/dict/grades/' + id, { name }).then((r) => r.data),
  deleteGrade: (id: string) => http.delete('/admin/dict/grades/' + id),

  createPrize: (name: string) =>
    http.post<NameDictDto>('/admin/dict/prizes', { name }).then((r) => r.data),
  updatePrize: (id: string, name: string) =>
    http.patch<NameDictDto>('/admin/dict/prizes/' + id, { name }).then((r) => r.data),
  deletePrize: (id: string) => http.delete('/admin/dict/prizes/' + id),

};
