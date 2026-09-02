import type {
  AllocationBatchDto,
  AllocationBatchListDto,
  AllocationPreviewDto,
  CreateAllocationInput,
  MarkingTaskListDto,
  RegradeAllocationInput,
} from '@cphos/shared';
import { http } from './http';

export const adminAllocationApi = {
  preview: (examId: string) =>
    http.get<AllocationPreviewDto>('/admin/exams/' + examId + '/allocation/preview').then((r) => r.data),

  allocate: (examId: string, input: CreateAllocationInput) =>
    http.post<AllocationBatchDto>('/admin/exams/' + examId + '/allocation', input).then((r) => r.data),

  batches: (examId: string) =>
    http
      .get<AllocationBatchListDto>('/admin/exams/' + examId + '/allocation/batches', {
        params: { page: 1, pageSize: 20 },
      })
      .then((r) => r.data),

  revoke: (batchId: string) =>
    http.post<AllocationBatchDto>('/admin/allocation/batches/' + batchId + '/revoke', {}).then((r) => r.data),

  regrade: (batchId: string, input: RegradeAllocationInput) =>
    http
      .post<AllocationBatchDto>('/admin/allocation/batches/' + batchId + '/regrade', input)
      .then((r) => r.data),
};

export const tasksApi = {
  listMine: (params: { status?: string; examId?: string; page?: number; pageSize?: number }) =>
    http.get<MarkingTaskListDto>('/tasks/mine', { params }).then((r) => r.data),
};
