import { randomBytes } from 'node:crypto';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../../shared/utils/password.js';
import { pageResult } from '../../shared/validation/room-input.js';

export function generateTemporaryPassword(): string {
  while (true) {
    const candidate = randomBytes(18).toString('base64url');
    if (candidate.length >= 15 && new Set(candidate).size >= 8) {
      return candidate;
    }
  }
}
import {
  employeePermissions,
  ROLE_HIERARCHY,
  type EmployeeQuery,
  type EmployeeRepository,
  type EmployeeScope,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from './employee.types.js';

const missing = () => new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

function toResponse(staff: {
  id: bigint;
  fullName: string;
  username: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  role: { code: string; name?: string };
}) {
  return {
    id: staff.id.toString(),
    fullName: staff.fullName,
    username: staff.username,
    email: staff.email,
    role: staff.role.code,
    isActive: staff.isActive,
    createdAt: staff.createdAt,
  };
}

export class EmployeeService {
  constructor(private readonly repository: EmployeeRepository) {}

  private authorize(scope: EmployeeScope, permission: keyof typeof employeePermissions) {
    if (!(employeePermissions[permission] as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  private checkRoleHierarchy(actorRole: string, targetRoleCode: string) {
    if (actorRole === 'ADMIN') return;
    const actorLevel = ROLE_HIERARCHY[actorRole as keyof typeof ROLE_HIERARCHY] ?? 0;
    const targetLevel = ROLE_HIERARCHY[targetRoleCode as keyof typeof ROLE_HIERARCHY] ?? 0;
    if (targetLevel >= actorLevel)
      throw new AppError(403, 'FORBIDDEN', 'Cannot manage an employee with equal or higher role');
  }

  async createEmployee(scope: EmployeeScope, input: CreateEmployeeInput) {
    this.authorize(scope, 'write');
    this.checkRoleHierarchy(scope.role, input.role);

    const passwordHash = await hashPassword(input.password);

    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      // Resolve roleId from role code
      const role = await repository.findRoleByCode(input.role);
      if (!role) throw new AppError(422, 'INVALID_ROLE', 'Invalid role');

      // Check username uniqueness (global)
      const existingUsername = await repository.findByUsername(input.username);
      if (existingUsername) throw new AppError(409, 'USERNAME_EXISTS', 'Username already exists');

      // Check email uniqueness (global) if provided
      if (input.email) {
        const existingEmail = await repository.findByEmail(input.email);
        if (existingEmail) throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
      }

      const record = await repository.create({
        hotelId: scope.hotelId,
        roleId: role.id,
        fullName: input.fullName,
        username: input.username,
        email: input.email ?? null,
        passwordHash,
      });

      return toResponse(record);
    });
  }

  async updateEmployee(scope: EmployeeScope, id: bigint, input: UpdateEmployeeInput) {
    this.authorize(scope, 'write');

    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw missing();

      // Check actor can manage this employee's current role
      this.checkRoleHierarchy(scope.role, record.role.code);

      // If changing role, check hierarchy for new role too
      if (input.role) {
        this.checkRoleHierarchy(scope.role, input.role);
      }

      // Build update data - explicit allowlist
      const data: Record<string, unknown> = {};
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.email !== undefined) {
        // Check email uniqueness if changing
        if (input.email !== null && input.email !== record.email) {
          const existing = await repository.findByEmail(input.email);
          if (existing && existing.id !== record.id)
            throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
        }
        data.email = input.email;
      }
      if (input.role !== undefined) {
        const role = await repository.findRoleByCode(input.role);
        if (!role) throw new AppError(422, 'INVALID_ROLE', 'Invalid role');
        data.role = { connect: { id: role.id } };
      }

      const updated = await repository.update(scope.hotelId, id, data);
      return toResponse(updated);
    });
  }

  async deactivateEmployee(scope: EmployeeScope, id: bigint) {
    this.authorize(scope, 'deactivate');

    // Cannot deactivate self
    if (scope.actorId === id)
      throw new AppError(403, 'FORBIDDEN', 'Cannot deactivate your own account');

    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw missing();

      // Check actor can manage this employee's role
      this.checkRoleHierarchy(scope.role, record.role.code);

      // Already deactivated
      if (!record.isActive)
        throw new AppError(409, 'ALREADY_DEACTIVATED', 'Employee is already deactivated');

      // Protect last active admin in hotel
      if (record.role.code === 'ADMIN') {
        const activeAdminCount = await repository.countActiveByRoleInHotel(scope.hotelId, 'ADMIN');
        if (activeAdminCount <= 1)
          throw new AppError(409, 'LAST_ADMIN', 'Cannot deactivate the last active administrator');
      }

      const now = new Date();
      // Deactivate and revoke all sessions atomically
      const updated = await repository.deactivate(scope.hotelId, id);
      await repository.revokeAllSessions(record.id, now, 'ACCOUNT_DEACTIVATED');

      return toResponse(updated);
    });
  }

  async activateEmployee(scope: EmployeeScope, id: bigint) {
    this.authorize(scope, 'activate');

    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw missing();

      this.checkRoleHierarchy(scope.role, record.role.code);

      if (record.isActive)
        throw new AppError(409, 'ALREADY_ACTIVE', 'Employee is already active');

      const updated = await repository.activate(scope.hotelId, id);
      return toResponse(updated);
    });
  }

  async resetPassword(scope: EmployeeScope, id: bigint, newPassword?: string) {
    this.authorize(scope, 'resetPassword');

    const passwordToSet = newPassword ?? generateTemporaryPassword();
    const passwordHash = await hashPassword(passwordToSet);

    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw missing();

      this.checkRoleHierarchy(scope.role, record.role.code);

      const now = new Date();
      const updated = await repository.resetPassword(scope.hotelId, id, passwordHash);
      await repository.revokeAllSessions(record.id, now, 'PASSWORD_RESET');

      return {
        ...toResponse(updated),
        temporaryPassword: newPassword ? undefined : passwordToSet,
      };
    });
  }

  async getEmployees(scope: EmployeeScope, query: EmployeeQuery) {
    this.authorize(scope, 'read');
    const { items, total } = await this.repository.list(scope.hotelId, query);
    return pageResult(
      items.map((item) => ({
        id: item.id.toString(),
        fullName: item.fullName,
        username: item.username,
        email: item.email,
        role: item.role.code,
        isActive: item.isActive,
        createdAt: item.createdAt,
      })),
      total,
      query,
    );
  }
}
