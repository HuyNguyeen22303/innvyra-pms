import type { RequestHandler } from 'express';
import type { Env } from '../../config/env.js';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from '../../shared/utils/cookies.js';
import type { AuthService } from './auth.service.js';
import type { LoginInput } from './auth.schema.js';
import { AppError } from '../../shared/errors/app-error.js';

export function authController(service: AuthService, env: Env) {
  const login: RequestHandler = async (_req, res) => {
    const { body } = res.locals.validated as { body: LoginInput };
    const result = await service.login(body);
    setRefreshCookie(res, env, result.refreshToken, result.expiresAt);
    res.json({ success: true, message: 'Login successfully', data: result.data });
  };
  const refresh: RequestHandler = async (req, res) => {
    try {
      const cookies = req.cookies as Record<string, unknown> | undefined;
      const result = await service.refresh(cookies?.[REFRESH_COOKIE]);
      setRefreshCookie(res, env, result.refreshToken, result.expiresAt);
      res.json({ success: true, message: 'Token refreshed successfully', data: result.data });
    } catch (error) {
      if (error instanceof AppError && [401, 403].includes(error.status))
        clearRefreshCookie(res, env);
      throw error;
    }
  };
  const logout: RequestHandler = async (req, res) => {
    await service.logout(requirePrincipal(req));
    clearRefreshCookie(res, env);
    res.json({ success: true, message: 'Logout successfully', data: {} });
  };
  const me: RequestHandler = (req, res) => {
    res.json({
      success: true,
      message: 'Get current user successfully',
      data: requirePrincipal(req).user,
    });
  };
  const adminCheck: RequestHandler = (_req, res) => {
    res.json({ success: true, message: 'Admin access granted', data: {} });
  };
  return { login, refresh, logout, me, adminCheck };
}
