import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login } from './helpers';

async function confirmModal(page: Parameters<typeof login>[0]): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
}

/** 阶段 A 后台：团队管理、审计日志、字典维护 */
test.describe.serial('阶段A后台管理', () => {
  test('团队创建/成员管理 → 审计日志留痕', async ({ page }) => {
    await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
    await page.goto('/admin/teams');

    const suffix = String(Date.now()).slice(-6);
    const teamName = 'E2E团队' + suffix;

    await page.getByTestId('team-create-button').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('团队名称').fill(teamName);
    await dialog.locator('#leaderUserId').click();
    await page.locator('.ant-select-dropdown:visible').getByText('教练甲').first().click();
    await dialog.locator('#memberUserIds').click();
    await dialog.locator('#memberUserIds').pressSequentially('教练乙', { delay: 50 });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await confirmModal(page);

    const row = page.getByRole('row', { name: new RegExp(teamName) });
    await expect(row).toBeVisible();
    await row.getByText('成员').click();
    await expect(page.getByText('团队成员：' + teamName)).toBeVisible();
    await expect(page.getByText('教练甲').first()).toBeVisible();
    await expect(page.getByText('教练乙').first()).toBeVisible();

    const memberItem = page.getByRole('listitem').filter({ hasText: '教练乙' });
    await memberItem.getByText('移出').click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByRole('listitem').filter({ hasText: '教练乙' })).toHaveCount(0);

    // 审计日志应出现创建团队记录（按团队名过滤，避免并行用例刷出第一页）
    await page.goto('/admin/logs');
    await page.getByPlaceholder('备注 / 关联账号编号').fill(teamName);
    await page.getByPlaceholder('备注 / 关联账号编号').press('Enter');
    await expect(page.getByText('创建团队').first()).toBeVisible();
    await expect(page.getByText(new RegExp(teamName)).first()).toBeVisible();

    // 删除团队
    await page.goto('/admin/teams');
    await page.getByRole('row', { name: new RegExp(teamName) }).getByText('删除').click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByRole('row', { name: new RegExp(teamName) })).toHaveCount(0);
  });

  test('字典维护：赛区/学校新增、引用保护与删除', async ({ page }) => {
    await login(page, ACCOUNTS.admin.account, ACCOUNTS.admin.password);
    await page.goto('/admin/dict');

    const suffix = String(Date.now()).slice(-6);
    const areaName = 'E2E赛区' + suffix;
    const schoolName = 'E2E学校' + suffix;

    // 新增赛区
    await page.getByTestId('dict-add-area').click();
    await page.getByRole('dialog').getByLabel('名称').fill(areaName);
    await confirmModal(page);
    await expect(page.getByRole('cell', { name: areaName })).toBeVisible();

    // 新增学校
    await page.getByRole('tab', { name: '学校' }).click();
    await page.getByTestId('dict-add-school').click();
    const schoolDialog = page.getByRole('dialog');
    await schoolDialog.locator('#areaId').click();
    await schoolDialog.locator('#areaId').pressSequentially(areaName, { delay: 30 });
    await page.keyboard.press('Enter');
    await schoolDialog.getByLabel('学校名称').fill(schoolName);
    await confirmModal(page);
    await expect(page.getByRole('cell', { name: schoolName })).toBeVisible();

    // 有学校引用的赛区删除应被拒绝
    await page.getByRole('tab', { name: '赛区' }).click();
    const areaRow = page.getByRole('row', { name: new RegExp(areaName) });
    await areaRow.getByText('删除').click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByText('该字典项已被引用，不能删除')).toBeVisible();

    // 删除学校后赛区可删除
    await page.getByRole('tab', { name: '学校' }).click();
    const schoolRow = page.getByRole('row', { name: new RegExp(schoolName) });
    await schoolRow.getByText('删除').click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByRole('cell', { name: schoolName })).toHaveCount(0);

    await page.getByRole('tab', { name: '赛区' }).click();
    await areaRow.getByText('删除').click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByRole('cell', { name: areaName })).toHaveCount(0);

    // 字典增删必须写入审计日志
    await page.goto('/admin/logs');
    await page.getByPlaceholder('备注 / 关联账号编号').fill(areaName);
    await page.getByPlaceholder('备注 / 关联账号编号').press('Enter');
    await expect(page.getByText('新增字典项').first()).toBeVisible();
    await expect(page.getByText('删除字典项').first()).toBeVisible();
  });
});
