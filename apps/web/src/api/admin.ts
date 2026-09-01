import type {
  AuditApplicationDto,
  AuditApplicationListDto,
  AuditLogListDto,
  LegacyMemberCandidateDto,
  ReviewDecisionInput,
} from '@cphos/shared';
import { http } from './http';

export interface ListApplicationsParams {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const adminAuditApi = {
  list: (params: ListApplicationsParams) =>
    http.get<AuditApplicationListDto>('/admin/audit/applications', { params }).then((r) => r.data),

  get: (id: string) =>
    http.get<AuditApplicationDto>(`/admin/audit/applications/${id}`).then((r) => r.data),

  candidates: (id: string) =>
    http.get<LegacyMemberCandidateDto[]>(`/admin/audit/applications/${id}/candidates`).then(
      (r) => r.data,
    ),

  review: (id: string, input: ReviewDecisionInput) =>
    http.post<AuditApplicationDto>(`/admin/audit/applications/${id}/review`, input).then((r) => r.data),

  logs: (params: {
    applicationId?: string;
    action?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) => http.get<AuditLogListDto>('/admin/audit/logs', { params }).then((r) => r.data),
};
