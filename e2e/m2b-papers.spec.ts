import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login, PROJECT_ROOT } from './helpers';

const SHOT_DIR = path.join(PROJECT_ROOT, 'e2e', 'artifacts');
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const png = Buffer.from(PNG_BASE64, 'base64');

async function shot(page: Parameters<typeof login>[0], name: string): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
}

async function apiLogin(request: Parameters<typeof test>[0] extends never ? never : any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

test('M2-B 整卷：一题多页、多题一页与操作截图', async ({ page, request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const examName = 'E2E上传考试' + suffix;
  const studentName = 'E2E上传学生' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const examRes = await request.post('/api/admin/exams', {
    headers: { Authorization: 'Bearer ' + adminToken },
    data: { name: examName },
  });
  expect(examRes.ok()).toBeTruthy();
  const exam = await examRes.json();
  const configRes = await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: { Authorization: 'Bearer ' + adminToken },
    data: { slotCount: 2, defaultPoint: 10, gap: 1, titleMapping: [] },
  });
  expect(configRes.ok()).toBeTruthy();
  const publishRes = await request.post('/api/admin/exams/' + exam.id + '/publish', {
    headers: { Authorization: 'Bearer ' + adminToken },
    data: {},
  });
  expect(publishRes.ok()).toBeTruthy();

  const coachToken = await apiLogin(request, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  const studentRes = await request.post('/api/students', {
    headers: { Authorization: 'Bearer ' + coachToken },
    data: { name: studentName },
  });
  expect(studentRes.ok()).toBeTruthy();
  const student = await studentRes.json();

  // 进入整卷上传页，创建整卷并截图创建弹窗
  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/papers');
  await expect(page.locator('.shell-inner')).toContainText('整卷上传');
  await page.getByTestId('paper-create-button').click();
  const createDialog = page.getByRole('dialog');
  await shot(page, 'paper-create-modal.png');
  await createDialog.locator('#examId').click();
  await createDialog.locator('#examId').pressSequentially(examName, { delay: 20 });
  await page.keyboard.press('Enter');
  await createDialog.locator('#studentId').click();
  await createDialog.locator('#studentId').pressSequentially(studentName, { delay: 20 });
  await page.keyboard.press('Enter');
  await createDialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('整卷：' + studentName)).toBeVisible();

  // 上传两页，显示分割线
  await page.getByTestId('paper-page-file').setInputFiles({ name: 'p1.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('第 1 页', { exact: true })).toBeVisible();
  await page.getByTestId('paper-page-file').setInputFiles({ name: 'p2.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('第 2 页', { exact: true })).toBeVisible();
  await page.getByTestId('guide-rows').first().fill('3');
  await shot(page, 'paper-upload-guides.png');

  // 题目1绑定第1页和第2页（一题多页）
  await page.getByTestId('paper-bind-1').click();
  let bindDialog = page.getByRole('dialog');
  await shot(page, 'paper-bind-modal.png');
  await bindDialog.locator('#paperPageId').click();
  await bindDialog.locator('#paperPageId').pressSequentially('第 1 页', { delay: 20 });
  await page.keyboard.press('Enter');
  await bindDialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('第1页 / 片段0')).toBeVisible();

  await page.getByTestId('paper-bind-1').click();
  bindDialog = page.getByRole('dialog');
  await bindDialog.locator('#paperPageId').click();
  await bindDialog.locator('#paperPageId').pressSequentially('第 2 页', { delay: 20 });
  await page.keyboard.press('Enter');
  await bindDialog.getByRole('button', { name: /确\s*定/ }).click();

  // 题目2也绑定第1页（多题一页）
  await page.getByTestId('paper-bind-2').click();
  bindDialog = page.getByRole('dialog');
  await bindDialog.locator('#paperPageId').click();
  await bindDialog.locator('#paperPageId').pressSequentially('第 1 页', { delay: 20 });
  await page.keyboard.press('Enter');
  await bindDialog.getByRole('button', { name: /确\s*定/ }).click();

  await shot(page, 'paper-binding-list.png');
  await page.getByTestId('paper-mark-ready').click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByLabel('整卷：' + studentName).getByText('已就绪')).toBeVisible();
});
