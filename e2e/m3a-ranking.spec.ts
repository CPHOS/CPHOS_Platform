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
  return (await res.json()).accessToken as string;
}

test('M3-A 排名分段与导出', async ({ page, request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const examName = 'E2E排名考试' + suffix;
  const studentName = 'E2E排名学生' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };

  const exam = await request
    .post('/api/admin/exams', { headers: adminAuth, data: { name: examName } })
    .then((r: any) => r.json());
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: adminAuth,
    data: { slotCount: 1, defaultPoint: 10, gap: 20, titleMapping: [] },
  });
  await request.post('/api/admin/exams/' + exam.id + '/publish', { headers: adminAuth, data: {} });

  const coachToken = await apiLogin(request, ACCOUNTS.rankCoach.account, ACCOUNTS.rankCoach.password);
  const coachAuth = { Authorization: 'Bearer ' + coachToken };
  const student = await request
    .post('/api/students', { headers: coachAuth, data: { name: studentName } })
    .then((r: any) => r.json());
  const paper = await request
    .post('/api/papers', { headers: coachAuth, data: { examId: exam.id, studentId: student.id } })
    .then((r: any) => r.json());
  await request.post('/api/papers/' + paper.id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 1, fileKey: 'papers/' + paper.id + '/rank.png' },
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

  const finalized = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  expect(finalized.score).toBe(9);

  const rankingRes = await request.get('/api/admin/exams/' + exam.id + '/ranking', {
    headers: adminAuth,
  });
  const ranking = await rankingRes.json();
  expect(ranking.entries[0].studentName).toBe(studentName);
  expect(ranking.entries[0].score).toBe(9);
  expect(ranking.entries[0].segmentLabel).toBe('前1');

  const csv = await request.get('/api/admin/exams/' + exam.id + '/ranking/export', {
    headers: adminAuth,
    params: { format: 'csv' },
  });
  expect(csv.ok()).toBeTruthy();
  const text = await csv.text();
  expect(text).toContain(studentName);
  expect(text).toContain('9');

  // UI 排名抽屉与 Excel 下载
  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  await page.goto('/admin/exams');
  const row = page.getByRole('row', { name: new RegExp(examName) });
  await row.getByText('排名', { exact: true }).click();
  await expect(page.getByText('已定稿 1 人')).toBeVisible();
  await shot(page, 'ranking-drawer.png');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('排名');
});
