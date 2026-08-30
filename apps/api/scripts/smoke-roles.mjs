// 角色模型冒烟测试 v2：内部账号=用户名+显示名+密码；超级管理员唯一；仲裁为模块（无 ARBITRATOR 业务角色）
// 前置：以下账号需已存在（见下方 cases 数组）。除超管/管理员外，密码统一为 12312345。
//   创建方式：pnpm api:init-super-admin -- super 系统管理员 superadmin888
//             pnpm api:create-internal -- zhangsan 张三 12312345 CPHOS_MEMBER
//             pnpm api:create-internal -- lioper 李四 ops888 ADMIN
//   平台用户 coach.test@example.com 需经注册+邮箱验证流程创建（密码 12312345）。
const BASE = 'http://127.0.0.1:3001/api';

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

const login = async (account, password) => {
  const res = await post('/auth/login', { account, password });
  const body = await res.json();
  return { status: res.status, body };
};

const cases = [
  // [账号, 密码, 期望]
  ['super', 'superadmin888', { role: 'SUPER_ADMIN', protected: true, displayName: '系统管理员', email: null }],
  ['zhangsan', '12312345', { role: 'CPHOS_MEMBER', protected: false, displayName: '张三', profile: null }],
  ['lioper', 'ops888', { role: 'ADMIN', protected: false, displayName: '李四' }],
  ['coach.test@example.com', '12312345', { role: 'PLATFORM_USER', email: 'coach.test@example.com' }],
];

let failed = 0;
for (const [account, password, expect] of cases) {
  const { status, body } = await login(account, password);
  const u = body.user;
  const ok =
    status === 200 &&
    u?.role === expect.role &&
    (expect.protected === undefined || u.protected === expect.protected) &&
    (expect.displayName === undefined || u.displayName === expect.displayName) &&
    (expect.email === undefined || u.email === expect.email) &&
    (expect.profile === undefined || u.profile === expect.profile);
  if (!ok) failed++;
  console.log(
    `${ok ? '✓' : '✗'} ${account} → role=${u?.role ?? body.code} protected=${u?.protected ?? '-'} name=${u?.displayName ?? '-'} profile=${u?.profile?.role ?? '无'} ${ok ? '' : JSON.stringify(body)}`,
  );
}

// 平台用户请求注册验证码 → 允许
const codeRes = await post('/auth/send-code', { email: 'coach.test@example.com', purpose: 'REGISTER' });
console.log(`${codeRes.status === 400 ? '✓' : '✗'} 平台用户(已验证) send-code(REGISTER) → ${codeRes.status}`);

console.log(failed === 0 ? '\n全部通过 ✅' : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
