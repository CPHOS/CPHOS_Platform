// 认证链路冒烟测试（Node fetch，独立于前端）
// 覆盖：login → 捕获 refresh cookie → refresh 轮换 → logout → 旧令牌 401
const BASE = 'http://127.0.0.1:3001/api';
const EMAIL = 'coach.test@example.com';
const PASSWORD = '123123';

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`✓ ${label}`);
}

const post = (path, body, cookie) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

// 1) 登录
const loginRes = await post('/auth/login', { account: EMAIL, password: PASSWORD });
assert(loginRes.status === 200, `login 200 (got ${loginRes.status})`);
const loginBody = await loginRes.json();
assert(loginBody.accessToken.length > 100, 'login 返回 accessToken');
const cookies = loginRes.headers.getSetCookie();
assert(cookies.length === 1 && cookies[0].startsWith('cphos_refresh='), 'login 下发 httpOnly refresh cookie');
const cookiePair = cookies[0].split(';')[0];
const cookieHeader = cookiePair;

// 2) me（带 accessToken）
const meRes = await fetch(`${BASE}/auth/me`, {
  headers: { authorization: `Bearer ${loginBody.accessToken}` },
});
assert(meRes.status === 200, 'me 200');
const me = await meRes.json();
assert(me.email === EMAIL && me.emailVerified === true && me.status === 'PENDING', 'me 返回 email/verified/status');

// 3) refresh 轮换（旧 cookie → 新 accessToken + 新 cookie）
const refreshRes = await post('/auth/refresh', null, cookieHeader);
assert(refreshRes.status === 200, `refresh 200 (got ${refreshRes.status})`);
const refreshBody = await refreshRes.json();
assert(refreshBody.accessToken.length > 100, 'refresh 返回新 accessToken');
const newCookies = refreshRes.headers.getSetCookie();
assert(newCookies.length === 1, 'refresh 轮换并下发新 cookie');
const newCookieHeader = newCookies[0].split(';')[0];

// 4) 旧令牌已轮换作废
const staleRes = await post('/auth/refresh', null, cookieHeader);
assert(staleRes.status === 401, `旧 refresh token 401 (got ${staleRes.status})`);

// 5) logout（新 cookie）
const logoutRes = await post('/auth/logout', null, newCookieHeader);
assert(logoutRes.status === 200, `logout 200 (got ${logoutRes.status})`);

// 6) logout 后新 cookie 也失效
const afterLogout = await post('/auth/refresh', null, newCookieHeader);
assert(afterLogout.status === 401, `logout 后 refresh 401 (got ${afterLogout.status})`);

console.log('\n全部通过 ✅');
