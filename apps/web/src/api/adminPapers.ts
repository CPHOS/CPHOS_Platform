import type { PaperListDto, SetPaperReviewCountInput } from '@cphos/shared';
import { http } from './http';

export const adminPapersApi = {
  list: (params: { q?: string; examId?: string; status?: string; page?: number; pageSize?: number }) =>
    http.get<PaperListDto>('/admin/papers', { params }).then((x) => x.data),

  setReviewCount: (paperId: string, input: SetPaperReviewCountInput) =>
    http
      .patch<import('@cphos/shared').PaperDto>('/admin/papers/' + paperId + '/review-count', input)
      .then((x) => x.data),
};
