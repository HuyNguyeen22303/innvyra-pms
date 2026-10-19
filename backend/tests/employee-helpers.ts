import type { Prisma, Role, StaffUser } from '../src/generated/prisma/client.js';
import type { EmployeeQuery, EmployeeRepository } from '../src/modules/employees/employee.types.js';
import type { PrismaEmployeeRepository } from '../src/modules/employees/employee.repository.js';
import type { RoleCode } from '../src/shared/types/roles.js';
import { AppError } from '../src/shared/errors/app-error.js';
import type { MemoryAuthRepository } from './helpers.js';

export type StaffWithRole = StaffUser & { role: Role };

export const ROLES_FIXTURE: { id: bigint; code: RoleCode; name: string }[] = [
  { id: 1n, code: 'ADMIN', name: 'Quản trị hệ thống' },
  { id: 2n, code: 'MANAGER', name: 'Quản lý khách sạn' },
  { id: 3n, code: 'RECEPTIONIST', name: 'Nhân viên lễ tân' },
  { id: 4n, code: 'HOUSEKEEPING', name: 'Nhân viên buồng phòng' },
  { id: 5n, code: 'ACCOUNTANT', name: 'Nhân viên kế toán' },
  { id: 6n, code: 'TECHNICIAN', name: 'Nhân viên kỹ thuật' },
];

