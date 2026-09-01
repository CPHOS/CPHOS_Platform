import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';

async function apiLogin(request: any, account: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

test('安全回归：路径穿越 / 跨卷删除 / 撤销重分配 / CSV 注入', async ({ request }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-6);
  const examName = 'E2E安全考试' + suffix;
  const safeName = '安全学生' + suffix;
  const dangerousName = '=HYPERLINK("http://evil","x")' + suffix;

  const adminToken = await apiLogin(request, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  const adminAuth = { Authorization: 'Bearer ' + adminToken };
  const coachToken = await apiLogin(request, ACCOUNTS.rankCoach.account, ACCOUNTS.rankCoach.password);
  const coachAuth = { Authorization: 'Bearer ' + coachToken };

  const exam = await request
    .post('/api/admin/exams', { headers: adminAuth, data: { name: examName } })
    .then((r: any) => r.json());
  await request.put('/api/admin/exams/' + exam.id + '/config', {
    headers: adminAuth,
    data: { slotCount: 1, defaultPoint: 10, gap: 1, titleMapping: [] },
  });
  await request.post('/api/admin/exams/' + exam.id + '/publish', { headers: adminAuth, data: {} });

  const students = await Promise.all(
    [safeName, dangerousName].map((name) =>
      request.post('/api/students', { headers: coachAuth, data: { name } }).then((r: any) => r.json()),
    ),
  );
  const papers = await Promise.all(
    students.map((student: any) =>
      request
        .post('/api/papers', { headers: coachAuth, data: { examId: exam.id, studentId: student.id } })
        .then((r: any) => r.json()),
    ),
  );
  for (const [index, paper] of papers.entries()) {
    await request.post('/api/papers/' + paper.id + '/pages', {
      headers: coachAuth,
      data: { pageNo: 1, fileKey: 'papers/' + paper.id + '/p' + index + '.png' },
    });
  }

  // C1 路径穿越应被 schema 拒绝
  const traversal = await request.post('/api/papers/' + papers[0].id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 2, fileKey: '../../.env' },
  });
  expect(traversal.status()).toBe(400);

  // C2 跨卷删除应 404，且原绑定保留
  const fullA = await request.get('/api/papers/' + papers[0].id, { headers: coachAuth }).then((r: any) => r.json());
  const qA = fullA.questions[0];
  const pageA = fullA.pages[0];
  await request.post('/api/papers/' + papers[0].id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: qA.id, paperPageId: pageA.id, partIndex: 0 },
  });
  const crossDelete = await request.delete('/api/papers/' + papers[1].id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: qA.id, paperPageId: pageA.id, partIndex: 0 },
  });
  expect(crossDelete.status()).toBe(404);
  const afterA = await request.get('/api/papers/' + papers[0].id, { headers: coachAuth }).then((r: any) => r.json());
  expect(afterA.questions[0].images.length).toBe(1);
  const fullB = await request.get('/api/papers/' + papers[1].id, { headers: coachAuth }).then((r: any) => r.json());
  await request.post('/api/papers/' + papers[1].id + '/images', {
    headers: coachAuth,
    data: { paperQuestionId: fullB.questions[0].id, paperPageId: fullB.pages[0].id, partIndex: 0 },
  });
  for (const paper of papers) {
    await request.post('/api/papers/' + paper.id + '/status', {
      headers: coachAuth,
      data: { status: 'READY' },
    });
  }

  // 有未定稿整卷时不能结束考试
  const closeUnfinalized = await request.post('/api/admin/exams/' + exam.id + '/close', {
    headers: adminAuth,
    data: {},
  });
  expect(closeUnfinalized.status()).toBe(400);

  // C3 撤销后必须可再次分配
  const first = await request.post('/api/admin/exams/' + exam.id + '/allocation', { headers: adminAuth, data: {} });
  expect(first.ok()).toBeTruthy();
  const batch = await first.json();
  const revoke = await request.post('/api/admin/allocation/batches/' + batch.id + '/revoke', {
    headers: adminAuth,
    data: {},
  });
  expect(revoke.ok()).toBeTruthy();
  const second = await request.post('/api/admin/exams/' + exam.id + '/allocation', { headers: adminAuth, data: {} });
  expect(second.ok()).toBeTruthy();
  const secondBatch = await second.json();

  // 分差触发仲裁；此时结束考试应被拒绝
  const tasks = await request.get('/api/tasks/mine', { headers: coachAuth }).then((r: any) => r.json());
  const myTasks = tasks.items.filter((t: any) => t.examId === exam.id);
  expect(myTasks.length).toBe(4);
  for (const task of myTasks) {
    const grade = await request.post('/api/tasks/' + task.id + '/grade', {
      headers: coachAuth,
      data: { score: task.roundNo === 1 ? 5 : 10 },
    });
    expect(grade.ok()).toBeTruthy();
  }
  const closeBefore = await request.post('/api/admin/exams/' + exam.id + '/close', {
    headers: adminAuth,
    data: {},
  });
  expect(closeBefore.status()).toBe(400);

  // 完成仲裁定稿；仅保留当前 ACTIVE 批次两轮分数
  const arbitrations = await request
    .get('/api/arbitration/tasks', { headers: adminAuth, params: { status: 'PENDING', pageSize: 20 } })
    .then((r: any) => r.json());
  const myArbs = arbitrations.items.filter((a: any) => a.examId === exam.id);
  expect(myArbs.length).toBe(2);
  for (const arb of myArbs) {
    const grade = await request.post('/api/arbitration/tasks/' + arb.id + '/grade', {
      headers: adminAuth,
      data: { score: 7 },
    });
    expect(grade.ok()).toBeTruthy();
  }
  for (const paper of papers) {
    const finalPaper = await request.get('/api/papers/' + paper.id, { headers: coachAuth }).then((r: any) => r.json());
    expect(finalPaper.finalizedAt).toBeTruthy();
    expect(finalPaper.questions[0].roundScores.length).toBe(2);
  }
  const closeAfter = await request.post('/api/admin/exams/' + exam.id + '/close', {
    headers: adminAuth,
    data: {},
  });
  expect(closeAfter.ok()).toBeTruthy();

  // 终审后不得撤销分配改写成绩
  const revokeFinal = await request.post('/api/admin/allocation/batches/' + secondBatch.id + '/revoke', {
    headers: adminAuth,
    data: {},
  });
  expect(revokeFinal.status()).toBe(400);

  // M5 CSV 公式注入被中和
  const csv = await request.get('/api/admin/exams/' + exam.id + '/ranking/export', {
    headers: adminAuth,
    params: { format: 'csv' },
  });
  expect(csv.ok()).toBeTruthy();
  const text = await csv.text();
  expect(text).toContain("'=HYPERLINK");
});
