import { describe, expect, it } from 'vitest';
import { assertDisposableDatabase } from '../scripts/e2e-db-guard.js';

const EMBEDDED = 'postgresql://cphos:cphos@127.0.0.1:54329/cphos';

describe('E2E 清库防误伤', () => {
  it('允许本仓库内嵌测试库', () => {
    expect(() => assertDisposableDatabase(EMBEDDED, 'test')).not.toThrow();
  });

  it('允许库名显式包含 e2e 的连接', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://user:pass@db.example.com:5432/cphos_e2e', 'development'),
    ).not.toThrow();
  });

  it('拒绝生产环境', () => {
    expect(() => assertDisposableDatabase(EMBEDDED, 'production')).toThrow(/production/);
  });

  it('拒绝非本地且库名不含测试标识的连接', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://user:pass@db.example.com:5432/cphos', 'development'),
    ).toThrow(/拒绝/);
  });

  it('拒绝非 PostgreSQL 连接串', () => {
    expect(() => assertDisposableDatabase('file:./dev.db', 'development')).toThrow();
  });
});
