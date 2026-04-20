import argon2 from "argon2";
import { validatePasswordPolicy } from "./password-policy";

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

function getPepper(): string {
  return process.env.PASSWORD_PEPPER || "";
}

export { validatePasswordPolicy };

export async function hashPasswordArgon2id(password: string): Promise<string> {
  const peppered = `${password}${getPepper()}`;
  return argon2.hash(peppered, ARGON2_OPTIONS);
}

export async function verifyPasswordArgon2id(password: string, hash: string): Promise<boolean> {
  const peppered = `${password}${getPepper()}`;
  return argon2.verify(hash, peppered);
}
