import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SubscriptionSummary } from '../src/api/subscriptions.api.ts';
import type { HotelPeriod } from '../src/types/hotel.types.ts';
import { subscriptionPlanState } from '../src/utils/subscriptions.ts';

const period = (planId: string | null): HotelPeriod => ({
  id: '10',
  planId,
  planName: 'Tiêu chuẩn',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  feeAmount: '599000',
  currency: 'VND',
  monthlyPrice: '599000',
  agreementReference: null,
  paymentReference: null,
  notes: null,
  createdAt: '2026-11-01T00:00:00Z',
});
const summary = (
  overrides: Partial<SubscriptionSummary> = {},
): SubscriptionSummary => ({
  id: '1',
  today: '2026-11-16',
  timezone: 'Asia/Ho_Chi_Minh',
  hotelStatus: 'ACTIVE',
  status: 'ACTIVE',
  daysRemaining: 14,
  alert: null,
  suspensionReason: null,
  current: period('2'),
  upcoming: null,
  history: [],
  usage: { rooms: 10, staff: 5, roomLimit: 50, staffLimit: 25 },
  nextStartsOn: '2026-12-01',
  ...overrides,
});

test('catalog identifies the current plan by ID even when catalog names or prices change', () => {
  assert.equal(subscriptionPlanState('2', summary()), 'current');
  assert.equal(subscriptionPlanState('3', summary()), null);
  assert.equal(
    subscriptionPlanState('2', summary({ status: 'EXPIRING' })),
    'current',
  );
  assert.equal(
    subscriptionPlanState('2', summary({ hotelStatus: 'SUSPENDED' })),
    'current',
  );
  assert.equal(
    subscriptionPlanState('2', summary({ current: period(null) })),
    null,
  );
});

test('expired or unconfigured subscriptions never mark a catalog plan as currently in use', () => {
  assert.equal(
    subscriptionPlanState(
      '2',
      summary({ status: 'EXPIRED', daysRemaining: -5 }),
    ),
    null,
  );
  assert.equal(
    subscriptionPlanState(
      '2',
      summary({ status: 'UNCONFIGURED', current: null }),
    ),
    null,
  );
  assert.equal(subscriptionPlanState('2'), null);
});

test('scheduled plans have a separate state and renewing the current plan retains its current badge', () => {
  const next = period('3');
  assert.equal(
    subscriptionPlanState('3', summary({ upcoming: next })),
    'upcoming',
  );
  assert.equal(
    subscriptionPlanState('2', summary({ upcoming: next })),
    'current',
  );
  assert.equal(
    subscriptionPlanState(
      '3',
      summary({ status: 'UPCOMING', current: null, upcoming: next }),
    ),
    'upcoming',
  );
  assert.equal(
    subscriptionPlanState('2', summary({ upcoming: period('2') })),
    'current',
  );
  assert.equal(
    subscriptionPlanState(
      '2',
      summary({ status: 'EXPIRED', upcoming: period('2') }),
    ),
    'upcoming',
  );
});
