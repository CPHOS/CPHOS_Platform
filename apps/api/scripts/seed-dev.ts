// 开发种子数据（幂等，可反复执行）：最小字典 + 合成老用户认领参照。
// 说明：新系统不导入任何历史数据；这里的赛区/学校/参照均为本地开发联调的合成数据。
// 真实生产字典由管理员在「字典维护」中录入。
import { prisma } from '../src/db.js';

// 赛区（按名称幂等，使用自增 ID）
const areaNames = ['CPHOS组委会', '个人', '示例赛区'];

for (const name of areaNames) {
  await prisma.area.upsert({ where: { name }, create: { name }, update: {} });
}

const personalArea = await prisma.area.findUniqueOrThrow({ where: { name: '个人' } });
const orgArea = await prisma.area.findUniqueOrThrow({ where: { name: 'CPHOS组委会' } });
const sampleArea = await prisma.area.findUniqueOrThrow({ where: { name: '示例赛区' } });

// 学校（名称 + 赛区唯一）
const schoolSeeds: Array<[string, bigint]> = [
  ['个人', personalArea.id],
  ['组委会', orgArea.id],
  ['示例第一中学', sampleArea.id],
  ['示例第二中学', sampleArea.id],
  ['示例大学附属中学', sampleArea.id],
];

for (const [name, areaId] of schoolSeeds) {
  await prisma.school.upsert({
    where: { name_areaId: { name, areaId } },
    create: { name, areaId },
    update: {},
  });
}

// 年级 / 奖项 / 题号（按名称幂等）
const gradeNames = ['初一', '初二', '初三', '高一', '高二', '高三'];
const prizeNames = ['一等奖', '二等奖', '三等奖', '优胜奖'];
const topicNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

for (const name of gradeNames) {
  await prisma.grade.upsert({ where: { name }, create: { name }, update: {} });
}
for (const name of prizeNames) {
  await prisma.prize.upsert({ where: { name }, create: { name }, update: {} });
}
for (const name of topicNames) {
  await prisma.topic.upsert({ where: { name }, create: { name }, update: {} });
}

// 合成认领参照（仅用于本地演示认领候选匹配）
const school1 = await prisma.school.findFirstOrThrow({
  where: { name: '示例第一中学' },
});
const personalSchool = await prisma.school.findFirstOrThrow({ where: { name: '个人' } });

const legacySeeds = [
  { realName: '张三', wechatNickname: 'zhangsan_wx', schoolId: school1.id, uploadLimit: 100 },
  { realName: '李四', wechatNickname: 'lisi_wx', schoolId: school1.id, uploadLimit: 100 },
  { realName: '王五', wechatNickname: 'wangwu_wx', schoolId: personalSchool.id, uploadLimit: 1 },
];

for (const m of legacySeeds) {
  const found = await prisma.legacyMemberRef.findFirst({
    where: { realName: m.realName, wechatNickname: m.wechatNickname },
  });
  const data = {
    realName: m.realName,
    wechatNickname: m.wechatNickname,
    schoolId: m.schoolId,
    auditStatus: 1,
    roleType: 1,
    defaultTopicId: 1,
    uploadLimit: m.uploadLimit,
  };
  if (found) {
    await prisma.legacyMemberRef.update({ where: { id: found.id }, data });
  } else {
    await prisma.legacyMemberRef.create({ data });
  }
}

console.log(
  '[seed-dev] 已写入 ' +
    String(areaNames.length) +
    ' 赛区、' +
    String(schoolSeeds.length) +
    ' 学校、' +
    String(gradeNames.length) +
    ' 年级、' +
    String(prizeNames.length) +
    ' 奖项、' +
    String(topicNames.length) +
    ' 题号、' +
    String(legacySeeds.length) +
    ' 条合成参照',
);
await prisma.$disconnect();
