import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canLoadHotelOperations,
  isHotelWorkspaceRestricted,
  isSubscriptionPath,
} from '../src/auth/hotelWorkspaceAccess.ts';
import type { CurrentUser, Role } from '../src/types/auth.types.ts';

const user = (
  status: 'ACTIVE' | 'SUSPENDED',
  role: Role = 'ADMIN',
): CurrentUser => ({
  id: '1',
  hotelId: '1',
  username: 'hotel_admin',
  fullName: 'Hotel administrator',
  email: null,
  role,
  isActive: true,
  mustChangePassword: false,
  hotel: {
    id: '1',
    code: 'HOTEL',
    name: 'Hotel',
    timezone: 'Asia/Ho_Chi_Minh',
    status,
  },
});

test('suspended access exception applies only to the subscription route', () => {
  assert.equal(isSubscriptionPath('/subscription'), true);
  assert.equal(isSubscriptionPath('/subscription/'), true);
  for (const path of [
    '/dashboard',
    '/reports',
    '/subscription/settings',
    '/subscription-other',
    '/platform/plans',
  ])
    assert.equal(isSubscriptionPath(path), false);
});
test('suspended hotels retain an account workspace without operational data requests for every staff role', () => {
  for (const role of [
    'ADMIN',
    'MANAGER',
    'RECEPTIONIST',
    'ACCOUNTANT',
    'HOUSEKEEPING',
    'TECHNICIAN',
  ] as Role[]) {
    const profile = user('SUSPENDED', role);
    assert.equal(isHotelWorkspaceRestricted(profile), true);
    assert.equal(canLoadHotelOperations(profile), false);
  }
});
test('operational data loading resumes after reactivation and remains disabled before authentication/password change', () => {
  assert.equal(canLoadHotelOperations(user('ACTIVE')), true);
  assert.equal(isHotelWorkspaceRestricted(user('ACTIVE')), false);
  assert.equal(canLoadHotelOperations(null), false);
  assert.equal(
    canLoadHotelOperations({ ...user('ACTIVE'), mustChangePassword: true }),
    false,
  );
});
