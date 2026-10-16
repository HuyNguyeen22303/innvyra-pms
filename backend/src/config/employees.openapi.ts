import { employeePermissions } from '../modules/employees/employee.types.js';
import { ROLE_CODES } from '../shared/types/roles.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, example?: object) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});
const error = (description: string) => ({ description, content: json(ref('Error')) });
const id = {
  type: 'string',
  pattern: '^[1-9][0-9]{0,19}$',
  description: 'Unsigned BIGINT decimal string',
  example: '10',
};
const timestamp = { type: 'string', format: 'date-time' };

const employeeFields = {
  id,
  fullName: { type: 'string', minLength: 1, maxLength: 191 },
  username: { type: 'string', minLength: 3, maxLength: 64 },
  email: { type: 'string', format: 'email', nullable: true, maxLength: 191 },
  role: { type: 'string', enum: [...ROLE_CODES] },
  isActive: { type: 'boolean' },
  createdAt: timestamp,
};

const employeeExample = {
  id: '10',
  fullName: 'Nguyễn Minh Anh',
  username: 'minhanh',
  email: 'minhanh@example.test',
  role: 'RECEPTIONIST',
  isActive: true,
  createdAt: '2026-10-16T00:00:00.000Z',
};

const envelope = (data: object) => ({
  type: 'object',
  required: ['success', 'message', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data,
  },
});

export const employeeSchemas = {
  CreateEmployee: {
    type: 'object',
    additionalProperties: false,
    required: ['fullName', 'username', 'password', 'role'],
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 191 },
      username: { type: 'string', minLength: 3, maxLength: 64, pattern: '^[a-z0-9._-]+$' },
      email: { type: 'string', format: 'email', nullable: true, maxLength: 191 },
      password: { type: 'string', format: 'password', minLength: 15, maxLength: 128 },
      role: { type: 'string', enum: [...ROLE_CODES] },
    },
  },
  UpdateEmployee: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 191 },
      email: { type: 'string', format: 'email', nullable: true, maxLength: 191 },
      role: { type: 'string', enum: [...ROLE_CODES] },
    },
    description:
      'Only supplied fields change. Username and password cannot be changed through this endpoint.',
  },
  Employee: {
    type: 'object',
    required: Object.keys(employeeExample),
    properties: employeeFields,
    example: employeeExample,
  },
};

const security = [{ bearerAuth: [] }];
const csrf = {
  name: 'X-CSRF-Protection',
  in: 'header',
  required: true,
  schema: { type: 'string', enum: ['1'], default: '1' },
};
const idParam = { name: 'id', in: 'path', required: true, schema: id };
const readRoles = employeePermissions.read.join(', ');
const writeRoles = employeePermissions.write.join(', ');
const readPolicy = `Roles: ${readRoles}. All roles can view employees in their hotel. Data is scoped to the authenticated user's hotel. Cache-Control: no-store.`;
const writePolicy = `Roles: ${writeRoles}. Hotel/actor/role come only from server authentication. Requires X-CSRF-Protection: 1. Role hierarchy enforced: cannot create/edit employees with equal or higher role. MANAGER cannot manage ADMIN accounts.`;

const errors = {
  401: error('Missing/invalid token, revoked session or inactive account'),
  403: error('Role denied, CSRF/Origin rejected, or role hierarchy violation'),
  422: error('VALIDATION_ERROR with path/message details'),
  500: error('Internal server error'),
};
const writeErrors = {
  ...errors,
  400: error('Malformed JSON'),
  413: error('Request exceeds 16kb'),
  409: error(
    'USERNAME_EXISTS, EMAIL_EXISTS, ALREADY_DEACTIVATED, LAST_ADMIN, or CONCURRENT_MODIFICATION',
  ),
};
const notFound = error('EMPLOYEE_NOT_FOUND for missing or other-hotel IDs');
const query = (name: string, schema: object, description: string) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});
const response = (data: object, message: string, sample: object) => ({
  description: message,
  content: json(envelope(data), { success: true, message, data: sample }),
});

export const employeePaths = {
  '/employees': {
    get: {
      tags: ['Employees'],
      summary: 'List employees',
      security,
      description: `${readPolicy} Supports search by name/username/email, filter by role and active status, and paginated sorting.`,
      parameters: [
        query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }, 'Page number'),
        query(
          'limit',
          { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          'Bounded page size',
        ),
        query(
          'search',
          { type: 'string', minLength: 1, maxLength: 191 },
          'Search by fullName, username or email',
        ),
        query('role', { type: 'string', enum: [...ROLE_CODES] }, 'Filter by role'),
        query('isActive', { type: 'boolean' }, 'Filter by active status; omit to include all'),
        query(
          'sortBy',
          { type: 'string', enum: ['fullName', 'createdAt', 'username'], default: 'fullName' },
          'Sort whitelist',
        ),
        query(
          'sortOrder',
          { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          'Sort direction',
        ),
      ],
      responses: {
        ...errors,
        200: response(
          {
            type: 'object',
            required: ['items', 'pagination'],
            properties: {
              items: { type: 'array', items: ref('Employee') },
              pagination: ref('Pagination'),
            },
          },
          'Employees retrieved',
          { items: [employeeExample], pagination: { total: 1, page: 1, limit: 20, totalPages: 1 } },
        ),
      },
    },
    post: {
      tags: ['Employees'],
      summary: 'Create employee',
      security,
      description: `${writePolicy} Password is hashed with Argon2id before storage. Password is never returned.`,
      parameters: [csrf],
      requestBody: {
        required: true,
        content: json(ref('CreateEmployee'), {
          fullName: 'Nguyễn Minh Anh',
          username: 'minhanh',
          email: 'minhanh@example.test',
          password: 'Innvyra@Secure2026!',
          role: 'RECEPTIONIST',
        }),
      },
      responses: {
        ...writeErrors,
        404: error('Hotel not found'),
        201: response(ref('Employee'), 'Employee created', employeeExample),
      },
    },
  },
  '/employees/{id}': {
    patch: {
      tags: ['Employees'],
      summary: 'Update employee',
      security,
      description: `${writePolicy} Only supplied fields are updated. Username and password cannot be changed. Email uniqueness is checked globally.`,
      parameters: [idParam, csrf],
      requestBody: {
        required: true,
        content: json(ref('UpdateEmployee'), { fullName: 'Nguyễn Minh Anh Updated' }),
      },
      responses: {
        ...writeErrors,
        404: notFound,
        200: response(ref('Employee'), 'Employee updated', employeeExample),
      },
    },
  },
  '/employees/{id}/deactivate': {
    patch: {
      tags: ['Employees'],
      summary: 'Deactivate employee',
      security,
      description: `Roles: ${writeRoles}. Soft-disables the account (isActive=false) and revokes all active sessions. Cannot deactivate self. Cannot deactivate the last active ADMIN in the hotel. Role hierarchy enforced. No data is deleted.`,
      parameters: [idParam, csrf],
      responses: {
        ...writeErrors,
        404: notFound,
        200: response(ref('Employee'), 'Employee deactivated', {
          ...employeeExample,
          isActive: false,
        }),
      },
    },
  },
};
