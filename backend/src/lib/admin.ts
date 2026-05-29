export const ADMIN_USERNAME = 'admin';
export const ADMIN_DEFAULT_PASSWORD = 'Aq123456';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function isAsciiUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}
