// 开发种子数据（幂等，可反复执行）：最小字典 + 示例老用户认领参照。
// 用途：让提交资料表单的"学校"下拉、认领候选匹配在本地可跑通。
// 注意：真实字典/参照快照的旧库导入暂缓（P0 不含迁移），此脚本仅保证开发可用。
import { prisma } from '../src/db.js';

// 赛区 id 对齐旧库（见 docs/01）：2=CPHO-S组委会、21=个人 为特殊组织；示例用省份 id 22=湖南、11=北京
const areas: Array<[bigint, string]> = [
  [2n, 'CPHO-S组委会'],
  [21n, '个人'],
  [22n, '湖南'],
  [11n, '北京'],
];

// 134=个人（个人参赛者 uploadLimit 默认 1，见 audit.service INDIVIDUAL_SCHOOL_ID）
const schools: Array<[bigint, string, bigint]> = [
  [134n, '个人', 21n],
  [174n, '组委会', 2n],
  [101n, '示例第一中学', 22n],
  [102n, '示例第二中学', 22n],
  [103n, '示例大学附属中学', 11n],
];

// 示例老用户快照（仅开发联调认领匹配用；真实数据来自后续导入）
const legacyMembers: Array<{
  id: bigint;
  realName: string;
  wechatNickname: string;
  schoolId: bigint;
  auditStatus: number;
  roleType: number;
  defaultTopicId: number;
  uploadLimit: number;
}> = [
  { id: 10001n, realName: '张三', wechatNickname: 'zhangsan_wx', schoolId: 101n, auditStatus: 1, roleType: 1, defaultTopicId: 1, uploadLimit: 100 },
  { id: 10002n, realName: '李四', wechatNickname: 'lisi_wx', schoolId: 101n, auditStatus: 1, roleType: 1, defaultTopicId: 2, uploadLimit: 100 },
  { id: 10003n, realName: '王五', wechatNickname: 'wangwu_wx', schoolId: 134n, auditStatus: 1, roleType: 1, defaultTopicId: 1, uploadLimit: 1 },
];

for (const [id, name] of areas) {
  await prisma.area.upsert({ where: { id }, create: { id, name }, update: { name } });
}

for (const [id, name, areaId] of schools) {
  await prisma.school.upsert({ where: { id }, create: { id, name, areaId }, update: { name, areaId } });
}

for (const m of legacyMembers) {
  await prisma.legacyMemberRef.upsert({
    where: { id: m.id },
    create: {
      id: m.id,
      realName: m.realName,
      wechatNickname: m.wechatNickname,
      schoolId: m.schoolId,
      auditStatus: m.auditStatus,
      roleType: m.roleType,
      defaultTopicId: m.defaultTopicId,
      uploadLimit: m.uploadLimit,
    },
    update: {
      realName: m.realName,
      wechatNickname: m.wechatNickname,
      schoolId: m.schoolId,
      auditStatus: m.auditStatus,
      roleType: m.roleType,
      defaultTopicId: m.defaultTopicId,
      uploadLimit: m.uploadLimit,
    },
  });
}

console.log(`[seed-dev] 已写入 ${areas.length} 赛区、${schools.length} 学校、${legacyMembers.length} 示例参照`);
await prisma.$disconnect();
