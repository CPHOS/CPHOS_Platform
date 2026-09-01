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

/** UI 走查：抓取关键页面截图到 e2e/artifacts，供本地人工确认 */
test('后台关键页面 UI 截图', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);

  await page.goto('/admin');
  await expect(page.getByText('审核工作台')).toBeVisible();
  await shot(page, 'admin-home.png');

  for (const item of [
    { path: '/admin/teams', name: 'admin-teams.png' },
    { path: '/admin/logs', name: 'admin-logs.png' },
    { path: '/admin/dict', name: 'admin-dict.png' },
    { path: '/admin/members', name: 'admin-members.png' },
    { path: '/admin/accounts', name: 'admin-accounts.png' },
  ]) {
    await page.goto(item.path);
    await expect(page.locator('.shell-inner')).toBeVisible();
    await shot(page, item.name);
  }
});

test('平台用户安全设置 UI 截图', async ({ page }) => {
  await login(page, ACCOUNTS.coach2.account, ACCOUNTS.coach2.password);
  await page.goto('/app/profile');
  await expect(page.getByText('安全设置')).toBeVisible();
  await shot(page, 'platform-profile.png');

  await page.getByTestId('security-change-email').click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'platform-change-email.png');
});
