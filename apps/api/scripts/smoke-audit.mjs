// 审核认领链路冒烟测试（Node fetch，独立于前端）
// 前置：dev-db 运行、migrate、seed:dev、已创建 admin（如 pnpm api:create-internal -- admin ... ADMIN）
// 覆盖：注册→验证→登录→提交资料→管理员列表/候选→认领通过→状态 ACTIVE；
//       重复认领 409；个人参赛者上传上限=1。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:3001/api';
const ADMIN_ACCOUNT = 'admin';
const ADMIN_PASSWORD = 'admin888';
const PASSWORD = '12312312';
const DEVMAIL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.devmail');

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`✓ ${label}`);
}

const post = (pathname, body, token) =>
  fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

const get = (pathname, token) =>
  fetch(`${BASE}${pathname}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

async function login(account, password) {
  const res = await post('/auth/login', { account, password });
  const body = await res.json();
  assert(res.status === 200, `login ${account} → 200 (got ${res.status})`);
  return { token: body.accessToken, user: body.user };
}

function readLatestCode() {
  const files = fs.readdirSync(DEVMAIL).filter((f) => f.endsWith('.json')).sort();
  const latest = files[files.length - 1];
  const content = JSON.parse(fs.readFileSync(path.join(DEVMAIL, latest), 'utf8'));
  const m = content.text.match(/(\d{6})/);
  return m ? m[1] : null;
}

const countDevmail = () => {
  try {
    return fs.readdirSync(DEVMAIL).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
};

async function registerUser(email, realName, wechatNickname, schoolId) {
  const before = countDevmail();

  const reg = await post('/auth/register', { email, password: PASSWORD });
  assert(reg.status === 201, `register ${email} → 201 (got ${reg.status})`);

  // 等待 devmail 落盘并读取验证码
  let code = null;
  for (let i = 0; i < 20 && !code; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (countDevmail() > before) code = readLatestCode();
  }
  assert(!!code, '从 devmail 读取到验证码');

  const verify = await post('/auth/verify-email', { email, code });
  assert(verify.status === 200, `verify-email → 200 (got ${verify.status})`);

  const { token } = await login(email, PASSWORD);

  const submit = await post(
    '/audit/applications',
    { realName, schoolId, wechatNickname, contact: '13800000000', claimLegacy: true },
    token,
  );
  assert(submit.status === 201, `submit application → 201 (got ${submit.status})`);
  const app = await submit.json();
  return { token, email, appId: app.id };
}

// ---- 主流程 ----
console.log('\n== 1) 管理员登录 ==');
const admin = await login(ADMIN_ACCOUNT, ADMIN_PASSWORD);
assert(admin.user.role === 'ADMIN', `admin 角色 = ADMIN (got ${admin.user.role})`);

console.log('\n== 2) 用户注册并提交资料（张三，认领） ==');
const u1 = await registerUser(
  `audit.zhangsan.${Date.now()}@example.com`,
  '张三',
  'zhangsan_wx',
  '101',
);

console.log('\n== 3) 管理员查看候选并认领通过 ==');
const cand = await get(`/admin/audit/applications/${u1.appId}/candidates`, admin.token);
assert(cand.status === 200, `candidates → 200 (got ${cand.status})`);
const candidates = await cand.json();
assert(candidates.length > 0, `存在认领候选 (got ${candidates.length})`);
const hit = candidates.find((c) => c.realName === '张三');
assert(!!hit, '候选中命中「张三」');

const review = await post(
  `/admin/audit/applications/${u1.appId}/review`,
  { action: 'APPROVE', legacyMemberId: hit.id },
  admin.token,
);
assert(review.status === 200, `review APPROVE+claim → 200 (got ${review.status})`);
const reviewed = await review.json();
assert(reviewed.status === 'APPROVED' && reviewed.matchedLegacyMemberId === hit.id, '申请状态 APPROVED 且绑定旧账号');

console.log('\n== 4) 用户重新登录：ACTIVE + 资料 ==');
const u1Relogin = await login(u1.email, PASSWORD);
assert(u1Relogin.user.status === 'ACTIVE', `用户 status=ACTIVE (got ${u1Relogin.user.status})`);
assert(u1Relogin.user.profile?.realName === '张三', `profile.realName=张三`);
assert(u1Relogin.user.legacyMemberId === hit.id, `legacyMemberId=${hit.id}`);
assert(u1Relogin.user.profile?.uploadLimit === 100, `uploadLimit=100 (got ${u1Relogin.user.profile?.uploadLimit})`);

console.log('\n== 5) 重复认领被唯一约束拦截 ==');
const u2 = await registerUser(
  `audit.zhangsan2.${Date.now()}@example.com`,
  '张三',
  'zhangsan_wx',
  '101',
);
const dup = await post(
  `/admin/audit/applications/${u2.appId}/review`,
  { action: 'APPROVE', legacyMemberId: hit.id },
  admin.token,
);
const dupBody = await dup.json();
assert(dup.status === 409 && dupBody.code === 'LEGACY_ALREADY_CLAIMED', `重复认领 → 409 LEGACY_ALREADY_CLAIMED (got ${dup.status}/${dupBody.code})`);

console.log('\n== 6) 个人参赛者 uploadLimit=1 ==');
const u3 = await registerUser(
  `audit.individual.${Date.now()}@example.com`,
  '王五',
  'wangwu_wx',
  '134',
);
const r3 = await post(`/admin/audit/applications/${u3.appId}/review`, { action: 'APPROVE' }, admin.token);
assert(r3.status === 200, `个人 APPROVE → 200 (got ${r3.status})`);
const u3Relogin = await login(u3.email, PASSWORD);
assert(u3Relogin.user.profile?.uploadLimit === 1, `个人 uploadLimit=1 (got ${u3Relogin.user.profile?.uploadLimit})`);

console.log('\n全部通过 ✅');
