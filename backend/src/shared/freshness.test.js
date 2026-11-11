import assert from 'node:assert/strict';
import { test } from 'node:test';

import { freshnessStatus } from './freshness.js';

test('BR3 marks a price stale at exactly 24 hours', () => {
  const lastUpdate = '2026-09-15T08:00:00.000Z';

  assert.equal(freshnessStatus(lastUpdate, Date.parse('2026-09-16T07:59:00.000Z')), 'CURRENT');
  assert.equal(freshnessStatus(lastUpdate, Date.parse('2026-09-16T08:00:00.000Z')), 'STALE');
  assert.equal(freshnessStatus(new Date(lastUpdate), Date.parse('2026-09-17T08:00:00.000Z')), 'STALE');
  assert.equal(freshnessStatus(null), 'UNAVAILABLE');
});
