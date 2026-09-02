import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { uploadPaperPage } from './helpers';

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
  const superToken = await apiLogin(request, ACCOUNTS.super.account, ACCOUNTS.super.password);
  const superAuth = { Authorization: 'Bearer ' + superToken };
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
  for (const paper of papers) {
    await uploadPaperPage(request, coachAuth, paper.id, 1);
  }

  // C1 路径穿越应被 schema 拒绝
  const traversal = await request.post('/api/papers/' + papers[0].id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 2, fileKey: '../../.env' },
  });
  expect(traversal.status()).toBe(400);

  // C1b 合法格式但物理不存在的文件键不得登记 StoredObject
  const ghost = await request.post('/api/papers/' + papers[0].id + '/pages', {
    headers: coachAuth,
    data: { pageNo: 2, fileKey: 'papers/' + papers[0].id + '/ghost.png' },
  });
  expect(ghost.status()).toBe(400);

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
  expect(afterA.questions[0].images[0].paperPageId).toBe(afterA.pages[0].id);
  const pageFile = await request.get('/api/papers/' + papers[0].id + '/pages/' + pageA.id + '/file', {
    headers: coachAuth,
  });
  expect(pageFile.ok()).toBeTruthy();
  expect(pageFile.headers()['content-type']).toContain('image/png');
  expect((await pageFile.body()).length).toBeGreaterThan(0);
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

  // 教练可主动放弃并把未完成卷归档，考试结束时忽略该卷
  const abandonStudent = await request
    .post('/api/students', { headers: coachAuth, data: { name: '弃考学生' + suffix } })
    .then((r: any) => r.json());
  const abandonPaper = await request
    .post('/api/papers', { headers: coachAuth, data: { examId: exam.id, studentId: abandonStudent.id } })
    .then((r: any) => r.json());
  // 普通管理员不可低于 2 次评阅；超管可设置低于最低限并恢复默认
  const denyReview = await request.patch('/api/admin/papers/' + abandonPaper.id + '/review-count', {
    headers: adminAuth,
    data: { reviewCount: 1 },
  });
  expect(denyReview.status()).toBe(400);
  const allowReview = await request.patch('/api/admin/papers/' + abandonPaper.id + '/review-count', {
    headers: superAuth,
    data: { reviewCount: 1 },
  });
  expect(allowReview.ok()).toBeTruthy();
  const resetReview = await request.patch('/api/admin/papers/' + abandonPaper.id + '/review-count', {
    headers: superAuth,
    data: { reviewCount: null },
  });
  expect(resetReview.ok()).toBeTruthy();

  const abandonStatus = await request.post('/api/papers/' + abandonPaper.id + '/status', {
    headers: coachAuth,
    data: { status: 'ARCHIVED' },
  });
  expect(abandonStatus.ok()).toBeTruthy();

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

  // 已生成 ACTIVE 分配后不允许新增整卷
  const lateStudent = await request
    .post('/api/students', { headers: coachAuth, data: { name: '迟到学生' + suffix } })
    .then((r: any) => r.json());
  const latePaper = await request.post('/api/papers', {
    headers: coachAuth,
    data: { examId: exam.id, studentId: lateStudent.id },
  });
  expect(latePaper.status()).toBe(400);
  const revoke = await request.post('/api/admin/allocation/batches/' + batch.id + '/revoke', {
    headers: adminAuth,
    data: {},
  });
  expect(revoke.ok()).toBeTruthy();
  const second = await request.post('/api/admin/exams/' + exam.id + '/allocation', { headers: adminAuth, data: {} });
  expect(second.ok()).toBeTruthy();
  const secondBatch = await second.json();

  // 生效任务存在时，即使超管也不能改变评阅次数（含恢复默认）
  const activeCountChange = await request.patch('/api/admin/papers/' + papers[0].id + '/review-count', {
    headers: superAuth,
    data: { reviewCount: 1 },
  });
  expect(activeCountChange.status()).toBe(400);

  // 分差触发仲裁；平台端两名不同阅卷人完成第一评/第二评
  const reviewerAccounts = [ACCOUNTS.rankCoach, ACCOUNTS.rankCoach2, ACCOUNTS.rankCoach4];
  const examinerTasks: { token: string; task: any }[] = [];
  for (const account of reviewerAccounts) {
    const token = await apiLogin(request, account.account, account.password);
    const body = await request
      .get('/api/tasks/mine', { headers: { Authorization: 'Bearer ' + token } })
      .then((r: any) => r.json());
    for (const task of body.items.filter((t: any) => t.examId === exam.id)) {
      examinerTasks.push({ token, task });
    }
  }
  expect(examinerTasks.length).toBe(4);
  const byQuestion = new Map<string, typeof examinerTasks>();
  for (const row of examinerTasks) {
    const list = byQuestion.get(row.task.paperQuestionId) ?? [];
    list.push(row);
    byQuestion.set(row.task.paperQuestionId, list);
  }
  for (const list of byQuestion.values()) {
    expect(list.length).toBe(2);
    expect(new Set(list.map((x) => x.task.assigneeId)).size).toBe(2);
  }
  for (const row of examinerTasks) {
    const grade = await request.post('/api/tasks/' + row.task.id + '/grade', {
      headers: { Authorization: 'Bearer ' + row.token },
      data: { score: row.task.roundNo === 1 ? 5 : 10 },
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
