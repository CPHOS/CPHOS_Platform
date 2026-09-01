import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login } from './helpers';

test('平台用户登录后个人信息/安全设置可用', async ({ page }) => {
  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await expect(page).toHaveURL(/\/app/);
  await page.goto('/app/profile');
  await expect(page.getByText('业务资料')).toBeVisible();
  await expect(page.getByText('安全设置')).toBeVisible();
  await expect(page.getByTestId('security-change-email')).toBeVisible();
});
