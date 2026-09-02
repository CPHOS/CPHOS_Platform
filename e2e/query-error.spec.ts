import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login } from './helpers';

test('前端查询失败展示错误态并可重试', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  await page.route('**/api/admin/exams**', (route) => route.abort('failed'));
  await page.goto('/admin/exams');
  await expect(page.getByText('数据加载失败')).toBeVisible();
  await page.unroute('**/api/admin/exams**');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByRole('button', { name: '新建考试' })).toBeVisible();
});
