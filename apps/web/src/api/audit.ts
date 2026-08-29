import type { AuditApplicationDto, SubmitApplicationInput } from '@cphos/shared';
import { http } from './http';

export const auditApi = {
  submit: (input: SubmitApplicationInput) =>
    http.post<AuditApplicationDto>('/audit/applications', input).then((r) => r.data),

  getMine: () =>
    http.get<AuditApplicationDto | null>('/audit/applications/me').then((r) => r.data),

  update: (input: SubmitApplicationInput) =>
    http.put<AuditApplicationDto>('/audit/applications/me', input).then((r) => r.data),
};
