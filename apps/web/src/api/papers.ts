import type {
  BindQuestionImageInput,
  CreatePaperInput,
  ExamListDto,
  PaperDto,
  PaperListDto,
  SetPaperStatusInput,
} from '@cphos/shared';
import { http } from './http';

export const paperApi = {
  publishedExams: () =>
    http.get<ExamListDto>('/exams/published', { params: { pageSize: 100 } }).then((x) => x.data),

  listMine: (params: { examId?: string; status?: string; q?: string; page?: number; pageSize?: number }) =>
    http.get<PaperListDto>('/papers/mine', { params }).then((x) => x.data),

  get: (id: string) => http.get<PaperDto>('/papers/' + id).then((x) => x.data),

  create: (input: CreatePaperInput) =>
    http.post<PaperDto>('/papers', input).then((x) => x.data),

  uploadPage: (paperId: string, pageNo: number, file: File) => {
    const form = new FormData();
    form.append('pageNo', String(pageNo));
    form.append('file', file);
    return http
      .post<PaperDto>('/papers/' + paperId + '/pages/upload', form)
      .then((x) => x.data);
  },

  pageImage: (paperId: string, pageId: string) =>
    http
      .get<Blob>('/papers/' + paperId + '/pages/' + pageId + '/file', { responseType: 'blob' })
      .then((x) => x.data),

  bindImage: (paperId: string, input: BindQuestionImageInput) =>
    http.post<PaperDto>('/papers/' + paperId + '/images', input).then((x) => x.data),

  removeImage: (paperId: string, input: { paperQuestionId: string; paperPageId: string; partIndex: number }) =>
    http
      .delete<PaperDto>('/papers/' + paperId + '/images', { data: input })
      .then((x) => x.data),

  setStatus: (paperId: string, input: SetPaperStatusInput) =>
    http.post<PaperDto>('/papers/' + paperId + '/status', input).then((x) => x.data),
};
