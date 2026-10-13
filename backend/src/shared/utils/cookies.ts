import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env.js';

export const REFRESH_COOKIE = 'innvyra_refresh';
export function refreshCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/v1/auth',
  };
}
export function setRefreshCookie(res: Response, env: Env, token: string, expires: Date): void {
  res.cookie(REFRESH_COOKIE, token, { ...refreshCookieOptions(env), expires });
}
export function clearRefreshCookie(res: Response, env: Env): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(env));
}
