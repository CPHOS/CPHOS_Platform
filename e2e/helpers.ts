import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/** Playwright 从仓库根目录运行（pnpm e2e），直接以 cwd 作为项目根 */
export const PROJECT_ROOT = process.cwd();

/** UI 登录并等待离开登录页 */
export async function login(page: Page, account: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('邮箱或用户名').fill(account);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** 从开发邮件文件读取某邮箱最新验证码（仅 dev SMTP 未配置时可用） */
export function readEmailCode(email: string): string {
  const dir = path.join(PROJECT_ROOT, 'apps', 'api', '.devmail');
  const safe = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const suffix = '-' + safe + '.json';
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
  if (files.length === 0) throw new Error('devmail not found for ' + email);
  const raw = fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8');
  const mail = JSON.parse(raw) as { text?: string; html?: string };
  const source = (mail.text ?? '') + ' ' + (mail.html ?? '');
  const match = source.match(/\b(\d{6})\b/);
  if (!match) throw new Error('no 6-digit code in mail for ' + email);
  return match[1];
}

/** 轮询等待新验证码（发送邮件为异步落盘） */
export async function waitForEmailCode(email: string): Promise<string> {
  let code = '';
  await expect
    .poll(
      () => {
        try {
          code = readEmailCode(email);
          return code;
        } catch {
          return '';
        }
      },
      { timeout: 15_000, intervals: [500, 1000] },
    )
    .not.toBe('');
  return code;
}
