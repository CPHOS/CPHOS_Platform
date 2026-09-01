import type { MyRankingListDto, PaperListDto } from '@cphos/shared';
import { http } from './http';

export const resultApi = {
  mine: (params: { q?: string; examId?: string; page?: number; pageSize?: number }) =>
    http.get<PaperListDto>('/results/mine', { params }).then((r) => r.data),

  myRanking: () => http.get<MyRankingListDto>('/results/my-ranking').then((r) => r.data),
};
