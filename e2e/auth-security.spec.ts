import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './accounts';
import { login, waitForEmailCode } from './helpers';

/** 账号安全闭环：忘记密码 / 修改密码 / 换绑邮箱 */
test.describe.serial('账号安全', () => {
  test('忘记密码：邮箱验证码重置后可用新密码登录', async ({ page }) => {
    const newPassword = 'E2eReset456!';
    await page.goto('/forgot-password');
    await page.getByPlaceholder('注册邮箱').fill(ACCOUNTS.reset.account);
    await page.getByRole('button', { name: '发送重置验证码' }).click();
    await expect(page.getByText(/验证码已发送至/)).toBeVisible();

    const code = await waitForEmailCode(ACCOUNTS.reset.account);
    await page.getByPlaceholder('6 位验证码').fill(code);
    await page.getByPlaceholder('新密码（至少 8 位）').fill(newPassword);
    await page.getByPlaceholder('确认新密码').fill(newPassword);
    await page.getByRole('button', { name: '重置密码' }).click();
    await expect(page).toHaveURL(/\/login/);

    await login(page, ACCOUNTS.reset.account, newPassword);
    await expect(page).toHaveURL(/\/app/);
  });

  test('注册中断后：同一邮箱可重新注册、更新密码并完成验证', async ({ page }) => {
    const suffix = String(Date.now()).slice(-6);
    const email = 'e2e.fresh' + suffix + '@example.com';
    const secondPassword = 'E2eFresh123!';

    // 第一次只注册、不验证，随后模拟退出重开
    await page.goto('/register');
    await page.getByPlaceholder('邮箱（登录账号）').fill(email);
    await page.getByPlaceholder('密码（至少 8 位）').fill(secondPassword);
    await page.getByPlaceholder('确认密码').fill(secondPassword);
    await page.getByRole('button', { name: '注册并发送验证码' }).click();
    await expect(page.getByText(new RegExp('验证码已发送至 ' + email))).toBeVisible();

    await page.goto('/login');
    await page.goto('/register');

    // 同一未验证邮箱允许重新注册，并以新密码继续
    await page.getByPlaceholder('邮箱（登录账号）').fill(email);
    await page.getByPlaceholder('密码（至少 8 位）').fill(secondPassword);
    await page.getByPlaceholder('确认密码').fill(secondPassword);
    await page.getByRole('button', { name: '注册并发送验证码' }).click();
    await expect(page.getByText(new RegExp('验证码已发送至 ' + email))).toBeVisible();

    const code = await waitForEmailCode(email);
    await page.getByPlaceholder('6 位验证码').fill(code);
    await page.getByRole('button', { name: '完成验证' }).click();
    await expect(page).toHaveURL(/\/login/);

    await login(page, email, secondPassword);
    await expect(page).toHaveURL(/\/app/);
  });

  test('修改密码：校验当前密码并在成功后强制重新登录', async ({ page }) => {
    const newPassword = 'E2eCoach456!';
    await login(page, ACCOUNTS.coach.account, ACCOUNTS.coach.password);
    await page.goto('/app/profile');

    await page.getByLabel('当前密码').fill(ACCOUNTS.coach.password);
    await page.getByLabel('新密码', { exact: true }).fill(newPassword);
    await page.getByLabel('确认新密码').fill(newPassword);
    await page.getByTestId('security-save-password').click();
    await expect(page).toHaveURL(/\/login/);

    await login(page, ACCOUNTS.coach.account, newPassword);
    await expect(page).toHaveURL(/\/app/);
  });

  test('换绑邮箱：向新邮箱发码并完成绑定', async ({ page }) => {
    const newEmail = 'e2e.email.new@example.com';
    await login(page, ACCOUNTS.email.account, ACCOUNTS.email.password);
    await page.goto('/app/profile');

    await page.getByTestId('security-change-email').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('新邮箱').fill(newEmail);
    await dialog.getByTestId('email-change-current-password').fill(ACCOUNTS.email.password);
    await dialog.getByRole('button', { name: '发送验证码' }).click();
    await expect(dialog.getByText(/验证码已发送至/)).toBeVisible();

    const code = await waitForEmailCode(newEmail);
    await dialog.getByLabel('邮箱验证码').fill(code);
    await dialog.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('当前邮箱：' + newEmail)).toBeVisible();
  });
});
