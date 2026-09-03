import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

async function dictLogs(request: any, auth: { Authorization: string }, q: string): Promise<any[]> {
  const res = await request.get('/api/admin/audit/logs', { headers: auth, params: { q, pageSize: 100 } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.items.filter((item: any) => String(item.action).startsWith('DICT_'));
}

test('字典审计：四类增改删、失败不落库与事务回滚', async ({ request }) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now()).slice(-6);
  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const auth = { Authorization: 'Bearer ' + adminToken };

  const areaName = 'E2E审计赛区A' + suffix;
  const areaName2 = 'E2E审计赛区A2' + suffix;
  const areaBName = 'E2E审计赛区B' + suffix;
  const schoolName = 'E2E审计学校' + suffix;
  const schoolName2 = 'E2E审计学校改' + suffix;
  const gradeName = 'E2E审计年级' + suffix;
  const gradeName2 = 'E2E审计年级改' + suffix;
  const prizeName = 'E2E审计奖项' + suffix;
  const prizeName2 = 'E2E审计奖项改' + suffix;

  const post = async (url: string, data: Record<string, unknown>) => {
    const res = await request.post(url, { headers: auth, data });
    expect(res.ok()).toBeTruthy();
    return res.json();
  };

  const areaA = await post('/api/admin/dict/areas', { name: areaName });
  const areaB = await post('/api/admin/dict/areas', { name: areaBName });
  const school = await post('/api/admin/dict/schools', { name: schoolName, areaId: areaA.id });
  const grade = await post('/api/admin/dict/grades', { name: gradeName });
  const prize = await post('/api/admin/dict/prizes', { name: prizeName });

  // 四类创建均应写入审计
  for (const name of [areaName, areaBName, schoolName, gradeName, prizeName]) {
    const logs = await dictLogs(request, auth, name);
    expect(logs.some((item) => item.action === 'DICT_CREATE' && String(item.remark).includes(name))).toBeTruthy();
  }

  // 唯一键冲突必须回滚，不得新增审计
  const beforeDuplicate = await dictLogs(request, auth, gradeName);
  const duplicate = await request.post('/api/admin/dict/grades', { headers: auth, data: { name: gradeName } });
  expect(duplicate.status()).toBe(400);
  const afterDuplicate = await dictLogs(request, auth, gradeName);
  expect(afterDuplicate.filter((item) => item.action === 'DICT_CREATE').length).toBe(
    beforeDuplicate.filter((item) => item.action === 'DICT_CREATE').length,
  );

  // 被学校引用的赛区删除失败，不得写入删除审计
  const failedDelete = await request.delete('/api/admin/dict/areas/' + areaA.id, { headers: auth });
  expect(failedDelete.status()).toBe(409);
  const afterFailedDelete = await dictLogs(request, auth, areaName);
  expect(afterFailedDelete.some((item) => item.action === 'DICT_DELETE' && String(item.remark).includes('删除赛区「' + areaName))).toBe(false);

  // 更新年级/奖项/赛区，并迁移学校：审计必须包含旧值、新值和对象 ID
  const patch = async (url: string, data: Record<string, unknown>) => {
    const res = await request.patch(url, { headers: auth, data });
    expect(res.ok()).toBeTruthy();
    return res.json();
  };
  await patch('/api/admin/dict/grades/' + grade.id, { name: gradeName2 });
  await patch('/api/admin/dict/prizes/' + prize.id, { name: prizeName2 });
  // 先迁移学校，确保备注记录的是当时赛区旧名
  await patch('/api/admin/dict/schools/' + school.id, { name: schoolName2, areaId: areaB.id });
  await patch('/api/admin/dict/areas/' + areaA.id, { name: areaName2 });

  // 修改审计应覆盖四类字典
  for (const [oldName, newName] of [
    [gradeName, gradeName2],
    [prizeName, prizeName2],
    [areaName, areaName2],
  ]) {
    const update = (await dictLogs(request, auth, oldName)).find(
      (item) => item.action === 'DICT_UPDATE' && String(item.remark).includes(newName),
    );
    expect(update).toBeTruthy();
  }

  const schoolUpdate = (await dictLogs(request, auth, schoolName)).find(
    (item) => item.action === 'DICT_UPDATE',
  );
  expect(schoolUpdate).toBeTruthy();
  expect(String(schoolUpdate.remark)).toContain('#' + school.id);
  expect(String(schoolUpdate.remark)).toContain('名称「' + schoolName + '」→「' + schoolName2 + '」');
  expect(String(schoolUpdate.remark)).toContain('赛区「' + areaName + '」→「' + areaBName + '」');

  // 删除四类并确认删除审计
  const remove = async (url: string) => {
    const res = await request.delete(url, { headers: auth });
    expect(res.ok()).toBeTruthy();
  };
  await remove('/api/admin/dict/grades/' + grade.id);
  await remove('/api/admin/dict/prizes/' + prize.id);
  await remove('/api/admin/dict/schools/' + school.id);
  await remove('/api/admin/dict/areas/' + areaB.id);
  await remove('/api/admin/dict/areas/' + areaA.id);

  for (const name of [schoolName2, gradeName2, prizeName2, areaBName, areaName2]) {
    const logs = await dictLogs(request, auth, name);
    expect(logs.some((item) => item.action === 'DICT_DELETE' && String(item.remark).includes(name))).toBeTruthy();
  }
});
