import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../env.js';

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  transporter = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * 发信策略：
 * - 配置了 SMTP_* → 真实发信（生产/联调）
 * - 未配置（开发默认）→ 写入 apps/api/.devmail/*.json 并在日志打印主题，
 *   验证码可在邮件内容中直接看到，便于本地联调。
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  const t = getTransporter();
  if (t) {
    await t.sendMail({ from: env.SMTP_FROM, ...payload });
    return;
  }
  const dir = path.resolve(process.cwd(), '.devmail');
  fs.mkdirSync(dir, { recursive: true });
  const safe = payload.to.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const file = path.join(dir, `${Date.now()}-${safe}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`[devmail] to=${payload.to} subject=${payload.subject} file=${file}`);
}

export function renderCodeEmail(code: string): MailPayload {
  return {
    to: '',
    subject: '【CPHOS】邮箱验证码',
    text: `您的验证码是 ${code}，10 分钟内有效。如非本人操作请忽略本邮件。`,
    html: `<p>您的验证码是 <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>10 分钟内有效。如非本人操作请忽略本邮件。</p>`,
  };
}
