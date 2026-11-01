import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from '../../shared/problems.js';
import { normalizeProductUrl } from './product-source.service.js';

const CANONICAL_URL = 'https://techmart.example/apple-iphone-15-128gb-black';

test('canonical supported URL remains unchanged', () => {
  assert.equal(normalizeProductUrl(CANONICAL_URL), CANONICAL_URL);
});

test('tracking parameters, fragments and cosmetic URL differences are normalized', () => {
  for (const variant of [
    `${CANONICAL_URL}?utm_source=email`,
    `${CANONICAL_URL}?utm_medium=email&utm_campaign=sale`,
    `${CANONICAL_URL}?gclid=abc123&fbclid=def456`,
    `${CANONICAL_URL}#reviews`,
    `${CANONICAL_URL}/`,
    'https://www.techmart.example/apple-iphone-15-128gb-black',
    'HTTPS://TechMart.example:443/apple-iphone-15-128gb-black',
  ]) {
    assert.equal(normalizeProductUrl(variant), CANONICAL_URL, variant);
  }

  assert.equal(
    normalizeProductUrl(`${CANONICAL_URL}?variant=128gb-black&utm_source=email&color=black`),
    `${CANONICAL_URL}?color=black&variant=128gb-black`,
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
