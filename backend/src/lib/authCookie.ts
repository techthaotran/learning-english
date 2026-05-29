import type { Request, Response } from 'express';

export const USER_NAME_COOKIE = 'userName';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function isCrossOriginDeployment(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function buildCookieOptions(maxAgeMs: number): string {
  const parts = [
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'Path=/',
    'HttpOnly',
  ];
  if (isCrossOriginDeployment()) {
    parts.push('SameSite=None', 'Secure');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function getUserNameFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  const value = cookies[USER_NAME_COOKIE]?.trim();
  return value || undefined;
}

export function setUserNameCookie(res: Response, userName: string): void {
  const trimmed = userName.trim();
  res.append(
    'Set-Cookie',
    `${USER_NAME_COOKIE}=${encodeURIComponent(trimmed)}; ${buildCookieOptions(ONE_YEAR_MS)}`
  );
}

export function clearUserNameCookie(res: Response): void {
  res.append(
    'Set-Cookie',
    `${USER_NAME_COOKIE}=; ${buildCookieOptions(0)}`
  );
}
