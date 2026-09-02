import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

async function setupThreeReviewExam(request: any, adminAuth: any, suffix: string, gap: number) {
  const examName = 'E2E三评考试' + suffix + '-' + gap;
  const studentName = 'E2E三评学生' + suffix + '-' + gap;
  const exam = await request
    .post('/api/admin/exams', { headers: adminAuth, data: { name: examName } })
    .then((r: any) => r.json());
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: adminAuth,
    data: { slotCount: 1, reviewCount: 3, defaultPoint: 20, gap, titleMapping: [] },
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
    data: { pageNo: 1, fileKey: 'papers/' + paper.id + '/n3.png' },
  });
  const full = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
  await request.post('/api/papers/' + paper.id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: full.questions[0].id, paperPageId: full.pages[0].id, partIndex: 0 },
  });
  await request.post('/api/papers/' + paper.id + '/status', { headers: coachAuth, data: { status: 'READY' } });
  const allocation = await request.post('/api/admin/exams/' + exam.id + '/allocation', {
    headers: adminAuth,
    data: {},
  });
  expect(allocation.ok()).toBeTruthy();
  return { exam, paper, question: full.questions[0] };
}

async function tasksFor(request: any, account: { account: string; password: string }, examId: string) {
  const token = await apiLogin(request, account.account, account.password);
  const res = await request.get('/api/tasks/mine', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const body = await res.json();
  return {
    token,
    tasks: body.items.filter((t: any) => t.examId === examId),
  };
}

test('M2-E N=3 不同阅卷人：均值舍入与超分差仲裁', async ({ request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };

  // A. N=3 均值舍入：8.33 + 8.34 + 8.36 => 8.34
  const meanExam = await setupThreeReviewExam(request, adminAuth, suffix, 10);
  const meanReviewers = await Promise.all([
    tasksFor(request, ACCOUNTS.rankCoach, meanExam.exam.id),
    tasksFor(request, ACCOUNTS.rankCoach2, meanExam.exam.id),
    tasksFor(request, ACCOUNTS.rankCoach4, meanExam.exam.id),
  ]);
  const meanTasks = meanReviewers.map((r) => {
    expect(r.tasks.length).toBe(1);
    return r.tasks[0];
  });
  expect(new Set(meanTasks.map((t: any) => t.assigneeId)).size).toBe(3);

  // 个人参赛者即使有槽位也不接单
  const personal = await tasksFor(request, { account: 'e2e.personal@example.com', password: 'E2ePersonal123!' }, meanExam.exam.id);
  expect(personal.tasks.length).toBe(0);

  const meanScores = [8.33, 8.34, 8.36];
  for (let i = 0; i < meanReviewers.length; i += 1) {
    const grade = await request.post('/api/tasks/' + meanReviewers[i].tasks[0].id + '/grade', {
      headers: { Authorization: 'Bearer ' + meanReviewers[i].token },
      data: { score: meanScores[i] },
    });
    expect(grade.ok()).toBeTruthy();
  }
  const ownerToken = await apiLogin(request, ACCOUNTS.rankCoach.account, ACCOUNTS.rankCoach.password);
  const ownerMean = await request.get('/api/papers/' + meanExam.paper.id, {
    headers: { Authorization: 'Bearer ' + ownerToken },
  });
  expect(ownerMean.ok()).toBeTruthy();
  expect((await ownerMean.json()).questions[0].finalScore).toBe(8.34);

  // B. N=3 超分差触发仲裁：8/10/12 -> 仲裁 7
  const gapExam = await setupThreeReviewExam(request, adminAuth, suffix, 1);
  const gapReviewers = await Promise.all([
    tasksFor(request, ACCOUNTS.rankCoach, gapExam.exam.id),
    tasksFor(request, ACCOUNTS.rankCoach2, gapExam.exam.id),
    tasksFor(request, ACCOUNTS.rankCoach4, gapExam.exam.id),
  ]);
  const gapScores = [8, 10, 12];
  for (let i = 0; i < gapReviewers.length; i += 1) {
    const grade = await request.post('/api/tasks/' + gapReviewers[i].tasks[0].id + '/grade', {
      headers: { Authorization: 'Bearer ' + gapReviewers[i].token },
      data: { score: gapScores[i] },
    });
    expect(grade.ok()).toBeTruthy();
  }
  const arbList = await request
    .get('/api/arbitration/tasks', { headers: adminAuth, params: { status: 'PENDING', pageSize: 50 } })
    .then((r: any) => r.json());
  const arb = arbList.items.find((a: any) => a.examId === gapExam.exam.id);
  expect(arb).toBeTruthy();
  const arbGrade = await request.post('/api/arbitration/tasks/' + arb.id + '/grade', {
    headers: adminAuth,
    data: { score: 7 },
  });
  expect(arbGrade.ok()).toBeTruthy();
  const gapOwner = await request.get('/api/papers/' + gapExam.paper.id, {
    headers: { Authorization: 'Bearer ' + (await apiLogin(request, ACCOUNTS.rankCoach.account, ACCOUNTS.rankCoach.password)) },
  });
  expect(gapOwner.ok()).toBeTruthy();
  const gapDetail = await gapOwner.json();
  expect(gapDetail.questions[0].finalScore).toBe(7);
  expect(gapDetail.questions[0].roundScores.length).toBe(3);
});
