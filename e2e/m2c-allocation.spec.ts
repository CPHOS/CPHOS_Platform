import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login, PROJECT_ROOT } from './helpers';

const SHOT_DIR = path.join(PROJECT_ROOT, 'e2e', 'artifacts');

async function shot(page: Parameters<typeof login>[0], name: string): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
}

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

async function setupReadyPaper(request: any, suffix: string) {
  const examName = 'E2E分配考试' + suffix;
  const studentName = 'E2E分配学生' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const auth = { Authorization: 'Bearer ' + adminToken };

  const examRes = await request.post('/api/admin/exams', { headers: auth, data: { name: examName } });
  const exam = await examRes.json();
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: auth,
    data: { slotCount: 2, defaultPoint: 10, gap: 1, titleMapping: [] },
  });
  await request.post('/api/admin/exams/' + exam.id + '/publish', { headers: auth, data: {} });

  const coachToken = await apiLogin(request, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  const coachAuth = { Authorization: 'Bearer ' + coachToken };
  const studentRes = await request.post('/api/students', {
    headers: coachAuth,
    data: { name: studentName },
  });
  const student = await studentRes.json();
  const paperRes = await request.post('/api/papers', {
    headers: coachAuth,
    data: { examId: exam.id, studentId: student.id },
  });
  expect(paperRes.ok()).toBeTruthy();
  const paper = await paperRes.json();

  await request.post('/api/papers/' + paper.id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 1, fileKey: 'papers/' + paper.id + '/p1.png' },
  });
  await request.post('/api/papers/' + paper.id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 2, fileKey: 'papers/' + paper.id + '/p2.png' },
  });
  const refreshed = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  const q1 = refreshed.questions.find((q: any) => q.slot === 1);
  const q2 = refreshed.questions.find((q: any) => q.slot === 2);
  const page1 = refreshed.pages.find((p: any) => p.pageNo === 1);
  const page2 = refreshed.pages.find((p: any) => p.pageNo === 2);

  await request.post('/api/papers/' + paper.id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: q1.id, paperPageId: page1.id, partIndex: 0 },
  });
  await request.post('/api/papers/' + paper.id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: q1.id, paperPageId: page2.id, partIndex: 0 },
  });
  await request.post('/api/papers/' + paper.id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: q2.id, paperPageId: page1.id, partIndex: 0 },
  });
  const ready = await request.post('/api/papers/' + paper.id + '/status', {
    headers: coachAuth,
    data: { status: 'READY' },
  });
  expect(ready.ok()).toBeTruthy();
  return { examName };
}

test('M2-C 精确均衡分配与双阅任务展示', async ({ page, request }) => {
  test.setTimeout(150_000);
  const suffix = String(Date.now()).slice(-6);
  const { examName } = await setupReadyPaper(request, suffix);

  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  await page.goto('/admin/exams');
  const row = page.getByRole('row', { name: new RegExp(examName) });
  await expect(row).toBeVisible();
  await row.getByText('分配', { exact: true }).click();
  await expect(page.getByText('均衡预览')).toBeVisible();
  await shot(page, 'allocation-preview-drawer.png');

  await page.getByRole('button', { name: '生成均衡分配' }).click();
  await expect(page.getByText('生效中')).toBeVisible();
  await shot(page, 'allocation-batch-created.png');

  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/tasks');
  await expect(page.locator('.shell-inner')).toContainText('阅卷任务');
  await expect(page.getByRole('cell', { name: examName }).first()).toBeVisible();
  await shot(page, 'platform-marking-tasks.png');
});
