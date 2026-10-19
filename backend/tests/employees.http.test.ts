import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';
import { memoryGuests } from './guest-helpers.js';
import { memoryReservations } from './reservation-helpers.js';
import { memoryEmployees } from './employee-helpers.js';

describe('Employees HTTP: real JWT, RBAC, validation, tenant isolation and lifecycle', () => {
  let passwordHash: string;
  let auth: MemoryAuthRepository;
  let employeeStore: ReturnType<typeof memoryEmployees>;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let managerToken: string;
  let receptionistToken: string;
  let adminId: string;
  const hotelId = 9007199254740995n;

  beforeAll(async () => {
    passwordHash = await hashPassword(testPassword);
  });

  beforeEach(async () => {
    auth = new MemoryAuthRepository(passwordHash);

    // Add a manager user to auth
    auth.users.set('manager', {
      id: 300n,
      hotelId,
      fullName: 'Test Manager',
      username: 'manager',
      email: 'manager@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'MANAGER' },
    });

    // Add another receptionist in the same hotel
    auth.users.set('receptionist_same_hotel', {
      id: 400n,
      hotelId,
      fullName: 'Same Hotel Receptionist',
      username: 'receptionist_same_hotel',
      email: 'rec_same@example.test',
      passwordHash,
      isActive: true,
      role: { code: 'RECEPTIONIST' },
    });

    employeeStore = memoryEmployees(auth);

    // Populate employeeStore with the manager and receptionist in hotelId
    await employeeStore.repository.create({
      hotelId,
      roleId: 2n, // MANAGER
      fullName: 'Test Manager',
      username: 'manager',
      email: 'manager@example.test',
      passwordHash,
    });

    await employeeStore.repository.create({
      hotelId,
      roleId: 3n, // RECEPTIONIST
      fullName: 'Same Hotel Receptionist',
      username: 'receptionist_same_hotel',
      email: 'rec_same@example.test',
      passwordHash,
    });

    app = createApp(
      testEnv,
      auth,
      memoryRooms().repositories,
      memoryGuests().repository,
      memoryReservations().repository,
      undefined,
      undefined,
      undefined,
      undefined,
      employeeStore.repository,
    );

    const authService = new AuthService(auth, testEnv);

    const adminLogin = await authService.login({ username: 'admin', password: testPassword });
    adminToken = adminLogin.data.accessToken;
    adminId = adminLogin.data.user.id;

    const managerLogin = await authService.login({ username: 'manager', password: testPassword });
    managerToken = managerLogin.data.accessToken;

    const recLogin = await authService.login({
      username: 'receptionist_same_hotel',
      password: testPassword,
    });
    receptionistToken = recLogin.data.accessToken;
  });

  const get = (path = '', token = adminToken) =>
    request(app).get(`/api/v1/employees${path}`).auth(token, { type: 'bearer' });

  const post = (body: object, token = adminToken) =>
    request(app)
      .post('/api/v1/employees')
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body);

  const patch = (path: string, body: object, token = adminToken) =>
    request(app)
      .patch(`/api/v1/employees${path}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body);

  const deactivate = (id: string, token = adminToken) =>
    request(app)
      .patch(`/api/v1/employees/${id}/deactivate`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send({});

  const activate = (id: string, token = adminToken) =>
    request(app)
      .patch(`/api/v1/employees/${id}/activate`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send({});

  const resetPassword = (id: string, body?: object, token = adminToken) =>
    request(app)
      .post(`/api/v1/employees/${id}/reset-password`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body ?? {});

  // -------------------------------------------------------------
  // 1. TẠO NHÂN VIÊN (POST /api/v1/employees)
  // -------------------------------------------------------------
  describe('1. Create Employee (POST /api/v1/employees)', () => {
    it('1. Creates employee successfully with valid data', async () => {
      const res = await post({
        fullName: 'Lê Văn Hoàng',
        username: 'levanhoang',
        email: 'hoang.le@example.test',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employee created',
        data: {
          fullName: 'Lê Văn Hoàng',
          username: 'levanhoang',
          email: 'hoang.le@example.test',
          role: 'RECEPTIONIST',
          isActive: true,
        },
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('2. Rejects request when required fields are missing', async () => {
      // Missing password and role
      const res = await post({
        fullName: 'Thiếu Dữ Liệu',
        username: 'thieudulieu',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3. Rejects invalid email format', async () => {
      const res = await post({
        fullName: 'Sai Email',
        username: 'saiemail',
        email: 'invalid-email-format',
        password: 'SecurePassphrase2026!',
        role: 'HOUSEKEEPING',
      });
      expect(res.status).toBe(422);
    });

    it('4. Rejects duplicate username or duplicate email', async () => {
      await post({
        fullName: 'Trần Văn C',
        username: 'tranvanc',
        email: 'tranc@example.test',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });

      // Duplicate username
      const dupUsername = await post({
        fullName: 'Trần Văn D',
        username: 'tranvanc',
        email: 'trand@example.test',
        password: 'SecurePassphrase2026!',
        role: 'HOUSEKEEPING',
      });
      expect(dupUsername.status).toBe(409);
      expect(dupUsername.body.error.code).toBe('USERNAME_EXISTS');

      // Duplicate email
      const dupEmail = await post({
        fullName: 'Trần Văn E',
        username: 'tranvane',
        email: 'tranc@example.test',
        password: 'SecurePassphrase2026!',
        role: 'HOUSEKEEPING',
      });
      expect(dupEmail.status).toBe(409);
      expect(dupEmail.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('5. Rejects invalid role code', async () => {
      const res = await post({
        fullName: 'Role Bậy',
        username: 'rolebay',
        password: 'SecurePassphrase2026!',
        role: 'SUPER_HERO',
      });
      expect(res.status).toBe(422);
    });

    it('6. Rejects unauthenticated request (401)', async () => {
      const res = await request(app).post('/api/v1/employees').set('X-CSRF-Protection', '1').send({
        fullName: 'No Auth',
        username: 'noauth',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });
      expect(res.status).toBe(401);
    });

    it('7. Rejects unauthorized role from creating employees (RECEPTIONIST -> 403)', async () => {
      const res = await post(
        {
          fullName: 'Not Allowed',
          username: 'notallowed',
          password: 'SecurePassphrase2026!',
          role: 'HOUSEKEEPING',
        },
        receptionistToken,
      );
      expect(res.status).toBe(403);
    });

    it('8. Rejects privilege escalation: MANAGER cannot create ADMIN or another MANAGER', async () => {
      const tryAdmin = await post(
        {
          fullName: 'Manager Trying Admin',
          username: 'manager_admin',
          password: 'SecurePassphrase2026!',
          role: 'ADMIN',
        },
        managerToken,
      );
      expect(tryAdmin.status).toBe(403);

      const tryManager = await post(
        {
          fullName: 'Manager Trying Manager',
          username: 'manager_peer',
          password: 'SecurePassphrase2026!',
          role: 'MANAGER',
        },
        managerToken,
      );
      expect(tryManager.status).toBe(403);
    });

    it('9. Never exposes password, password hash or tokens in response', async () => {
      const res = await post({
        fullName: 'Secret Test',
        username: 'secrettest',
        password: 'SecurePassphrase2026!',
        role: 'TECHNICIAN',
      });

      expect(res.status).toBe(201);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('SecurePassphrase2026!');
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('refreshToken');
      expect(text).not.toContain('tokenHash');
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('10. Scopes newly created employee to the authenticated hotel', async () => {
      const res = await post({
        fullName: 'Hotel Scoped Staff',
        username: 'hotelscoped',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });

      expect(res.status).toBe(201);
      const id = BigInt(res.body.data.id);
      const record = await employeeStore.repository.findById(hotelId, id);
      expect(record).not.toBeNull();
      expect(record?.hotelId).toBe(hotelId);
    });
  });

  // -------------------------------------------------------------
  // 2. CHỈNH SỬA NHÂN VIÊN (PATCH /api/v1/employees/:id)
  // -------------------------------------------------------------
  describe('2. Update Employee (PATCH /api/v1/employees/:id)', () => {
    let targetEmployeeId: string;

    beforeEach(async () => {
      const created = await post({
        fullName: 'Original Name',
        username: 'updatable_staff',
        email: 'original@example.test',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });
      targetEmployeeId = created.body.data.id;
    });

    it('11. Updates employee successfully with allowed fields', async () => {
      const res = await patch(`/${targetEmployeeId}`, {
        fullName: 'Updated Name',
        email: 'updated@example.test',
        role: 'ACCOUNTANT',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employee updated',
        data: {
          id: targetEmployeeId,
          fullName: 'Updated Name',
          email: 'updated@example.test',
          role: 'ACCOUNTANT',
        },
      });
    });

    it('12. Rejects invalid or nonexistent employee ID', async () => {
      // Invalid ID format
      const invalidId = await patch('/abc', { fullName: 'Test' });
      expect(invalidId.status).toBe(422);

      const zeroId = await patch('/0', { fullName: 'Test' });
      expect(zeroId.status).toBe(422);

      // Nonexistent ID
      const notFound = await patch('/999999999', { fullName: 'Test' });
      expect(notFound.status).toBe(404);
      expect(notFound.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('13. Rejects invalid email or duplicate email on update', async () => {
      const invalidEmail = await patch(`/${targetEmployeeId}`, {
        email: 'not-an-email',
      });
      expect(invalidEmail.status).toBe(422);

      // Another user has manager@example.test
      const dupEmail = await patch(`/${targetEmployeeId}`, {
        email: 'manager@example.test',
      });
      expect(dupEmail.status).toBe(409);
      expect(dupEmail.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('14. Rejects empty payload or disallowed fields', async () => {
      const emptyPayload = await patch(`/${targetEmployeeId}`, {});
      expect(emptyPayload.status).toBe(422);

      // Disallowed field: extra unknown field
      const extraField = await patch(`/${targetEmployeeId}`, {
        fullName: 'Valid Name',
        unknownField: 'malicious',
      });
      expect(extraField.status).toBe(422);
    });

    it('15. Rejects unauthorized roles from updating employee', async () => {
      const res = await patch(
        `/${targetEmployeeId}`,
        { fullName: 'Unauthorized' },
        receptionistToken,
      );
      expect(res.status).toBe(403);
    });

    it('16. Rejects modifying employee from another tenant (returns 404)', async () => {
      // receptionist at hotel 1n (different hotel)
      const otherHotelStaff = await employeeStore.repository.findById(1n, 2n);
      expect(otherHotelStaff).not.toBeNull();

      // Admin of hotel 9007199254740995n tries to update staff of hotel 1n
      const res = await patch('/2', { fullName: 'Hacked Other Hotel' });
      expect(res.status).toBe(404);
    });

    it('17. Rejects attempts to alter sensitive fields (username, password, id)', async () => {
      const tryChangeUsername = await patch(`/${targetEmployeeId}`, {
        username: 'new_username',
      });
      expect(tryChangeUsername.status).toBe(422);

      const tryChangePassword = await patch(`/${targetEmployeeId}`, {
        password: 'NewPassword12345!',
      });
      expect(tryChangePassword.status).toBe(422);

      const tryChangeId = await patch(`/${targetEmployeeId}`, {
        id: '12345',
      });
      expect(tryChangeId.status).toBe(422);
    });
  });

  // -------------------------------------------------------------
  // 3. VÔ HIỆU HÓA NHÂN VIÊN (PATCH /api/v1/employees/:id/deactivate)
  // -------------------------------------------------------------
  describe('3. Deactivate Employee (PATCH /api/v1/employees/:id/deactivate)', () => {
    let employeeToDeactivateId: string;
    let employeeUsername: string;

    beforeEach(async () => {
      employeeUsername = 'staff_to_deactivate';
      const created = await post({
        fullName: 'Sắp Bị Cho Nghỉ',
        username: employeeUsername,
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });
      employeeToDeactivateId = created.body.data.id;
    });

    it('18. Deactivates employee successfully', async () => {
      const res = await deactivate(employeeToDeactivateId);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employee deactivated',
        data: {
          id: employeeToDeactivateId,
          isActive: false,
        },
      });

      const record = await employeeStore.repository.findById(
        hotelId,
        BigInt(employeeToDeactivateId),
      );
      expect(record?.isActive).toBe(false);
    });

    it('19. Returns 404 for nonexistent employee ID', async () => {
      const res = await deactivate('888888888');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('20. Returns 409 if employee is already deactivated', async () => {
      await deactivate(employeeToDeactivateId);
      const secondTry = await deactivate(employeeToDeactivateId);
      expect(secondTry.status).toBe(409);
      expect(secondTry.body.error.code).toBe('ALREADY_DEACTIVATED');
    });

    it('21. Denies unauthorized roles from deactivating employee (403)', async () => {
      const res = await deactivate(employeeToDeactivateId, receptionistToken);
      expect(res.status).toBe(403);
    });

    it('22. Prevents self-deactivation (403 FORBIDDEN)', async () => {
      const res = await deactivate(adminId, adminToken);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Cannot deactivate your own account');
    });

    it('23. Prevents deactivating the last active administrator in hotel (409 LAST_ADMIN)', async () => {
      // adminId is the only ADMIN in hotelId
      const otherAdmin = await post({
        fullName: 'Second Admin',
        username: 'second_admin',
        password: 'SecurePassphrase2026!',
        role: 'ADMIN',
      });
      const secondAdminId = otherAdmin.body.data.id;

      // When activeAdminCount <= 1, deactivating an ADMIN must fail with 409 LAST_ADMIN
      const spy = vi
        .spyOn(employeeStore.repository, 'countActiveByRoleInHotel')
        .mockResolvedValue(1);
      try {
        const res = await deactivate(secondAdminId);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('LAST_ADMIN');
      } finally {
        spy.mockRestore();
      }
    });

    it('24. Revokes all active sessions upon deactivation', async () => {
      const authService = new AuthService(auth, testEnv);
      const staffLogin = await authService.login({
        username: employeeUsername,
        password: 'SecurePassphrase2026!',
      });
      expect(staffLogin.data.accessToken).toBeDefined();

      // Verify session exists and is active
      const activeSessions = [...auth.sessions.values()].filter(
        (s) => s.staffUserId === BigInt(employeeToDeactivateId) && s.revokedAt === null,
      );
      expect(activeSessions.length).toBeGreaterThan(0);

      // Deactivate employee
      await deactivate(employeeToDeactivateId);

      // Verify all sessions were revoked
      const remainingActiveSessions = [...auth.sessions.values()].filter(
        (s) => s.staffUserId === BigInt(employeeToDeactivateId) && s.revokedAt === null,
      );
      expect(remainingActiveSessions.length).toBe(0);
    });

    it('25. Inactive employee cannot log in or authenticate with old token', async () => {
      const authService = new AuthService(auth, testEnv);
      const staffLogin = await authService.login({
        username: employeeUsername,
        password: 'SecurePassphrase2026!',
      });
      const oldToken = staffLogin.data.accessToken;

      // Deactivate employee
      await deactivate(employeeToDeactivateId);

      // Old token should now be rejected
      const protectedRes = await get('', oldToken);
      expect(protectedRes.status).toBe(401);

      // Login should now fail with 401
      await expect(
        authService.login({
          username: employeeUsername,
          password: 'SecurePassphrase2026!',
        }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('26. Preserves employee record in database (no hard delete)', async () => {
      await deactivate(employeeToDeactivateId);

      // Record still exists in repository
      const record = await employeeStore.repository.findById(
        hotelId,
        BigInt(employeeToDeactivateId),
      );
      expect(record).not.toBeNull();
      expect(record?.id.toString()).toBe(employeeToDeactivateId);
      expect(record?.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 4. DANH SÁCH NHÂN VIÊN (GET /api/v1/employees)
  // -------------------------------------------------------------
  describe('4. List Employees (GET /api/v1/employees)', () => {
    beforeEach(async () => {
      await post({
        fullName: 'Nguyễn Văn Tìm Kiếm',
        username: 'nguyenvantimkiem',
        email: 'timkiem@example.test',
        password: 'SecurePassphrase2026!',
        role: 'RECEPTIONIST',
      });
      await post({
        fullName: 'Hoàng Kế Toán',
        username: 'hoangketoan',
        email: 'ketoan@example.test',
        password: 'SecurePassphrase2026!',
        role: 'ACCOUNTANT',
      });
    });

    it('27. Retrieves employee list successfully with standard pagination', async () => {
      const res = await get('?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employees retrieved',
        data: {
          items: expect.any(Array),
          pagination: {
            page: 1,
            limit: 10,
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        },
      });
    });

    it('28. Searches employees by name, username, or email', async () => {
      const searchName = await get('?search=Tìm Kiếm');
      expect(searchName.status).toBe(200);
      expect(searchName.body.data.items.length).toBe(1);
      expect(searchName.body.data.items[0].username).toBe('nguyenvantimkiem');

      const searchEmail = await get('?search=ketoan@example.test');
      expect(searchEmail.status).toBe(200);
      expect(searchEmail.body.data.items.length).toBe(1);
      expect(searchEmail.body.data.items[0].username).toBe('hoangketoan');
    });

    it('29. Filters by role and active status', async () => {
      const resRole = await get('?role=ACCOUNTANT');
      expect(resRole.status).toBe(200);
      for (const item of resRole.body.data.items) {
        expect(item.role).toBe('ACCOUNTANT');
      }

      const resActive = await get('?isActive=true');
      expect(resActive.status).toBe(200);
      for (const item of resActive.body.data.items) {
        expect(item.isActive).toBe(true);
      }
    });

    it('30. Correctly handles pagination metadata', async () => {
      const res = await get('?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(
        Math.ceil(res.body.data.pagination.total / 2),
      );
    });

    it('31. Rejects invalid page or limit parameters (422)', async () => {
      expect((await get('?page=0')).status).toBe(422);
      expect((await get('?page=-1')).status).toBe(422);
      expect((await get('?limit=0')).status).toBe(422);
      expect((await get('?limit=101')).status).toBe(422);
    });

    it('32. Blocks unsupported sort fields', async () => {
      const res = await get('?sortBy=passwordHash');
      expect(res.status).toBe(422);
    });

    it('33. Never leaks sensitive data in list items', async () => {
      const res = await get();
      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item).not.toHaveProperty('passwordHash');
        expect(item).not.toHaveProperty('password');
        expect(item).not.toHaveProperty('token');
      }
    });

    it('34. Enforces tenant scope: does not return employees of other hotels', async () => {
      const res = await get();
      expect(res.status).toBe(200);
      // Receptionist with id '2' belongs to hotelId 1n, not hotelId
      const foundOtherHotelStaff = res.body.data.items.some((i: { id: string }) => i.id === '2');
      expect(foundOtherHotelStaff).toBe(false);
    });

    it('35. Rejects unauthenticated request for employee list (401)', async () => {
      const res = await request(app).get('/api/v1/employees');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------
  // 5. KÍCH HOẠT NHÂN VIÊN (PATCH /api/v1/employees/:id/activate)
  // -------------------------------------------------------------
  describe('5. Activate Employee (PATCH /api/v1/employees/:id/activate)', () => {
    let inactiveStaffId: string;
    let inactiveStaffUsername: string;

    beforeEach(async () => {
      const createRes = await post({
        fullName: 'Nguyễn Văn Kích Hoạt',
        username: `activate_user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        password: testPassword,
        role: 'RECEPTIONIST',
      });
      inactiveStaffId = createRes.body.data.id;
      inactiveStaffUsername = createRes.body.data.username;
      await deactivate(inactiveStaffId);
    });

    it('36. Activates inactive employee successfully', async () => {
      const res = await activate(inactiveStaffId);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employee activated',
        data: {
          id: inactiveStaffId,
          username: inactiveStaffUsername,
          isActive: true,
        },
      });
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');

      // Verify the activated employee can log in again
      const authService = new AuthService(auth, testEnv);
      const loginRes = await authService.login({
        username: inactiveStaffUsername,
        password: testPassword,
      });
      expect(loginRes.data.user.isActive).toBe(true);
    });

    it('37. Returns 404 for nonexistent employee ID', async () => {
      const res = await activate('99999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('38. Returns 422 for invalid employee ID format', async () => {
      expect((await activate('abc')).status).toBe(422);
      expect((await activate('0')).status).toBe(422);
      expect((await activate('-5')).status).toBe(422);
    });

    it('39. Returns 409 if employee is already active', async () => {
      // First activation
      await activate(inactiveStaffId);

      // Second activation on already active employee
      const res = await activate(inactiveStaffId);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_ACTIVE');
    });

    it('40. Rejects unauthenticated request for activation (401)', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${inactiveStaffId}/activate`)
        .set('X-CSRF-Protection', '1')
        .send({});
      expect(res.status).toBe(401);
    });

    it('41. Denies unauthorized roles from activating employee (RECEPTIONIST -> 403)', async () => {
      const res = await activate(inactiveStaffId, receptionistToken);
      expect(res.status).toBe(403);
    });

    it('42. Prevents privilege escalation: MANAGER cannot activate an ADMIN account', async () => {
      // Create admin and mark inactive
      const adminStaff = await employeeStore.repository.create({
        hotelId,
        roleId: 1n,
        fullName: 'Inactive Admin Staff',
        username: 'inactive_admin_staff',
        email: null,
        passwordHash,
      });
      employeeStore.records.get(adminStaff.id)!.isActive = false;

      const res = await activate(adminStaff.id.toString(), managerToken);
      expect(res.status).toBe(403);
    });

    it('43. Prevents privilege escalation: MANAGER cannot activate a peer MANAGER account', async () => {
      const peerManager = await employeeStore.repository.create({
        hotelId,
        roleId: 2n,
        fullName: 'Inactive Peer Manager',
        username: 'inactive_peer_manager',
        email: null,
        passwordHash,
      });
      employeeStore.records.get(peerManager.id)!.isActive = false;

      const res = await activate(peerManager.id.toString(), managerToken);
      expect(res.status).toBe(403);
    });

    it('44. Allows MANAGER to activate a subordinate role (e.g. RECEPTIONIST)', async () => {
      const res = await activate(inactiveStaffId, managerToken);
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('45. Enforces tenant scope: cannot activate employee of another hotel (404)', async () => {
      // Staff with id '2' belongs to hotelId 1n
      const res = await activate('2');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('46. Ensures previously revoked sessions/tokens are not restored upon activation', async () => {
      const authService = new AuthService(auth, testEnv);

      // Create an employee, log in to obtain access token
      const newStaffUsername = `active_session_user_${Date.now()}`;
      const createRes = await post({
        fullName: 'Session Check Staff',
        username: newStaffUsername,
        password: testPassword,
        role: 'RECEPTIONIST',
      });
      const staffId = createRes.body.data.id;

      const login = await authService.login({
        username: newStaffUsername,
        password: testPassword,
      });
      const staffAccessToken = login.data.accessToken;

      // Token works
      const initialMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(staffAccessToken, { type: 'bearer' });
      expect(initialMe.status).toBe(200);

      // Deactivate the employee (revokes all sessions)
      await deactivate(staffId);

      // Old token is revoked
      const afterDeactMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(staffAccessToken, { type: 'bearer' });
      expect(afterDeactMe.status).toBe(401);

      // Reactivate the employee
      const actRes = await activate(staffId);
      expect(actRes.status).toBe(200);

      // Old revoked token STILL CANNOT be used (sessions are NOT restored)
      const afterActMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(staffAccessToken, { type: 'bearer' });
      expect(afterActMe.status).toBe(401);

      // But employee can perform a fresh login
      const freshLogin = await authService.login({
        username: newStaffUsername,
        password: testPassword,
      });
      expect(freshLogin.data.accessToken).toBeDefined();

      const freshMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(freshLogin.data.accessToken, { type: 'bearer' });
      expect(freshMe.status).toBe(200);
    });
  });

  // -------------------------------------------------------------
  // 6. CẤP LẠI MẬT KHẨU (POST /api/v1/employees/:id/reset-password)
  // -------------------------------------------------------------
  describe('6. Reset Password (POST /api/v1/employees/:id/reset-password)', () => {
    let targetStaffId: string;
    let targetUsername: string;

    beforeEach(async () => {
      const createRes = await post({
        fullName: 'Nguyễn Văn Reset',
        username: `reset_user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        password: testPassword,
        role: 'RECEPTIONIST',
      });
      targetStaffId = createRes.body.data.id;
      targetUsername = createRes.body.data.username;
    });

    it('47. Resets password successfully without body (generates safe random temporary password)', async () => {
      const res = await resetPassword(targetStaffId);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Employee password reset',
        data: {
          id: targetStaffId,
          username: targetUsername,
          role: 'RECEPTIONIST',
        },
      });

      // Response NEVER leaks password, temporaryPassword, or passwordHash
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('temporaryPassword');
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(res.body.data).not.toHaveProperty('token');

      // Old password no longer works
      const authService = new AuthService(auth, testEnv);
      await expect(
        authService.login({ username: targetUsername, password: testPassword }),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
      });

      // Stored hash is Argon2id
      const record = await employeeStore.repository.findById(hotelId, BigInt(targetStaffId));
      expect(record?.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('48. Resets password with an explicitly supplied new password in request body', async () => {
      const newPassword = 'BrandNewSecurePassword2026!';
      const res = await resetPassword(targetStaffId, { password: newPassword });

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');

      const authService = new AuthService(auth, testEnv);

      // Old password fails
      await expect(
        authService.login({ username: targetUsername, password: testPassword }),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
      });

      // New password succeeds
      const newLogin = await authService.login({ username: targetUsername, password: newPassword });
      expect(newLogin.data.user.username).toBe(targetUsername);
    });

    it('49. Revokes all active sessions upon password reset', async () => {
      const authService = new AuthService(auth, testEnv);

      // Log in as target user to obtain active session
      const login = await authService.login({ username: targetUsername, password: testPassword });
      const targetToken = login.data.accessToken;

      const beforeMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(targetToken, { type: 'bearer' });
      expect(beforeMe.status).toBe(200);

      // Reset password
      const resetRes = await resetPassword(targetStaffId);
      expect(resetRes.status).toBe(200);

      // Session revoked: old token cannot authenticate
      const afterMe = await request(app)
        .get('/api/v1/auth/me')
        .auth(targetToken, { type: 'bearer' });
      expect(afterMe.status).toBe(401);
    });

    it('50. Returns 404 for nonexistent employee ID', async () => {
      const res = await resetPassword('99999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('51. Returns 422 for invalid employee ID format', async () => {
      expect((await resetPassword('invalid')).status).toBe(422);
      expect((await resetPassword('0')).status).toBe(422);
    });

    it('52. Returns 422 when provided password fails complexity/length validation', async () => {
      // Too short (< 15 chars)
      const resShort = await resetPassword(targetStaffId, { password: 'Short1!' });
      expect(resShort.status).toBe(422);

      // Lacks variety (< 8 distinct chars)
      const resUniform = await resetPassword(targetStaffId, {
        password: 'AAAAAAAAAAAAAAAA1',
      });
      expect(resUniform.status).toBe(422);

      // Disallowed extra fields
      const resExtra = await resetPassword(targetStaffId, {
        password: 'ValidPassword123!',
        extraField: 'not_allowed',
      });
      expect(resExtra.status).toBe(422);
    });

    it('53. Rejects unauthenticated request for password reset (401)', async () => {
      const res = await request(app)
        .post(`/api/v1/employees/${targetStaffId}/reset-password`)
        .set('X-CSRF-Protection', '1')
        .send({});
      expect(res.status).toBe(401);
    });

    it('54. Denies unauthorized roles from resetting password (RECEPTIONIST -> 403)', async () => {
      const res = await resetPassword(targetStaffId, {}, receptionistToken);
      expect(res.status).toBe(403);
    });

    it('55. Prevents MANAGER from resetting an ADMIN password (role hierarchy violation)', async () => {
      const adminStaff = await employeeStore.repository.create({
        hotelId,
        roleId: 1n,
        fullName: 'Target Admin To Reset',
        username: 'target_admin_reset',
        email: null,
        passwordHash,
      });

      const res = await resetPassword(adminStaff.id.toString(), {}, managerToken);
      expect(res.status).toBe(403);
    });

    it('56. Prevents MANAGER from resetting a peer MANAGER password', async () => {
      const peerManager = await employeeStore.repository.create({
        hotelId,
        roleId: 2n,
        fullName: 'Peer Manager To Reset',
        username: 'peer_manager_reset',
        email: null,
        passwordHash,
      });

      const res = await resetPassword(peerManager.id.toString(), {}, managerToken);
      expect(res.status).toBe(403);
    });

    it('57. Allows MANAGER to reset password of subordinate role (RECEPTIONIST)', async () => {
      const res = await resetPassword(targetStaffId, {}, managerToken);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(targetStaffId);
    });

    it('58. Enforces tenant scope: cannot reset password of employee in another hotel (404)', async () => {
      // Staff with id '2' belongs to hotelId 1n
      const res = await resetPassword('2');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });
  });
});
