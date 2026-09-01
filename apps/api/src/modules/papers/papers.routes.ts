import type { FastifyInstance } from 'fastify';
import {
  addPaperPageSchema,
  bindQuestionImageSchema,
  createPaperSchema,
  idSchema,
  listPapersQuerySchema,
  removeQuestionImageSchema,
  setPaperStatusSchema,
} from '@cphos/shared';
import { Errors } from '../../lib/errors.js';
import {
  addPaperPage,
  bindQuestionImage,
  createPaper,
  getMyPaper,
  getPaperPageStream,
  listMyPapers,
  removeQuestionImage,
  setPaperStatus,
  uploadPaperPage,
} from './papers.service.js';

/** 平台用户：本人整卷与逐题图片 */
export async function paperRoutes(app: FastifyInstance): Promise<void> {
  const guard = [app.authenticate, app.requireActivePlatformUser];

  app.get('/papers/mine', { onRequest: guard }, async (req) => {
    return listMyPapers(BigInt(req.user.sub), listPapersQuerySchema.parse(req.query));
  });

  app.get('/papers/:id', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return getMyPaper(BigInt(req.user.sub), BigInt(idSchema.parse(id)));
  });

  app.post('/papers', { onRequest: guard }, async (req, reply) => {
    const paper = await createPaper(BigInt(req.user.sub), createPaperSchema.parse(req.body));
    return reply.code(201).send(paper);
  });

  app.post('/papers/:id/pages', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return addPaperPage(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      addPaperPageSchema.parse(req.body),
    );
  });

  app.post(
    '/papers/:id/pages/upload',
    { onRequest: guard, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
    const { id } = req.params as { id: string };
    const file = await req.file();
    if (!file) throw Errors.validation('请选择答题卡文件');
    const pageField = file.fields.pageNo as { value?: unknown } | undefined;
    const pageNo = Number(pageField?.value);
    if (!Number.isInteger(pageNo) || pageNo < 1) {
      throw Errors.validation('请提供有效的页码');
    }
    const buffer = await file.toBuffer();
    return uploadPaperPage(BigInt(req.user.sub), BigInt(idSchema.parse(id)), {
      pageNo,
      buffer,
      mimeType: file.mimetype,
      originalName: file.filename,
      sizeBytes: buffer.length,
    });
    },
  );

  app.get('/papers/:id/pages/:pageId/file', { onRequest: guard }, async (req, reply) => {
    const { id, pageId } = req.params as { id: string; pageId: string };
    const file = await getPaperPageStream(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      BigInt(idSchema.parse(pageId)),
    );
    reply.type(file.mimeType);
    return reply.send(file.stream);
  });

  app.post('/papers/:id/images', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return bindQuestionImage(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      bindQuestionImageSchema.parse(req.body),
    );
  });

  app.delete('/papers/:id/images', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return removeQuestionImage(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      removeQuestionImageSchema.parse(req.body),
    );
  });

  app.post('/papers/:id/status', { onRequest: guard }, async (req) => {
    const { id } = req.params as { id: string };
    return setPaperStatus(
      BigInt(req.user.sub),
      BigInt(idSchema.parse(id)),
      setPaperStatusSchema.parse(req.body),
    );
  });
}
