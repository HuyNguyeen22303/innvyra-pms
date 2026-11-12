import request, { type Response } from 'supertest';
import type { Express } from 'express';
import type { CurrentUser } from '../../src/modules/auth/auth.types.js';

// Public, synthetic fixture credentials. Never used against application databases.
export const PHASE6_PASSWORD = 'Phase6 verified hotel access 2026!';
export const PHASE6_INITIAL_PASSWORD = 'Phase6 initial varied password 2026!';
export interface ScenarioSession {
  accessToken: string;
  refreshCookie: string;
  user: CurrentUser;
}
export type Method = 'get' | 'post' | 'patch' | 'delete';
export class ScenarioHttp {
  constructor(
    readonly app: Express,
    private readonly activePassword = PHASE6_PASSWORD,
  ) {}
  request(
    method: Method,
    path: string,
    options: {
      token?: string;
      body?: object;
      cookie?: string;
      key?: string;
      csrf?: boolean;
    } = {},
  ) {
    const call = request(this.app)[method](`/api/v1${path}`);
    if (options.token) call.auth(options.token, { type: 'bearer' });
    if (method !== 'get' && options.csrf !== false) call.set('X-CSRF-Protection', '1');
    if (options.cookie) call.set('Cookie', options.cookie);
    if (options.key) call.set('Idempotency-Key', options.key);
    if (options.body) call.send(options.body);
    return call;
  }
  async ok<T>(
    method: Method,
    path: string,
    token?: string,
    body?: object,
    expected = 200,
    key?: string,
  ): Promise<T> {
    const response = await this.request(method, path, {
      ...(token ? { token } : {}),
      ...(body ? { body } : {}),
      ...(key ? { key } : {}),
    });
    if (response.status !== expected) {
      // Auth responses can carry passwords/tokens. Report only route/status/error code.
      const code = String(response.body?.error?.code ?? 'UNKNOWN');
      throw new Error(
        `Phase 6: ${method.toUpperCase()} ${path.split('?')[0]} expected ${expected}, got ${response.status} (${code})`,
      );
    }
    return response.body.data as T;
  }
  async login(username: string, password = this.activePassword): Promise<ScenarioSession> {
    const response = await this.request('post', '/auth/login', { body: { username, password } });
    if (response.status !== 200)
      throw new Error(`Phase 6 fixture login failed (${response.status})`);
    return { ...response.body.data, refreshCookie: cookie(response) } as ScenarioSession;
  }
  async activatePassword(username: string, initial: string) {
    const session = await this.login(username, initial);
    await this.ok('post', '/auth/change-password', session.accessToken, {
      currentPassword: initial,
      newPassword: this.activePassword,
    });
    return this.login(username);
  }
}
export function cookie(response: Response) {
  const value = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(
    ';',
  )[0];
  if (!value) throw new Error('Phase 6 fixture refresh cookie missing');
  return value;
}
