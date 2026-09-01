import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login } from './helpers';

async function confirm(page: Parameters<typeof login>[0]): Promise<void> {
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await dialog.getByRole('button', { name: /确\s*定/ }).click();
    return;
  }
  await page.getByRole('button', { name: /确\s*定/ }).click();
}

test('考试批次：创建 → 配置 → 发布 → 结束 → 归档', async ({ page }) => {
  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
  await page.goto('/admin/exams');

  const suffix = String(Date.now()).slice(-6);
  const name = 'E2E考试' + suffix;

  await page.getByTestId('exam-create-button').click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('考试名称').fill(name);
  await confirm(page);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('草稿')).toBeVisible();

  await row.getByText('配置', { exact: true }).click();
  const drawer = page.locator('.ant-drawer-content');
  await expect(drawer).toBeVisible();
  await drawer.getByLabel('槽位/题目总数').fill('8');
  await drawer.getByLabel('默认每题满分').fill('10');
  await drawer.getByLabel('仲裁分差阈值').fill('10');
  await drawer.getByRole('button', { name: '保存配置' }).click();
  await expect(drawer).toBeHidden();

  await row.getByText('发布', { exact: true }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(row.getByText('已发布')).toBeVisible();

  await row.getByText('结束', { exact: true }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(row.getByText('已结束')).toBeVisible();

  await row.getByText('归档', { exact: true }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(row.getByText('已归档')).toBeVisible();
});
