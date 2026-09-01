import type {
  ArbitrationListDto,
  BotCreatedDto,
  CreateBotInput,
  GradeArbitrationInput,
  GradeMarkingTaskInput,
  MessageResponse,
} from '@cphos/shared';
import { http } from './http';

export const markingApi = {
  gradeTask: (taskId: string, input: GradeMarkingTaskInput) =>
    http.post<MessageResponse>('/tasks/' + taskId + '/grade', input).then((r) => r.data),
};

export const arbitrationApi = {
  list: (params: { status?: string; page?: number; pageSize?: number }) =>
    http.get<ArbitrationListDto>('/arbitration/tasks', { params }).then((r) => r.data),

  claim: (id: string) =>
    http.post<MessageResponse>('/arbitration/tasks/' + id + '/claim', {}).then((r) => r.data),

  grade: (id: string, input: GradeArbitrationInput) =>
    http.post<MessageResponse>('/arbitration/tasks/' + id + '/grade', input).then((r) => r.data),
};

export const botApi = {
  create: (input: CreateBotInput) =>
    http.post<BotCreatedDto>('/admin/accounts/bots', input).then((r) => r.data),

  rotate: (id: string) =>
    http.post<BotCreatedDto>('/admin/accounts/' + id + '/bot-token', {}).then((r) => r.data),
};