export function memoryEmployees(authRepo?: MemoryAuthRepository) {
  const records = new Map<bigint, StaffWithRole>();
  let nextId = 100n;

  // Initialize roles map
  const rolesByCode = new Map<string, Role>();
  const rolesById = new Map<bigint, Role>();
  for (const role of ROLES_FIXTURE) {
    rolesByCode.set(role.code, role);
    rolesById.set(role.id, role);
  }

  // Pre-populate with default users matching MemoryAuthRepository
  const adminRole = rolesByCode.get('ADMIN')!;
  const receptionistRole = rolesByCode.get('RECEPTIONIST')!;

  records.set(9007199254740993n, {
    id: 9007199254740993n,
    hotelId: 9007199254740995n,
    roleId: adminRole.id,
    fullName: 'Test Admin',
    username: 'admin',
    email: 'admin@example.test',
    passwordHash: 'dummy',
    isActive: true,
    createdAt: new Date('2026-10-14T00:00:00.000Z'),
    role: adminRole,
  });

  records.set(2n, {
    id: 2n,
    hotelId: 1n,
    roleId: receptionistRole.id,
    fullName: 'Test Receptionist',
    username: 'receptionist',
    email: 'receptionist@example.test',
    passwordHash: 'dummy',
    isActive: true,
    createdAt: new Date('2026-10-14T00:00:00.000Z'),
    role: receptionistRole,
  });

  const matching = (hotelId: bigint, query: EmployeeQuery) =>
    [...records.values()].filter(
      (row) =>
        row.hotelId === hotelId &&
        (!query.search ||
          row.fullName.toLowerCase().includes(query.search.toLowerCase()) ||
          row.username.toLowerCase().includes(query.search.toLowerCase()) ||
          (row.email && row.email.toLowerCase().includes(query.search.toLowerCase()))) &&
        (!query.role || row.role.code === query.role) &&
        (query.isActive === undefined || row.isActive === query.isActive),
    );

  const repository: EmployeeRepository = {
    async withHotelLock<T>(
      _hotelId: bigint,
      action: (repository: PrismaEmployeeRepository) => Promise<T>,
    ): Promise<T> {
      const snapshot = new Map<bigint, StaffWithRole>();
      records.forEach((value, key) => snapshot.set(key, { ...value }));
      try {
        return await action(repository as unknown as PrismaEmployeeRepository);
      } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },

    async findById(hotelId: bigint, id: bigint) {
      const row = records.get(id);
      return row && row.hotelId === hotelId ? row : null;
    },

    async findByUsername(username: string) {
      const found = [...records.values()].find((row) => row.username === username);
      return found ?? null;
    },

    async findByEmail(email: string) {
      const found = [...records.values()].find((row) => row.email === email);
      return found ?? null;
    },

    async findRoleByCode(code: string) {
      const role = rolesByCode.get(code);
      return role ?? null;
    },

    async create(data: {
      hotelId: bigint;
      roleId: bigint;
      fullName: string;
      username: string;
      email: string | null;
      passwordHash: string;
    }) {
      if ([...records.values()].some((r) => r.username === data.username)) {
        throw new AppError(409, 'USERNAME_EXISTS', 'Username already exists');
      }
      if (data.email && [...records.values()].some((r) => r.email === data.email)) {
        throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
      }
      const role = rolesById.get(data.roleId);
      if (!role) throw new AppError(422, 'INVALID_ROLE', 'Invalid role');

      const id = nextId++;
      const record: StaffWithRole = {
        id,
        hotelId: data.hotelId,
        roleId: data.roleId,
        fullName: data.fullName,
        username: data.username,
        email: data.email ?? null,
        passwordHash: data.passwordHash,
        isActive: true,
        createdAt: new Date(),
        role,
      };
      records.set(id, record);

      // If authRepo provided, also sync into authRepo users map
      if (authRepo) {
        authRepo.users.set(data.username, {
          id: record.id,
          hotelId: record.hotelId,
          fullName: record.fullName,
          username: record.username,
          email: record.email,
          passwordHash: record.passwordHash,
          isActive: record.isActive,
          role: { code: record.role.code },
        });
      }

      return record;
    },

    async update(hotelId: bigint, id: bigint, data: Prisma.StaffUserUpdateInput) {
      const row = records.get(id);
      if (!row || row.hotelId !== hotelId)
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

      if (typeof data.fullName === 'string') row.fullName = data.fullName;
      if (typeof data.email === 'string' || data.email === null)
        row.email = data.email as string | null;
      const roleConnect = data.role as { connect?: { id?: bigint } } | undefined;
      if (roleConnect?.connect?.id !== undefined) {
        const newRole = rolesById.get(roleConnect.connect.id);
        if (newRole) {
          row.roleId = newRole.id;
          row.role = newRole;
        }
      }
      if (typeof data.isActive === 'boolean') row.isActive = data.isActive;

      // Sync with authRepo if available
      if (authRepo) {
        const authUser = authRepo.users.get(row.username);
        if (authUser) {
          authUser.fullName = row.fullName;
          authUser.email = row.email;
          authUser.role = { code: row.role.code };
          authUser.isActive = row.isActive;
        }
      }

      return row;
    },

    async deactivate(hotelId: bigint, id: bigint) {
      const row = records.get(id);
      if (!row || row.hotelId !== hotelId)
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      row.isActive = false;

      // Sync with authRepo
      if (authRepo) {
        const authUser = authRepo.users.get(row.username);
        if (authUser) authUser.isActive = false;
      }

      return row;
    },

    async activate(hotelId: bigint, id: bigint) {
      const row = records.get(id);
      if (!row || row.hotelId !== hotelId)
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      row.isActive = true;

      // Sync with authRepo
      if (authRepo) {
        const authUser = authRepo.users.get(row.username);
        if (authUser) authUser.isActive = true;
      }

      return row;
    },

    async resetPassword(hotelId: bigint, id: bigint, passwordHash: string) {
      const row = records.get(id);
      if (!row || row.hotelId !== hotelId)
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      row.passwordHash = passwordHash;

      // Sync with authRepo
      if (authRepo) {
        const authUser = authRepo.users.get(row.username);
        if (authUser) authUser.passwordHash = passwordHash;
      }

      return row;
    },

    async revokeAllSessions(staffUserId: bigint, now: Date) {
      if (authRepo) {
        for (const session of authRepo.sessions.values()) {
          if (session.staffUserId === staffUserId && session.revokedAt === null) {
            session.revokedAt = now;
          }
        }
      }
    },

    async countActiveByRoleInHotel(hotelId: bigint, roleCode: string) {
      return [...records.values()].filter(
        (r) => r.hotelId === hotelId && r.isActive && r.role.code === roleCode,
      ).length;
    },

    async findMany(hotelId: bigint, query: EmployeeQuery) {
      const rows = matching(hotelId, query).sort((a, b) => {
        const key = query.sortBy;
        const left = a[key];
        const right = b[key];
        const cmp = left < right ? -1 : left > right ? 1 : 0;
        return query.sortOrder === 'asc' ? cmp : -cmp;
      });
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      return rows.slice((page - 1) * limit, page * limit).map((r) => ({
        id: r.id,
        fullName: r.fullName,
        username: r.username,
        email: r.email,
        isActive: r.isActive,
        createdAt: r.createdAt,
        role: { code: r.role.code, name: r.role.name },
      }));
    },

    async count(hotelId: bigint, query: EmployeeQuery) {
      return matching(hotelId, query).length;
    },

    async list(hotelId: bigint, query: EmployeeQuery) {
      return {
        items: await repository.findMany(hotelId, query),
        total: await repository.count(hotelId, query),
      };
    },
  };

  return { records, repository };
}
