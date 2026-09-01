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

test('M2-D 双阅打分、分差仲裁、最终分与 BOT 认证', async ({ page, request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const examName = 'E2E仲裁考试' + suffix;
  const studentName = 'E2E仲裁学生' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };
  const examRes = await request.post('/api/admin/exams', { headers: adminAuth, data: { name: examName } });
  const exam = await examRes.json();
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: adminAuth,
    data: { slotCount: 2, defaultPoint: 10, gap: 1, titleMapping: [] },
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
  for (const pageNo of [1, 2]) {
    await request.post('/api/papers/' + paper.id + '/pages', {
      headers: coachAuth,
      data: { pageNo, fileKey: 'papers/' + paper.id + '/p' + pageNo + '.png' },
    });
  }
  const full = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  const q1 = full.questions.find((q: any) => q.slot === 1);
  const q2 = full.questions.find((q: any) => q.slot === 2);
  const page1 = full.pages.find((p: any) => p.pageNo === 1);
  const page2 = full.pages.find((p: any) => p.pageNo === 2);
  for (const bind of [
    { paperQuestionId: q1.id, paperPageId: page1.id, partIndex: 0 },
    { paperQuestionId: q1.id, paperPageId: page2.id, partIndex: 0 },
    { paperQuestionId: q2.id, paperPageId: page1.id, partIndex: 0 },
  ]) {
    await request.post('/api/papers/' + paper.id + '/images', { headers: coachAuth, data: bind });
  }
  await request.post('/api/papers/' + paper.id + '/status', { headers: coachAuth, data: { status: 'READY' } });
  const alloc = await request.post('/api/admin/exams/' + exam.id + '/allocation', {
    headers: adminAuth,
    data: {},
  });
  expect(alloc.ok()).toBeTruthy();

  // 平台端双阅：同一题 10 分和 5 分，分差 5 > gap=1
  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/tasks');
  await expect(page.getByRole('cell', { name: examName }).first()).toBeVisible();
  const pendingRow = () =>
    page
      .getByRole('row', { name: new RegExp(examName) })
      .filter({ hasText: '待批阅' })
      .first();

  await pendingRow().getByRole('button', { name: /打\s*分/ }).click();
  await shot(page, 'marking-grade-modal.png');
  await page.getByLabel('得分').fill('10');
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('评分已提交')).toBeVisible();

  // 第二名阅卷人独立评分
  const rank3Token = await apiLogin(request, ACCOUNTS.rankCoach3.account, ACCOUNTS.rankCoach3.password);
  const rank3Auth = { Authorization: 'Bearer ' + rank3Token };
  const rank3Tasks = await request
    .get('/api/tasks/mine', { headers: rank3Auth })
    .then((r: any) => r.json());
  const q2Task = rank3Tasks.items.find((t: any) => t.paperQuestionId === q2.id && t.status === 'PENDING');
  expect(q2Task).toBeTruthy();
  await request.post('/api/tasks/' + q2Task.id + '/grade', {
    headers: rank3Auth,
    data: { score: 5 },
  });

  // CPHOS 仲裁
  await login(page, ACCOUNTS.member.account, ACCOUNTS.member.password);
  await page.goto('/cphos/arbitration');
  const arbRow = page.getByRole('row', { name: new RegExp(examName) }).first();
  await expect(page.getByRole('cell', { name: examName }).first()).toBeVisible();
  await shot(page, 'arbitration-list.png');
  await arbRow.getByRole('button', { name: /认\s*领/ }).click();
  await expect(page.getByText('已认领')).toBeVisible();
  // 认领后任务从“待认领”进入“仲裁中”，切换筛选
  await page.locator('.ant-select-selector').first().click();
  await page.keyboard.type('仲裁中');
  await page.keyboard.press('Enter');
  await page.getByRole('row', { name: new RegExp(examName) }).first().getByRole('button', { name: /打\s*分/ }).click();
  await shot(page, 'arbitration-grade-modal.png');
  await page.getByLabel('仲裁分').fill('7');
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('仲裁分已提交')).toBeVisible();

  // 校验最终分
  const finalized = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  const finalizedQ2 = finalized.questions.find((q: any) => q.slot === 2);
  expect(finalizedQ2.finalScore).toBe(7);

  // BOT 创建与令牌认证
  const botName = 'bot_e2e_' + suffix;
  const botRes = await request.post('/api/admin/accounts/bots', {
    headers: adminAuth,
    data: { loginName: botName, displayName: 'E2E 机器人' },
  });
  expect(botRes.ok()).toBeTruthy();
  const bot = await botRes.json();
  expect(bot.token).toContain('bot_');
  const botList = await request.get('/api/arbitration/tasks', {
    headers: { 'x-bot-login': botName, 'x-bot-token': bot.token },
  });
  expect(botList.ok()).toBeTruthy();

  // 后台 UI 创建机器人并截图
  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  await page.goto('/admin/accounts');
  await page.getByTestId('bot-create-button').click();
  await shot(page, 'bot-create-modal.png');
  await page.getByLabel('机器人用户名').fill('bot_ui_' + suffix);
  await page.getByLabel('显示名称').fill('UI 机器人');
  await page.getByRole('dialog').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('令牌仅展示这一次，请立即保存')).toBeVisible();
  await shot(page, 'bot-token-modal.png');
});
