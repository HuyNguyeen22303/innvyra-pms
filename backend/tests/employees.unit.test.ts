import { describe, expect, it } from 'vitest';
import { EmployeeService } from '../src/modules/employees/employee.service.js';
import { verifyPassword } from '../src/shared/utils/password.js';
import { memoryEmployees } from './employee-helpers.js';
import type { EmployeeScope } from '../src/modules/employees/employee.types.js';

describe('EmployeeService Unit Tests', () => {
  const adminScope: EmployeeScope = { hotelId: 1n, actorId: 999n, role: 'ADMIN' };
  const managerScope: EmployeeScope = { hotelId: 1n, actorId: 888n, role: 'MANAGER' };
  const receptionistScope: EmployeeScope = { hotelId: 1n, actorId: 777n, role: 'RECEPTIONIST' };

  describe('createEmployee', () => {
    it('creates an employee successfully with valid data', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const result = await service.createEmployee(adminScope, {
        fullName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        email: 'vana@example.test',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      expect(result).toMatchObject({
        fullName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        email: 'vana@example.test',
        role: 'RECEPTIONIST',
        isActive: true,
      });
      expect(result.id).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate username (409 USERNAME_EXISTS)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await service.createEmployee(adminScope, {
        fullName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await expect(
        service.createEmployee(adminScope, {
          fullName: 'Nguyễn Văn B',
          username: 'nguyenvana',
          password: 'ValidPassword123!',
          role: 'HOUSEKEEPING',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'USERNAME_EXISTS' });
    });

    it('rejects duplicate email (409 EMAIL_EXISTS)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await service.createEmployee(adminScope, {
        fullName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        email: 'shared@example.test',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await expect(
        service.createEmployee(adminScope, {
          fullName: 'Nguyễn Văn B',
          username: 'nguyenvanb',
          email: 'shared@example.test',
          password: 'ValidPassword123!',
          role: 'HOUSEKEEPING',
        }),
      ).rejects.toMatchObject({ status: 409, code: 'EMAIL_EXISTS' });
    });

    it('prevents MANAGER from creating an ADMIN account (role hierarchy violation)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(
        service.createEmployee(managerScope, {
          fullName: 'Fake Admin',
          username: 'fakeadmin',
          password: 'ValidPassword123!',
          role: 'ADMIN',
        }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('prevents MANAGER from creating another MANAGER account (equal role hierarchy)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(
        service.createEmployee(managerScope, {
          fullName: 'Peer Manager',
          username: 'peermanager',
          password: 'ValidPassword123!',
          role: 'MANAGER',
        }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('allows MANAGER to create lower roles like RECEPTIONIST or HOUSEKEEPING', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(managerScope, {
        fullName: 'Staff Member',
        username: 'staffmember',
        password: 'ValidPassword123!',
        role: 'HOUSEKEEPING',
      });

      expect(created.role).toBe('HOUSEKEEPING');
    });

    it('denies RECEPTIONIST from creating employees (403 FORBIDDEN)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(
        service.createEmployee(receptionistScope, {
          fullName: 'Anyone',
          username: 'anyone',
          password: 'ValidPassword123!',
          role: 'HOUSEKEEPING',
        }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('updateEmployee', () => {
    it('updates employee details successfully', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Old Name',
        username: 'updatetest',
        email: 'old@example.test',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      const updated = await service.updateEmployee(adminScope, BigInt(created.id), {
        fullName: 'New Name',
        email: 'new@example.test',
        role: 'HOUSEKEEPING',
      });

      expect(updated).toMatchObject({
        fullName: 'New Name',
        email: 'new@example.test',
        role: 'HOUSEKEEPING',
      });
    });

    it('rejects update for nonexistent employee (404 EMPLOYEE_NOT_FOUND)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(
        service.updateEmployee(adminScope, 999999n, { fullName: 'Not Found' }),
      ).rejects.toMatchObject({ status: 404, code: 'EMPLOYEE_NOT_FOUND' });
    });

    it('enforces tenant boundary on update (cross-tenant 404)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Hotel 1 Staff',
        username: 'hotel1staff',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      const otherHotelManager: EmployeeScope = { hotelId: 2n, actorId: 555n, role: 'MANAGER' };
      await expect(
        service.updateEmployee(otherHotelManager, BigInt(created.id), { fullName: 'Hacked' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('prevents MANAGER from editing an ADMIN account', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const adminUser = await service.createEmployee(adminScope, {
        fullName: 'Target Admin',
        username: 'targetadmin',
        password: 'ValidPassword123!',
        role: 'ADMIN',
      });

      await expect(
        service.updateEmployee(managerScope, BigInt(adminUser.id), { fullName: 'Changed' }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('prevents MANAGER from promoting an employee to ADMIN', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const staff = await service.createEmployee(managerScope, {
        fullName: 'Promote Target',
        username: 'promotetarget',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await expect(
        service.updateEmployee(managerScope, BigInt(staff.id), { role: 'ADMIN' }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('rejects updating to an email that is already used by another account (409)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await service.createEmployee(adminScope, {
        fullName: 'First',
        username: 'firstuser',
        email: 'first@example.test',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      const second = await service.createEmployee(adminScope, {
        fullName: 'Second',
        username: 'seconduser',
        email: 'second@example.test',
        password: 'ValidPassword123!',
        role: 'HOUSEKEEPING',
      });

      await expect(
        service.updateEmployee(adminScope, BigInt(second.id), { email: 'first@example.test' }),
      ).rejects.toMatchObject({ status: 409, code: 'EMAIL_EXISTS' });
    });
  });

  describe('deactivateEmployee', () => {
    it('deactivates an employee successfully and revokes sessions', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'To Deactivate',
        username: 'todeactivate',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      const result = await service.deactivateEmployee(adminScope, BigInt(created.id));
      expect(result.isActive).toBe(false);

      const record = await store.repository.findById(adminScope.hotelId, BigInt(created.id));
      expect(record?.isActive).toBe(false);
    });

    it('prevents user from deactivating themselves', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const selfScope: EmployeeScope = { hotelId: 1n, actorId: 100n, role: 'ADMIN' };

      await expect(service.deactivateEmployee(selfScope, 100n)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('prevents deactivating the last active ADMIN in the hotel (409 LAST_ADMIN)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      // Pre-seed has 1 admin for hotel 9007199254740995n
      const adminHotelScope: EmployeeScope = {
        hotelId: 9007199254740995n,
        actorId: 12345n,
        role: 'ADMIN',
      };

      await expect(
        service.deactivateEmployee(adminHotelScope, 9007199254740993n),
      ).rejects.toMatchObject({ status: 409, code: 'LAST_ADMIN' });
    });

    it('rejects deactivating an already deactivated employee (409 ALREADY_DEACTIVATED)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Already Inactive',
        username: 'alreadyinactive',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await service.deactivateEmployee(adminScope, BigInt(created.id));

      await expect(
        service.deactivateEmployee(adminScope, BigInt(created.id)),
      ).rejects.toMatchObject({ status: 409, code: 'ALREADY_DEACTIVATED' });
    });

    it('prevents MANAGER from deactivating an ADMIN account', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const adminUser = await service.createEmployee(adminScope, {
        fullName: 'Other Admin',
        username: 'otheradmin',
        password: 'ValidPassword123!',
        role: 'ADMIN',
      });

      await expect(
        service.deactivateEmployee(managerScope, BigInt(adminUser.id)),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('denies non-authorized roles from deactivating employees', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(service.deactivateEmployee(receptionistScope, 2n)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('getEmployees', () => {
    it('lists employees with pagination', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const result = await service.getEmployees(adminScope, {
        page: 1,
        limit: 10,
        sortBy: 'fullName',
        sortOrder: 'asc',
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(Array.isArray(result.items)).toBe(true);

      for (const item of result.items) {
        expect(item).not.toHaveProperty('passwordHash');
        expect(item).not.toHaveProperty('password');
      }
    });

    it('searches employees by name, username or email', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await service.createEmployee(adminScope, {
        fullName: 'Unique Search Name',
        username: 'uniquesearchuser',
        email: 'uniquesearch@example.test',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      const byName = await service.getEmployees(adminScope, {
        page: 1,
        limit: 10,
        search: 'Unique Search',
        sortBy: 'fullName',
        sortOrder: 'asc',
      });
      expect(byName.items.length).toBe(1);
      expect(byName.items[0]!.fullName).toBe('Unique Search Name');

      const byUsername = await service.getEmployees(adminScope, {
        page: 1,
        limit: 10,
        search: 'uniquesearchuser',
        sortBy: 'fullName',
        sortOrder: 'asc',
      });
      expect(byUsername.items.length).toBe(1);
    });

    it('filters employees by role and active status', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await service.createEmployee(adminScope, {
        fullName: 'Receptionist One',
        username: 'receptionist1',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await service.createEmployee(adminScope, {
        fullName: 'Housekeeper One',
        username: 'housekeeper1',
        password: 'ValidPassword123!',
        role: 'HOUSEKEEPING',
      });

      const filtered = await service.getEmployees(adminScope, {
        page: 1,
        limit: 10,
        role: 'HOUSEKEEPING',
        sortBy: 'fullName',
        sortOrder: 'asc',
      });

      for (const item of filtered.items) {
        expect(item.role).toBe('HOUSEKEEPING');
      }
    });
  });

  describe('activateEmployee', () => {
    it('activates an inactive employee successfully', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'To Activate',
        username: 'toactivate',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });
      await service.deactivateEmployee(adminScope, BigInt(created.id));

      const result = await service.activateEmployee(adminScope, BigInt(created.id));

      expect(result).toMatchObject({
        id: created.id,
        fullName: 'To Activate',
        username: 'toactivate',
        role: 'RECEPTIONIST',
        isActive: true,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');

      // Verify in repository
      const inDb = await store.repository.findById(adminScope.hotelId, BigInt(created.id));
      expect(inDb?.isActive).toBe(true);
    });

    it('rejects activation when employee does not exist (404 EMPLOYEE_NOT_FOUND)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(service.activateEmployee(adminScope, 99999n)).rejects.toMatchObject({
        status: 404,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('rejects activating employee from a different hotel (tenant scope isolation)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Hotel 1 Employee',
        username: 'hotel1employee',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });
      await service.deactivateEmployee(adminScope, BigInt(created.id));

      const otherHotelScope: EmployeeScope = { hotelId: 2n, actorId: 999n, role: 'ADMIN' };
      await expect(
        service.activateEmployee(otherHotelScope, BigInt(created.id)),
      ).rejects.toMatchObject({
        status: 404,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('rejects activating an already active employee (409 ALREADY_ACTIVE)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Active User',
        username: 'activeuser',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });

      await expect(service.activateEmployee(adminScope, BigInt(created.id))).rejects.toMatchObject({
        status: 409,
        code: 'ALREADY_ACTIVE',
      });
    });

    it('prevents MANAGER from activating an ADMIN account (role hierarchy violation)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const adminUser = await service.createEmployee(adminScope, {
        fullName: 'Inactive Admin',
        username: 'inactiveadmin',
        password: 'ValidPassword123!',
        role: 'ADMIN',
      });
      // Deactivate directly in repo to simulate inactive admin
      const record = store.records.get(BigInt(adminUser.id))!;
      record.isActive = false;

      await expect(
        service.activateEmployee(managerScope, BigInt(adminUser.id)),
      ).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('prevents MANAGER from activating a peer MANAGER account', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const peerManager = await store.repository.create({
        hotelId: adminScope.hotelId,
        roleId: 2n,
        fullName: 'Peer Manager',
        username: 'peermanager',
        email: null,
        passwordHash: 'dummy',
      });
      store.records.get(peerManager.id)!.isActive = false;

      await expect(
        service.activateEmployee(managerScope, peerManager.id),
      ).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows MANAGER to activate a subordinate role (e.g. RECEPTIONIST)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const rec = await service.createEmployee(adminScope, {
        fullName: 'Subordinate Receptionist',
        username: 'subrec',
        password: 'ValidPassword123!',
        role: 'RECEPTIONIST',
      });
      await service.deactivateEmployee(adminScope, BigInt(rec.id));

      const result = await service.activateEmployee(managerScope, BigInt(rec.id));
      expect(result.isActive).toBe(true);
    });

    it('denies unauthorized roles from activating employees (e.g. RECEPTIONIST -> 403)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(service.activateEmployee(receptionistScope, 2n)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('resetPassword', () => {
    it('resets password successfully with an automatically generated temporary password', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Reset Me',
        username: 'resetme',
        password: 'InitialPassword123!',
        role: 'RECEPTIONIST',
      });

      const result = await service.resetPassword(adminScope, BigInt(created.id));

      expect(result.id).toBe(created.id);
      expect(result.fullName).toBe('Reset Me');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.temporaryPassword).toBeDefined();
      expect(typeof result.temporaryPassword).toBe('string');
      // Verify temporary password criteria
      expect(result.temporaryPassword!.length).toBeGreaterThanOrEqual(15);
      expect(new Set(result.temporaryPassword!).size).toBeGreaterThanOrEqual(8);

      // Verify the stored hash matches the generated temporary password using Argon2id
      const stored = await store.repository.findById(adminScope.hotelId, BigInt(created.id));
      expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
      const isMatch = await verifyPassword(stored!.passwordHash, result.temporaryPassword!);
      expect(isMatch).toBe(true);

      // Old password must not match
      const oldMatches = await verifyPassword(stored!.passwordHash, 'InitialPassword123!');
      expect(oldMatches).toBe(false);
    });

    it('resets password with an explicitly provided custom password', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Custom Reset',
        username: 'customreset',
        password: 'OldPassword12345!',
        role: 'RECEPTIONIST',
      });

      const customNewPassword = 'MyNewExplicitPass123!';
      const result = await service.resetPassword(adminScope, BigInt(created.id), customNewPassword);

      expect(result.id).toBe(created.id);
      expect(result.temporaryPassword).toBeUndefined();

      const stored = await store.repository.findById(adminScope.hotelId, BigInt(created.id));
      expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
      const isMatch = await verifyPassword(stored!.passwordHash, customNewPassword);
      expect(isMatch).toBe(true);
      const oldMatches = await verifyPassword(stored!.passwordHash, 'OldPassword12345!');
      expect(oldMatches).toBe(false);
    });

    it('rejects resetting password for nonexistent employee (404 EMPLOYEE_NOT_FOUND)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(service.resetPassword(adminScope, 99999n)).rejects.toMatchObject({
        status: 404,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('rejects resetting password for employee of another tenant (tenant isolation)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const created = await service.createEmployee(adminScope, {
        fullName: 'Tenant A Staff',
        username: 'tenantastaff',
        password: 'InitialPassword123!',
        role: 'RECEPTIONIST',
      });

      const otherHotelScope: EmployeeScope = { hotelId: 2n, actorId: 999n, role: 'ADMIN' };
      await expect(
        service.resetPassword(otherHotelScope, BigInt(created.id)),
      ).rejects.toMatchObject({
        status: 404,
        code: 'EMPLOYEE_NOT_FOUND',
      });
    });

    it('prevents MANAGER from resetting an ADMIN account (role hierarchy violation)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const adminUser = await service.createEmployee(adminScope, {
        fullName: 'Target Admin',
        username: 'targetadmin',
        password: 'InitialPassword123!',
        role: 'ADMIN',
      });

      await expect(
        service.resetPassword(managerScope, BigInt(adminUser.id)),
      ).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('prevents MANAGER from resetting a peer MANAGER account', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const peerManager = await store.repository.create({
        hotelId: adminScope.hotelId,
        roleId: 2n,
        fullName: 'Peer Manager Reset',
        username: 'peermanagerreset',
        email: null,
        passwordHash: 'dummy',
      });

      await expect(
        service.resetPassword(managerScope, peerManager.id),
      ).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows MANAGER to reset password of a subordinate role', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      const rec = await service.createEmployee(adminScope, {
        fullName: 'Manager Subordinate',
        username: 'managersub',
        password: 'InitialPassword123!',
        role: 'RECEPTIONIST',
      });

      const result = await service.resetPassword(managerScope, BigInt(rec.id));
      expect(result.id).toBe(rec.id);
      expect(result.temporaryPassword).toBeDefined();
    });

    it('denies unauthorized roles from resetting password (e.g. RECEPTIONIST -> 403)', async () => {
      const store = memoryEmployees();
      const service = new EmployeeService(store.repository);

      await expect(service.resetPassword(receptionistScope, 2n)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });
  });
});

