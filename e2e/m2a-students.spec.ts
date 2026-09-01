import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login } from './helpers';

async function confirm(page: Parameters<typeof login>[0]): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: /确\s*定/ }).click();
}

test('学生名册：新增 → 编辑 → 归档', async ({ page }) => {
  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/students');

  const suffix = String(Date.now()).slice(-6);
  const name = 'E2E学生' + suffix;
  const edited = name + '改';

  await page.getByTestId('student-create-button').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('学生姓名').fill(name);

  // 不手动选学校：后端应默认继承教练个人资料上的 E2E测试中学
  await dialog.locator('#gradeId').click();
  await page.keyboard.type('高一');
  await page.keyboard.press('Enter');
  await confirm(page);

  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('E2E测试中学')).toBeVisible();

  await row.getByText('编辑').click();
  await dialog.getByLabel('学生姓名').fill(edited);
  await confirm(page);
  const editedRow = page.getByRole('row', { name: new RegExp(edited) });
  await expect(editedRow).toBeVisible();

  await editedRow.getByText('归档').click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(edited) })).toHaveCount(0);
});
