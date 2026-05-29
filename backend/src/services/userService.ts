import { hashPassword, verifyPassword } from '../lib/password.js';
import { ADMIN_DEFAULT_PASSWORD, ADMIN_USERNAME, isAsciiUsername } from '../lib/admin.js';
import { queryOne, run } from '../db.js';

export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 50;
export const MIN_PASSWORD_LENGTH = 6;

export class DuplicateUsernameError extends Error {
  constructor() {
    super('Username đã tồn tại');
    this.name = 'DuplicateUsernameError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Username hoặc mật khẩu không đúng');
    this.name = 'InvalidCredentialsError';
  }
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username phải có ít nhất ${MIN_USERNAME_LENGTH} ký tự`;
  }
  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return `Username không được quá ${MAX_USERNAME_LENGTH} ký tự`;
  }
  if (/\s/.test(trimmed)) {
    return 'Username không được chứa khoảng trắng';
  }
  if (!isAsciiUsername(trimmed)) {
    return 'Username chỉ được chứa chữ cái không dấu, số và dấu gạch dưới';
  }
  if (trimmed.toLowerCase() === ADMIN_USERNAME) {
    return 'Username này đã được bảo lưu';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  return null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE username = ? COLLATE NOCASE`,
    [username.trim()]
  );
  return row != null;
}

export async function getUserIdByUsername(username: string): Promise<number | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE username = ? COLLATE NOCASE`,
    [trimmed]
  );
  return row?.id ?? null;
}

export async function isAdminUser(username: string): Promise<boolean> {
  const row = await queryOne<{ is_admin: number }>(
    `SELECT is_admin FROM users WHERE username = ? COLLATE NOCASE`,
    [username.trim()]
  );
  return row?.is_admin === 1;
}

export async function seedAdminUser(): Promise<void> {
  const existing = await queryOne<{ id: number; is_admin: number }>(
    `SELECT id, is_admin FROM users WHERE username = ? COLLATE NOCASE`,
    [ADMIN_USERNAME]
  );
  if (existing) {
    if (existing.is_admin !== 1) {
      await run(`UPDATE users SET is_admin = 1 WHERE id = ?`, [existing.id]);
    }
    return;
  }

  const passwordHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);
  await run(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)`, [
    ADMIN_USERNAME,
    passwordHash,
  ]);
}

export async function registerUser(username: string, password: string): Promise<string> {
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const trimmed = username.trim();
  if (await isUsernameTaken(trimmed)) {
    throw new DuplicateUsernameError();
  }

  const passwordHash = await hashPassword(password);
  await run(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)`, [
    trimmed,
    passwordHash,
  ]);

  return trimmed;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<string> {
  const trimmed = username.trim();
  if (!trimmed || !password) throw new InvalidCredentialsError();

  const row = await queryOne<UserRow>(
    `SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE`,
    [trimmed]
  );
  if (!row) throw new InvalidCredentialsError();

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) throw new InvalidCredentialsError();

  return row.username;
}
