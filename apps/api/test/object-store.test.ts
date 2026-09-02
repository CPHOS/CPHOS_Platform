import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  computeFileSha256,
  computeSha256,
  getObjectFileSize,
  objectAbsolutePath,
  putObjectBytes,
  removeObjectFile,
} from '../src/lib/object-store.js';

describe('filesystem object store', () => {
  it('computes stable sha256 hex', () => {
    expect(computeSha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rejects path traversal in storage path', () => {
    expect(() => objectAbsolutePath('../../.env')).toThrow();
    expect(() => objectAbsolutePath('C:/Windows/win.ini')).toThrow();
  });

  it('writes bytes then streams hash/size and removes the file', async () => {
    const storagePath = 'papers/test-object-store/' + randomUUID() + '.bin';
    const bytes = Buffer.from('abc');
    const stored = await putObjectBytes(storagePath, bytes);
    expect(stored).toEqual({
      sizeBytes: 3,
      contentHash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    expect(getObjectFileSize(storagePath)).toBe(3);
    expect(await computeFileSha256(storagePath)).toBe(stored.contentHash);
    expect(await readFile(objectAbsolutePath(storagePath))).toEqual(bytes);
    await removeObjectFile(storagePath);
    expect(getObjectFileSize(storagePath)).toBeNull();
  });
});
