const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const error = (description: string) => ({ description, content: json(ref('Error')) });
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  description: 'Required custom header for CSRF protection. Browser Origin must be allowlisted.',
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const tokenResponse = {
  description: 'Success. Refresh token is set only in the HttpOnly cookie.',
  headers: {
    'Set-Cookie': {
      schema: { type: 'string' },
      description:
        'innvyra_refresh; HttpOnly; Path=/api/v1/auth; SameSite per configuration; Secure in production',
    },
  },
  content: json({
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: {
        type: 'object',
        required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
        properties: {
          accessToken: { type: 'string' },
          tokenType: { type: 'string', enum: ['Bearer'] },
          expiresIn: { type: 'integer', example: 900 },
          user: ref('CurrentUser'),
        },
      },
    },
  }),
};
const emptySuccess = {
  description: 'Success',
  content: json({
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: { type: 'object' },
    },
  }),
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Innvyra PMS Authentication API',
    version: '1.0.0',
    description:
      'Staff authentication and RBAC. No public registration. IDs are decimal strings. Login/refresh/logout require X-CSRF-Protection: 1. Browser clients must use credentials: include. Refresh sessions have an absolute lifetime (default 7 days); rotation does not extend it. Serialize refresh requests: reuse revokes the entire session. For Swagger Try it out, add this API origin to CORS_ORIGINS.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [{ name: 'Authentication' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'innvyra_refresh',
        description:
          'Automatically managed by the browser/Postman cookie jar; never readable by JavaScript.',
      },
    },
    schemas: {
      CurrentUser: {
        type: 'object',
        required: ['id', 'fullName', 'username', 'email', 'role', 'hotelId', 'isActive'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', example: '1' },
          fullName: { type: 'string', example: 'System Administrator' },
          username: { type: 'string', example: 'admin' },
          email: { type: 'string', nullable: true },
          role: {
            type: 'string',
            enum: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'TECHNICIAN'],
          },
          hotelId: { type: 'string', pattern: '^[0-9]+$', example: '1' },
          isActive: { type: 'boolean' },
        },
      },
      Error: {
        type: 'object',
        required: ['success', 'message', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          message: { type: 'string' },
          error: {
            type: 'object',
            required: ['code'],
            properties: {
              code: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { path: { type: 'string' }, message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Create a staff session',
        security: [],
        parameters: [csrf],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            additionalProperties: false,
            required: ['username', 'password'],
            properties: {
              username: { type: 'string', minLength: 3, maxLength: 64, example: 'admin' },
              password: { type: 'string', format: 'password', maxLength: 128 },
            },
          }),
        },
        responses: {
          200: tokenResponse,
          400: error('Malformed JSON'),
          401: error('Invalid credentials or inactive account'),
          403: error('CSRF / Origin rejected, or unknown role'),
          413: error('Body too large'),
          422: error('Validation failed'),
          429: error('Too many login attempts'),
          500: error('Internal server error'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate the refresh token',
        security: [{ refreshCookie: [] }],
        parameters: [csrf],
        description:
          'No request body. Old tokens are single-use. Replaying a consumed token revokes the session, including all access tokens. A concurrent refresh can revoke the session; clients must coordinate refresh calls.',
        responses: {
          200: tokenResponse,
          401: error('Missing, invalid, expired, revoked, or reused token'),
          403: error('CSRF / Origin rejected, or unknown role'),
          429: error('Refresh rate limited'),
          500: error('Internal server error'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke the current session',
        security: [{ bearerAuth: [] }],
        parameters: [csrf],
        description:
          'Requires an unexpired access token. Clears the refresh cookie and invalidates this session immediately. Refresh first if the access token expired.',
        responses: {
          200: {
            ...emptySuccess,
            headers: {
              'Set-Cookie': {
                description: 'Clears the refresh cookie',
                schema: { type: 'string' },
              },
            },
          },
          401: error('Unauthorized'),
          403: error('CSRF / Origin rejected'),
          500: error('Internal server error'),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current server-side user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user',
            content: json({
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [true] },
                message: { type: 'string' },
                data: ref('CurrentUser'),
              },
            }),
          },
          401: error('Unauthorized, inactive user or revoked session'),
          403: error('Unknown role'),
          500: error('Internal server error'),
        },
      },
    },
    '/auth/admin-check': {
      get: {
        tags: ['Authentication'],
        summary: 'Require the current ADMIN role',
        security: [{ bearerAuth: [] }],
        responses: {
          200: emptySuccess,
          401: error('Unauthorized'),
          403: error('ADMIN role required'),
          500: error('Internal server error'),
        },
      },
    },
  },
};
