import type {
  CreateStudentInput,
  StudentDto,
  StudentListDto,
  UpdateStudentInput,
} from '@cphos/shared';
import { http } from './http';

export const studentApi = {
  listMine: (params: { q?: string; schoolId?: string; gradeId?: string; prizeId?: string; page?: number; pageSize?: number }) =>
    http.get<StudentListDto>('/students/mine', { params }).then((x) => x.data),

  create: (input: CreateStudentInput) =>
    http.post<StudentDto>('/students', input).then((x) => x.data),

  update: (id: string, input: UpdateStudentInput) =>
    http.patch<StudentDto>('/students/' + id, input).then((x) => x.data),

  remove: (id: string) => http.delete('/students/' + id),
};

export const adminStudentsApi = {
  list: (params: { q?: string; schoolId?: string; gradeId?: string; prizeId?: string; page?: number; pageSize?: number }) =>
    http.get<StudentListDto>('/admin/students', { params }).then((x) => x.data),
};
