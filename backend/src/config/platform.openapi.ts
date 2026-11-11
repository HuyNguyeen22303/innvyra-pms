const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const error = (description: string) => ({ description, content: json(ref('Error')) });
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'] },
};
const protectedSecurity = [{ platformBearerAuth: [] }];
const empty = {
  description: 'Success',
  content: json({
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: { type: 'object' },
    },
  }),
};
const tokens = {
  description:
    'Platform access token and safe profile; refresh token is only in its own HttpOnly cookie.',
  headers: {
    'Set-Cookie': {
      schema: { type: 'string' },
      description:
        'innvyra_platform_refresh; HttpOnly; Path=/api/v1/platform/auth; Secure in production',
    },
  },
  content: json({
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: ref('PlatformAuthTokens'),
    },
  }),
};
const commonErrors = {
  401: error('Missing, expired, revoked, inactive or wrong-realm credentials'),
  403: error('CSRF or origin rejected'),
  429: error('Rate limit exceeded'),
  500: error('Internal server error'),
};
const password = {
  type: 'string',
  format: 'password',
  minLength: 15,
  maxLength: 128,
  description: 'At least 15 non-padding characters and 8 distinct characters.',
};

export const platformSchemas = {
  CurrentPlatformAdmin: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'email', 'fullName', 'role', 'isActive'],
    properties: {
      id: { type: 'string', pattern: '^[1-9][0-9]*$' },
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      role: { type: 'string', enum: ['PLATFORM_ADMIN'] },
      isActive: { type: 'boolean' },
    },
  },
  PlatformAuthTokens: {
    type: 'object',
    required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
    properties: {
      accessToken: { type: 'string' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: { type: 'integer', example: 900 },
      user: ref('CurrentPlatformAdmin'),
    },
  },
  PlatformLoginInput: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 191 },
      password: { type: 'string', format: 'password', minLength: 1, maxLength: 128 },
    },
  },
  PlatformChangePasswordInput: {
    type: 'object',
    additionalProperties: false,
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', format: 'password', minLength: 1, maxLength: 128 },
      newPassword: password,
    },
  },
};
export const platformPaths = {
  '/platform/auth/login': {
    post: {
      tags: ['Platform Authentication'],
      summary: 'Sign in to the Innvyra platform',
      security: [],
      parameters: [csrf],
      description:
        'Uses platform_admins only. Email is normalized; passwords are not trimmed. No hotel or role is accepted from the client.',
      requestBody: { required: true, content: json(ref('PlatformLoginInput')) },
      responses: {
        200: tokens,
        422: error('Invalid email/password input or extra fields'),
        ...commonErrors,
      },
    },
  },
  '/platform/auth/refresh': {
    post: {
      tags: ['Platform Authentication'],
      summary: 'Rotate the platform refresh token',
      parameters: [csrf],
      security: [{ platformRefreshCookie: [] }],
      description:
        'Uses only innvyra_platform_refresh. Rotation keeps the absolute session expiry. Reuse revokes the entire platform session.',
      responses: { 200: tokens, ...commonErrors },
    },
  },
  '/platform/auth/me': {
    get: {
      tags: ['Platform Authentication'],
      summary: 'Get the current platform administrator',
      security: protectedSecurity,
      description:
        'Required role: PLATFORM_ADMIN. Checked against the current active server-side platform session; hotel credentials are rejected.',
      responses: {
        200: {
          description: 'Current platform administrator',
          content: json({
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean', enum: [true] },
              data: ref('CurrentPlatformAdmin'),
            },
          }),
        },
        401: commonErrors[401],
        500: commonErrors[500],
      },
    },
  },
  '/platform/auth/logout': {
    post: {
      tags: ['Platform Authentication'],
      summary: 'Revoke the current platform session',
      security: protectedSecurity,
      parameters: [csrf],
      description:
        'Required role: PLATFORM_ADMIN. Clears only the platform cookie; hotel sessions are unaffected.',
      responses: { 200: empty, ...commonErrors },
    },
  },
  '/platform/auth/change-password': {
    post: {
      tags: ['Platform Authentication'],
      summary: 'Change the platform password and revoke all platform sessions',
      security: protectedSecurity,
      parameters: [csrf],
      description:
        'Required role: PLATFORM_ADMIN. Requires the current password and a different strong password. Atomically revokes all platform sessions, clears the cookie and requires a fresh login.',
      requestBody: { required: true, content: json(ref('PlatformChangePasswordInput')) },
      responses: {
        200: empty,
        400: error('Current password is incorrect'),
        409: error('Password changed concurrently; sign in again'),
        422: error('Password policy or extra fields rejected'),
        ...commonErrors,
      },
    },
  },
};
