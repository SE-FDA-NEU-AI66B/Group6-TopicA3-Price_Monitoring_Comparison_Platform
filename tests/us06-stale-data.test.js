import assert from 'node:assert/strict';
import { test } from 'node:test';

import { freshnessStatus } from '../backend/src/shared/freshness.js';
import { formatUpdatedAgo, getFreshnessBadge } from '../frontend/src/utils/format.js';

const LAST_UPDATE = '2026-09-15T08:00:00Z';

function at(isoTime) {
  return new Date(isoTime).getTime();
}

test('TC-US06-01 [normal] a price updated 2 hours ago shows "Updated 2 hours ago" and no stale warning', () => {
  const now = at('2026-09-15T10:00:00Z');
  const status = freshnessStatus(LAST_UPDATE, now);

  assert.equal(formatUpdatedAgo(LAST_UPDATE, now), 'Updated 2 hours ago');
  assert.equal(status, 'CURRENT');
  assert.notEqual(getFreshnessBadge(status).label, 'Stale data');
});

test('TC-US06-02 [boundary, just below] a price 1 minute short of 24 hours old is not stale', () => {
  assert.equal(freshnessStatus(LAST_UPDATE, at('2026-09-16T07:59:00Z')), 'CURRENT');
});

test('TC-US06-03 [boundary, on the limit] a price exactly 24 hours old is marked "Stale data"', () => {
  const status = freshnessStatus(LAST_UPDATE, at('2026-09-16T08:00:00Z'));

  assert.equal(status, 'STALE');
  assert.equal(getFreshnessBadge(status).label, 'Stale data');
});

test('TC-US06-04 [boundary, just above] a price 1 minute past 24 hours old stays stale', () => {
  assert.equal(freshnessStatus(LAST_UPDATE, at('2026-09-16T08:01:00Z')), 'STALE');
});

test('TC-US06-05 [normal] a new valid price removes the stale warning and shows "Updated just now"', () => {
  const now = at('2026-09-17T09:00:00Z');
  const newPrice = '2026-09-17T09:00:00Z';

  assert.equal(freshnessStatus(LAST_UPDATE, now), 'STALE');
  assert.equal(freshnessStatus(newPrice, now), 'CURRENT');
  assert.equal(formatUpdatedAgo(newPrice, now), 'Updated just now');
});

test('TC-US06-06 [normal] a product with no recorded price is unavailable, not stale', () => {
  const status = freshnessStatus(null, at('2026-09-16T08:00:00Z'));

  assert.equal(status, 'UNAVAILABLE');
  assert.notEqual(getFreshnessBadge(status).label, 'Stale data');
});
