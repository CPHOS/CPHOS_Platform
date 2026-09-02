import { describe, expect, it } from 'vitest';
import { computeSha256, objectAbsolutePath } from '../src/lib/object-store.js';

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
});
