import type {
  CreateExamInput,
  ExamDto,
  ExamListDto,
  UpdateExamInput,
  UpsertExamConfigInput,
} from '@cphos/shared';
import { http } from './http';

export const adminExamsApi = {
  list: (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
    http.get<ExamListDto>('/admin/exams', { params }).then((x) => x.data),

  get: (id: string) => http.get<ExamDto>('/admin/exams/' + id).then((x) => x.data),

  create: (input: CreateExamInput) =>
    http.post<ExamDto>('/admin/exams', input).then((x) => x.data),

  update: (id: string, input: UpdateExamInput) =>
    http.patch<ExamDto>('/admin/exams/' + id, input).then((x) => x.data),

  upsertConfig: (id: string, input: UpsertExamConfigInput) =>
    http.put<ExamDto>('/admin/exams/' + id + '/config', input).then((x) => x.data),

  publish: (id: string) =>
    http.post<ExamDto>('/admin/exams/' + id + '/publish', {}).then((x) => x.data),

  close: (id: string) =>
    http.post<ExamDto>('/admin/exams/' + id + '/close', {}).then((x) => x.data),

  archive: (id: string) =>
    http.post<ExamDto>('/admin/exams/' + id + '/archive', {}).then((x) => x.data),

  remove: (id: string) => http.delete('/admin/exams/' + id),
};
