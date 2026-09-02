/** 仲裁利益冲突纯策略（便于单测）：返回 true 表示操作者不适合仲裁该题。 */
export interface ArbitrationConflictContext {
  operatorId: bigint;
  operatorTeamId: bigint | null;
  operatorSchoolId: bigint | null;
  uploaderUserId: bigint;
  uploaderTeamId: bigint | null;
  studentOwnerUserId: bigint | null;
  studentOwnerTeamId: bigint | null;
  reviewerUserIds: bigint[];
  reviewerTeamIds: (bigint | null)[];
  reviewerSchoolIds: (bigint | null)[];
}

function has<T>(list: T[], value: T | null | undefined): boolean {
  return value !== null && value !== undefined && list.includes(value);
}

export function hasArbitrationConflict(ctx: ArbitrationConflictContext): boolean {
  // 1. 本人上传/本人学生
  if (ctx.operatorId === ctx.uploaderUserId) return true;
  if (ctx.studentOwnerUserId !== null && ctx.operatorId === ctx.studentOwnerUserId) return true;
  // 2. 曾是本题阅卷人
  if (has(ctx.reviewerUserIds, ctx.operatorId)) return true;
  // 3. 同团队或同学校
  if (ctx.operatorTeamId !== null) {
    if (ctx.uploaderTeamId === ctx.operatorTeamId) return true;
    if (ctx.studentOwnerTeamId === ctx.operatorTeamId) return true;
    if (has(ctx.reviewerTeamIds, ctx.operatorTeamId)) return true;
  }
  if (ctx.operatorSchoolId !== null) {
    if (has(ctx.reviewerSchoolIds, ctx.operatorSchoolId)) return true;
  }
  return false;
}
