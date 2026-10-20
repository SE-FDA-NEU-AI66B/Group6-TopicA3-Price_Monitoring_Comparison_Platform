import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from '../../shared/problems.js';
import {
  APPROVED_TRACKING_PARAMETERS,
  normalizeProductUrl,
} from './product-source.service.js';

const CANONICAL_URL = 'https://techmart.example/apple-iphone-15-128gb-black';

test('canonical supported URL remains unchanged', () => {
  assert.equal(normalizeProductUrl(CANONICAL_URL), CANONICAL_URL);
});

test('only the documented utm_source parameter is removed deterministically', () => {
  assert.deepEqual(APPROVED_TRACKING_PARAMETERS, ['utm_source']);
  assert.equal(
    normalizeProductUrl(`${CANONICAL_URL}?utm_source=email`),
    CANONICAL_URL,
  );
  assert.equal(
    normalizeProductUrl(`${CANONICAL_URL}?variant=128gb-black&utm_source=email`),
    `${CANONICAL_URL}?variant=128gb-black`,
  );
});

test('malformed URL normalization uses the approved invalid-product problem', () => {
  assert.throws(
    () => normalizeProductUrl('not-a-url'),
    (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 422);
      assert.equal(error.code, 'INVALID_PRODUCT_URL');
      assert.equal(error.detail, 'Unsupported or invalid product URL');
      return true;
    },
  );
});
