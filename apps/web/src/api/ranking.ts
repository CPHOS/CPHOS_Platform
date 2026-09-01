import type { RankingDto } from '@cphos/shared';
import { http } from './http';

export const rankingApi = {
  get: (examId: string, segments?: number[]) =>
    http
      .get<RankingDto>('/admin/exams/' + examId + '/ranking', {
        params: { segments: segments?.join(',') },
      })
      .then((r) => r.data),

  export: (examId: string, format: 'csv' | 'xlsx') =>
    http
      .get<Blob>('/admin/exams/' + examId + '/ranking/export', {
        params: { format },
        responseType: 'blob',
      })
      .then((r) => {
        const disposition = String(r.headers['content-disposition'] ?? '');
        const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
        const filename = match && match[1] ? decodeURIComponent(match[1]) : '成绩排名.' + format;
        return { blob: r.data, filename };
      }),
};
