// 只读检查：找出 ACTIVE 批次中同一题被同一阅卷人重复分配的情况。
// 生产升级新唯一约束前应先运行：pnpm --filter @cphos/api task:check-duplicates
import { prisma } from '../src/db.js';

async function main() {
  const tasks = await prisma.markingTask.findMany({
    where: { allocation: { status: 'ACTIVE' } },
    select: { allocationId: true, paperQuestionId: true, assigneeId: true },
  });
  const counts = new Map<string, { allocationId: bigint | null; paperQuestionId: bigint; assigneeId: bigint; count: number }>();
  for (const task of tasks) {
    const key = String(task.allocationId) + ':' + task.paperQuestionId + ':' + task.assigneeId;
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { ...task, count: 1 });
  }
  const duplicates = [...counts.values()].filter((x) => x.count > 1);
  if (duplicates.length === 0) {
    console.log('[tasks] no duplicate same-question/same-assignee ACTIVE tasks');
    return;
  }
  console.table(
    duplicates.map((g) => ({
      allocationId: String(g.allocationId),
      paperQuestionId: String(g.paperQuestionId),
      assigneeId: String(g.assigneeId),
      count: g.count,
    })),
  );
  console.error('[tasks] duplicate tasks found. Revoke affected ACTIVE batches and reallocate before deploying unique constraints.');
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
