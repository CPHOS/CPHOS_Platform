import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { waitForEmailCode } from './helpers';

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

async function registerAndVerify(request: any, email: string, password: string): Promise<void> {
  const register = await request.post('/api/auth/register', { data: { email, password } });
  expect(register.ok()).toBeTruthy();
  const code = await waitForEmailCode(email);
  const verify = await request.post('/api/auth/verify-email', { data: { email, code } });
  expect(verify.ok()).toBeTruthy();
}

async function findApplication(request: any, adminAuth: any, realName: string) {
  const res = await request.get('/api/admin/audit/applications', {
    headers: adminAuth,
    params: { status: 'PENDING', q: realName, page: 1, pageSize: 20 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const app = body.items.find((item: any) => item.realName === realName);
  expect(app).toBeTruthy();
  return app;
}

test('审核闭环：注册验证→补材料→驳回→重提→通过', async ({ request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const email = 'e2e.audit.' + suffix + '@example.com';
  const password = 'E2eAudit123!';
  const v1 = '审核学生甲' + suffix;
  const v2 = '审核学生乙' + suffix;
  const v3 = '审核学生丙' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };

  await registerAndVerify(request, email, password);
  const userToken = await apiLogin(request, email, password);
  const userAuth = { Authorization: 'Bearer ' + userToken };
  const schools = await request.get('/api/dict/schools', { headers: userAuth }).then((r: any) => r.json());
  const school = schools.find((s: any) => !s.isIndividual) ?? schools[0];
  expect(school).toBeTruthy();

  const base = {
    schoolId: String(school.id),
    wechatNickname: 'audit-wx-' + suffix,
    contact: 'audit-contact-' + suffix,
    claimLegacy: false,
  };

  const submit = await request.post('/api/audit/applications', {
    headers: userAuth,
    data: { ...base, realName: v1, applyNote: '首次提交' },
  });
  expect(submit.status()).toBe(201);

  const app1 = await findApplication(request, adminAuth, v1);
  const material = await request.post('/api/admin/audit/applications/' + app1.id + '/review', {
    headers: adminAuth,
    data: { action: 'REQUEST_MATERIAL', remark: '请补充学生证明' },
  });
  expect(material.ok()).toBeTruthy();
  const meAfterMaterial = await request.get('/api/audit/applications/me', { headers: userAuth }).then((r: any) => r.json());
  expect(meAfterMaterial.materialRequestedAt).toBeTruthy();

  // 补材料后重提
  const resubmit1 = await request.put('/api/audit/applications/me', {
    headers: userAuth,
    data: { ...base, realName: v2, applyNote: '已补充材料' },
  });
  expect(resubmit1.ok()).toBeTruthy();

  const app2 = await findApplication(request, adminAuth, v2);
  const reject = await request.post('/api/admin/audit/applications/' + app2.id + '/review', {
    headers: adminAuth,
    data: { action: 'REJECT', remark: '材料仍不清晰' },
  });
  expect(reject.ok()).toBeTruthy();
  const meAfterReject = await request.get('/api/audit/applications/me', { headers: userAuth }).then((r: any) => r.json());
  expect(meAfterReject.status).toBe('REJECTED');

  // 驳回后再次重提
  const resubmit2 = await request.put('/api/audit/applications/me', {
    headers: userAuth,
    data: { ...base, realName: v3, applyNote: '重新提交完整材料' },
  });
  expect(resubmit2.ok()).toBeTruthy();

  const app3 = await findApplication(request, adminAuth, v3);
  const approve = await request.post('/api/admin/audit/applications/' + app3.id + '/review', {
    headers: adminAuth,
    data: { action: 'APPROVE', remark: '材料齐全' },
  });
  expect(approve.ok()).toBeTruthy();

  const me = await request.get('/api/auth/me', { headers: userAuth }).then((r: any) => r.json());
  expect(me.status).toBe('ACTIVE');
  expect(me.profile).toBeTruthy();
  expect(me.profile.realName).toBe(v3);
  expect(me.profile.defaultSlot).toBeNull();
});
