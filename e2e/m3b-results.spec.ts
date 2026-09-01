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

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

async function memberId(request: any, adminAuth: any, q: string): Promise<string> {
  const res = await request.get('/api/admin/members', { headers: adminAuth, params: { q, pageSize: 5 } });
  const body = await res.json();
  expect(body.items.length).toBeGreaterThan(0);
  return body.items[0].userId as string;
}

test('M3-B 平台成绩查询与逐题详情', async ({ page, request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const examName = 'E2E成绩考试' + suffix;
  const studentName = 'E2E成绩学生' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };
  const coach1 = await memberId(request, adminAuth, ACCOUNTS.coach.account);
  const coach2 = await memberId(request, adminAuth, ACCOUNTS.coach2.account);
  await request.patch('/api/admin/members/' + coach1, { headers: adminAuth, data: { defaultSlot: 9 } });
  await request.patch('/api/admin/members/' + coach2, { headers: adminAuth, data: { defaultSlot: 1 } });

  const exam = await request
    .post('/api/admin/exams', { headers: adminAuth, data: { name: examName } })
    .then((r: any) => r.json());
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: adminAuth,
    data: { slotCount: 1, defaultPoint: 10, gap: 20, titleMapping: [] },
  });
  await request.post('/api/admin/exams/' + exam.id + '/publish', { headers: adminAuth, data: {} });

  const coachToken = await apiLogin(request, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  const coachAuth = { Authorization: 'Bearer ' + coachToken };
  const student = await request
    .post('/api/students', { headers: coachAuth, data: { name: studentName } })
    .then((r: any) => r.json());
  const paper = await request
    .post('/api/papers', { headers: coachAuth, data: { examId: exam.id, studentId: student.id } })
    .then((r: any) => r.json());
  await request.post('/api/papers/' + paper.id + '/pages/upload', {
    headers: coachAuth,
    multipart: {
      pageNo: '1',
      file: { name: 'answer.png', mimeType: 'image/png', buffer: png },
    },
  });
  const full = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  const q1 = full.questions[0];
  await request.post('/api/papers/' + paper.id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: q1.id, paperPageId: full.pages[0].id, partIndex: 0 },
  });
  await request.post('/api/papers/' + paper.id + '/status', { headers: coachAuth, data: { status: 'READY' } });
  await request.post('/api/admin/exams/' + exam.id + '/allocation', { headers: adminAuth, data: {} });

  const tasks = await request.get('/api/tasks/mine', { headers: coachAuth }).then((r: any) => r.json());
  const myTasks = tasks.items.filter((t: any) => t.examId === exam.id);
  expect(myTasks.length).toBe(2);
  await request.post('/api/tasks/' + myTasks[0].id + '/grade', { headers: coachAuth, data: { score: 8 } });
  await request.post('/api/tasks/' + myTasks[1].id + '/grade', { headers: coachAuth, data: { score: 10 } });

  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/results');
  await expect(page.getByRole('cell', { name: examName }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '1/1' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '9' }).first()).toBeVisible();
  await shot(page, 'platform-results.png');

  await page
    .getByRole('row', { name: new RegExp(examName) })
    .getByRole('button', { name: '查看详情' })
    .click();
  await expect(page.getByText('成绩详情：' + studentName)).toBeVisible();
  await expect(page.getByText('双阅分：8 / 10')).toBeVisible();
  await expect(page.getByText('槽位 1').first()).toBeVisible();
  await shot(page, 'result-detail-drawer.png');
});
