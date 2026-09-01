// 旧库数据导出（只读 SELECT，不写入旧库）：字典表 + 老用户认领参照快照 → apps/api/.legacy-export/
// 用法：
//   1) 配置连接：在 apps/api/.legacy-db.json 写入 { "host", "port", "user", "password", "database" }
//      （或环境变量 LEGACY_DB_HOST / LEGACY_DB_PORT / LEGACY_DB_USER / LEGACY_DB_PASSWORD / LEGACY_DB_NAME）
//   2) pnpm api:export-legacy
// 产出：
//   cmf_tp_area.json / cmf_tp_school.json / cmf_tp_grade.json / cmf_tp_prize.json / cmf_tp_topic.json
//   cmf_tp_member_snapshot.json（认领参照最小字段）
//   summary.json（行数/抽样/数据质量检查：重名学校、悬空赛区引用、成员分布）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', '.legacy-export');

function loadConfig() {
  const file = path.resolve(__dirname, '..', '.legacy-db.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return {
    host: process.env.LEGACY_DB_HOST,
    port: Number(process.env.LEGACY_DB_PORT ?? 3306),
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
  };
}

const cfg = loadConfig();
if (!cfg.host || !cfg.user || !cfg.database) {
  console.error(
    '[export-legacy] 缺少旧库连接信息。请在 apps/api/.legacy-db.json 配置 ' +
      '{ "host", "port", "user", "password", "database" }（该文件已 gitignore）。',
  );
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: cfg.host,
  port: cfg.port ?? 3306,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  charset: 'utf8mb4',
  // 建议使用只读账号；此处仅做 SELECT，绝不写入
});

fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJson(name, data) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2));
}

const sample = (rows, n = 3) => rows.slice(0, n);

const summary = { exportedAt: new Date().toISOString(), tables: {}, checks: {} };

// 1) 字典表：全量导出（保留原列名，导入时再映射）
for (const t of ['cmf_tp_area', 'cmf_tp_school', 'cmf_tp_grade', 'cmf_tp_prize', 'cmf_tp_topic']) {
  const [rows] = await conn.query(`SELECT * FROM \`${t}\` ORDER BY 1`);
  writeJson(`${t}.json`, rows);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  summary.tables[t] = { rows: rows.length, columns, sample: sample(rows) };
}

// 2) 老用户认领参照快照（最小字段，不含 openid）
const [members] = await conn.query(`
  SELECT id,
         user_name AS realName,
         nickname AS wechatNickname,
         avatar AS wechatAvatar,
         CAST(school_id AS UNSIGNED) AS schoolId,
         status AS auditStatus,
         type AS roleType,
         subject AS defaultTopicId,
         \`limit\` AS uploadLimit,
         FROM_UNIXTIME(create_time) AS createdAt
  FROM cmf_tp_member
  ORDER BY id
`);
writeJson('cmf_tp_member_snapshot.json', members);
summary.tables.cmf_tp_member = { rows: members.length, sample: sample(members) };

// 3) 数据质量检查（供人工检查）
const [dupSchools] = await conn.query(`
  SELECT school_name, COUNT(*) c FROM cmf_tp_school GROUP BY school_name HAVING COUNT(*) > 1 ORDER BY c DESC
`);
const [danglingArea] = await conn.query(`
  SELECT COUNT(*) c FROM cmf_tp_school s LEFT JOIN cmf_tp_area a ON CAST(s.area AS UNSIGNED) = a.id
  WHERE a.id IS NULL
`);
const [memberByStatus] = await conn.query('SELECT status, COUNT(*) c FROM cmf_tp_member GROUP BY status');
const [memberByType] = await conn.query('SELECT type, COUNT(*) c FROM cmf_tp_member GROUP BY type');
summary.checks = {
  duplicateSchoolNames: { count: dupSchools.length, groups: sample(dupSchools, 10) },
  schoolsWithDanglingArea: Number(danglingArea[0]?.c ?? 0),
  membersByStatus: memberByStatus,
  membersByType: memberByType,
};

writeJson('summary.json', summary);
await conn.end();

console.log('================ 旧库导出完成 ================');
for (const [t, info] of Object.entries(summary.tables)) {
  console.log(`- ${t}: ${info.rows} 行${info.columns ? `，列: [${info.columns.join(', ')}]` : ''}`);
}
console.log('\n---- 数据质量检查 ----');
console.log(`重名学校组数: ${summary.checks.duplicateSchoolNames.count}`);
if (summary.checks.duplicateSchoolNames.count > 0) {
  console.log('  示例:', summary.checks.duplicateSchoolNames.groups.map((g) => `${g.school_name}×${g.c}`).join('；'));
}
console.log(`悬空赛区引用的学校数: ${summary.checks.schoolsWithDanglingArea}`);
console.log('成员按审核状态:', summary.checks.membersByStatus.map((r) => `status=${r.status}:${r.c}`).join(' '));
console.log('成员按角色类型:', summary.checks.membersByType.map((r) => `type=${r.type}:${r.c}`).join(' '));
console.log(`\n文件目录: ${OUT_DIR}`);
console.log('请人工检查 summary.json 与各表 JSON，确认无误后再执行导入。');
