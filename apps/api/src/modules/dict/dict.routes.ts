import type { FastifyInstance } from 'fastify';
import type { DictBundleDto, SchoolDto } from '@cphos/shared';
import { getDictBundle, listSchools } from './dict.service.js';

/** 字典只读接口：学校下拉 + 全量字典（登录用户可读） */
export async function dictRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate];

  app.get('/schools', { onRequest: guard }, async (): Promise<SchoolDto[]> => {
    return listSchools();
  });

  app.get('/all', { onRequest: guard }, async (): Promise<DictBundleDto> => {
    return getDictBundle();
  });
}
