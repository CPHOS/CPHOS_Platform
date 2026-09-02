import { describe, expect, it } from 'vitest';
import { hasArbitrationConflict, type ArbitrationConflictContext } from '../src/modules/marking/arbitration-policy.js';

function ctx(overrides: Partial<ArbitrationConflictContext> = {}): ArbitrationConflictContext {
  return {
    operatorId: 10n,
    operatorTeamId: null,
    operatorSchoolId: null,
    uploaderUserId: 1n,
    uploaderTeamId: null,
    studentOwnerUserId: 2n,
    studentOwnerTeamId: null,
    reviewerUserIds: [3n, 4n],
    reviewerTeamIds: [null, null],
    reviewerSchoolIds: [null, null],
    ...overrides,
  };
}

describe('arbitration conflict policy', () => {
  it('allows neutral internal member', () => {
    expect(hasArbitrationConflict(ctx())).toBe(false);
  });

  it('rejects original reviewer', () => {
    expect(hasArbitrationConflict(ctx({ operatorId: 3n }))).toBe(true);
  });

  it('rejects uploader or student owner', () => {
    expect(hasArbitrationConflict(ctx({ operatorId: 1n }))).toBe(true);
    expect(hasArbitrationConflict(ctx({ operatorId: 2n }))).toBe(true);
  });

  it('rejects same team or school', () => {
    expect(hasArbitrationConflict(ctx({ operatorTeamId: 7n, uploaderTeamId: 7n }))).toBe(true);
    expect(hasArbitrationConflict(ctx({ operatorSchoolId: 9n, reviewerSchoolIds: [9n, null] }))).toBe(true);
  });
});
