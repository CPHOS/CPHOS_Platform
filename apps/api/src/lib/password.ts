import { Algorithm, hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB（OWASP 推荐档位）
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
