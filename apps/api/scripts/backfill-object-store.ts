// 将旧 PaperPage（仅 fileKey，无 objectId）回填为 StoredObject 元数据。
// 不移动文件，只补对象元数据并绑定 objectId；文件缺失会跳过并汇总。
// 运行：pnpm --filter @cphos/api object:backfill
import { prisma } from '../src/db.js';
import { computeFileSha256, getObjectFileSize } from '../src/lib/object-store.js';

async function main() {
  const pages = await prisma.paperPage.findMany({
    where: { objectId: null },
    select: { id: true, fileKey: true, mimeType: true },
    orderBy: { id: 'asc' },
  });
  let migrated = 0;
  const missing: string[] = [];
  for (const page of pages) {
    const sizeBytes = getObjectFileSize(page.fileKey);
    if (sizeBytes === null) {
      missing.push(page.fileKey);
      continue;
    }
    const contentHash = await computeFileSha256(page.fileKey);
    await prisma.$transaction(async (tx) => {
      // upsert 保证并发/重复运行幂等，不会因 storagePath 唯一键冲突而中断整批。
      const object = await tx.storedObject.upsert({
        where: { storagePath: page.fileKey },
        update: {},
        create: {
          fileName: page.fileKey.split('/').pop() ?? 'blob.bin',
          mimeType: page.mimeType,
          sizeBytes,
          contentHash,
          storagePath: page.fileKey,
        },
        select: { id: true },
      });
      await tx.paperPage.update({ where: { id: page.id }, data: { objectId: object.id } });
    });
    migrated += 1;
  }
  console.log('[object:backfill] migrated=' + migrated + ' missing=' + missing.length);
  if (missing.length) console.warn('[object:backfill] missing files (not linked):', missing.slice(0, 20));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
