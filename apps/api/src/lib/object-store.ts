import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { Errors } from './errors.js';

/**
 * 文件系统对象存储（对齐 Question_DB）：
 * - 文件先落盘，再写 StoredObject 元数据
 * - contentHash = SHA-256
 * - storagePath 为相对 UPLOAD_DIR 的受控路径
 * - 未来可在这一层替换为 S3/MinIO adapter
 */

export function objectAbsolutePath(storagePath: string): string {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const absolute = path.resolve(uploadRoot, storagePath);
  const relative = path.relative(uploadRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw Errors.validation('对象存储路径非法');
  }
  return absolute;
}

export function computeSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** 流式计算已落盘对象的 SHA-256，避免大文件整块读入内存。 */
export async function computeFileSha256(storagePath: string): Promise<string> {
  const absolute = objectAbsolutePath(storagePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) throw Errors.notFound('文件');
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolute);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** 返回已落盘文件大小；不存在或不是普通文件时返回 null。 */
export function getObjectFileSize(storagePath: string): number | null {
  const absolute = objectAbsolutePath(storagePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  return statSync(absolute).size;
}

export async function putObjectBytes(
  storagePath: string,
  bytes: Buffer,
): Promise<{ sizeBytes: number; contentHash: string }> {
  const absolute = objectAbsolutePath(storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, bytes);
  return { sizeBytes: bytes.length, contentHash: computeSha256(bytes) };
}

export async function removeObjectFile(storagePath: string): Promise<void> {
  const absolute = objectAbsolutePath(storagePath);
  await fs.unlink(absolute).catch(() => undefined);
}

export function openObjectStream(storagePath: string, mimeType: string | null): {
  stream: NodeJS.ReadableStream;
  mimeType: string;
} {
  const absolute = objectAbsolutePath(storagePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) throw Errors.notFound('文件');
  const safeMime = mimeType && mimeType !== 'application/octet-stream' ? mimeType : 'application/octet-stream';
  return { stream: createReadStream(absolute), mimeType: safeMime };
}

export async function createStoredObject(
  tx: Prisma.TransactionClient,
  input: {
    fileName: string;
    mimeType: string | null;
    sizeBytes: number;
    contentHash: string;
    storagePath: string;
  },
): Promise<{ id: string }> {
  return tx.storedObject.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentHash: input.contentHash,
      storagePath: input.storagePath,
    },
    select: { id: true },
  });
}
