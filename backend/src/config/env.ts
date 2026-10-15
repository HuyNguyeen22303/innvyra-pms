import { z } from 'zod';

const origin = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    } catch {
      return false;
    }
  }, 'Use an exact http(s) origin without a path or trailing slash');
const boolean = z.enum(['true', 'false']).transform((value) => value === 'true');

export const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'mysql:' &&
        !!url.hostname &&
        !!url.username &&
        /^\/[A-Za-z0-9_]+$/.test(url.pathname) &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, 'Use mysql://USER:PASSWORD@HOST:PORT/DATABASE; configure TLS separately');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: databaseUrlSchema,
    DATABASE_SSL: boolean.default(false),
    DATABASE_SSL_CA_FILE: z.string().default(''),
    JWT_ACCESS_SECRET: z
      .string()
      .min(43)
      .refine(
        (value) => new Set(value).size >= 16,
        'Use a randomly generated secret with at least 256 bits of entropy',
      ),
    JWT_ISSUER: z.string().min(1).default('innvyra-pms'),
    JWT_AUDIENCE: z.string().min(1).default('innvyra-pms-api'),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(/^[1-9]\d*[smh]$/)
      .default('15m'),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    FRONTEND_URL: origin.default('http://localhost:5173'),
    CORS_ORIGINS: z.string().default(''),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    COOKIE_SECURE: boolean.optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
    REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
    RESERVATION_MAX_NIGHTS: z.coerce.number().int().min(1).max(366).default(30),
    RESERVATION_MAX_ROOMS: z.coerce.number().int().min(1).max(100).default(20),
    REPORT_MAX_DAYS: z.coerce.number().int().min(1).max(366).default(366),
    REPORT_EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(1000).default(366),
    GUEST_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/)
        .optional(),
    ),
    GUEST_HASH_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/)
        .optional(),
    ),
  })
  .transform((value) => ({
    ...value,
    COOKIE_SECURE: value.COOKIE_SECURE ?? value.NODE_ENV === 'production',
    allowedOrigins: [
      ...new Set([
        value.FRONTEND_URL,
        ...value.CORS_ORIGINS.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ]),
    ],
    accessTokenTtlSeconds:
      Number(value.JWT_ACCESS_EXPIRES_IN.slice(0, -1)) *
      ({ s: 1, m: 60, h: 3600 }[value.JWT_ACCESS_EXPIRES_IN.slice(-1)] ?? 0),
  }))
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!!value.GUEST_ENCRYPTION_KEY !== !!value.GUEST_HASH_KEY)
      issue('GUEST_ENCRYPTION_KEY', 'Configure both guest protection keys or neither');
    if (
      value.GUEST_ENCRYPTION_KEY &&
      value.GUEST_ENCRYPTION_KEY.toLowerCase() === value.GUEST_HASH_KEY?.toLowerCase()
    )
      issue('GUEST_HASH_KEY', 'Use independent guest encryption and hashing keys');
    for (const allowed of value.allowedOrigins) {
      if (!origin.safeParse(allowed).success)
        issue('CORS_ORIGINS', 'Every entry must be an exact http(s) origin');
    }
    if (
      (value.NODE_ENV === 'production' || value.COOKIE_SAME_SITE === 'none') &&
      !value.COOKIE_SECURE
    ) {
      issue('COOKIE_SECURE', 'Secure cookies are required in production and with SameSite=None');
    }
    if (
      value.NODE_ENV === 'production' &&
      value.allowedOrigins.some((url) => !url.startsWith('https://'))
    ) {
      issue('CORS_ORIGINS', 'Production browser origins must use HTTPS');
    }
    if (value.accessTokenTtlSeconds > 3600)
      issue('JWT_ACCESS_EXPIRES_IN', 'Access tokens must expire within one hour');
    if (value.DATABASE_SSL_CA_FILE && !value.DATABASE_SSL)
      issue('DATABASE_SSL', 'Enable TLS when supplying a CA');
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Do not include input values: environment variables contain credentials.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return result.data;
}
