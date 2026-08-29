import type { SchoolDto } from '@cphos/shared';
import { http } from './http';

export const dictApi = {
  schools: () => http.get<SchoolDto[]>('/dict/schools').then((r) => r.data),
};
