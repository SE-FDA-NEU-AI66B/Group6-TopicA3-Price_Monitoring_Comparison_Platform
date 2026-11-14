import assert from 'node:assert/strict';
import { test } from 'node:test';

import { expectExactlyOneFixture } from './fixtures.js';

test('fixture lookup fails clearly when a natural key is missing or ambiguous', () => {
  assert.throws(
    () => expectExactlyOneFixture([], 'user email missing@example.test'),
    /user email missing@example\.test; found 0/,
  );
  assert.throws(
    () => expectExactlyOneFixture([{}, {}], 'offer URL https:\/\/duplicate.example'),
    /offer URL https:\/\/duplicate\.example; found 2/,
  );
});
