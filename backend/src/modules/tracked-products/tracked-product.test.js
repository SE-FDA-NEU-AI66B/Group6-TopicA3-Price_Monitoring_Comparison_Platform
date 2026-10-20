import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from '../../shared/problems.js';
import { findOwnedTrackedProduct } from './tracked-product.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

function assertTrackedProductNotFound(operation) {
  return assert.rejects(operation, (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 404);
    assert.equal(error.code, 'TRACKED_PRODUCT_NOT_FOUND');
    assert.equal(error.detail, 'Tracked product not found');
    return true;
  });
}

test('owned tracked-product lookup binds both identifiers as query parameters', async () => {
  const calls = [];
  const owned = {
    tracked_product_id: '9007199254740993',
    user_id: '42',
    tracking_status: 'TRACKING',
  };

  const result = await findOwnedTrackedProduct(
    '9007199254740993',
    '42',
    async (text, parameters) => {
      calls.push({ text, parameters });
      return { rows: [owned] };
    },
  );

  assert.equal(result, owned);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /tracked_product_id\s*=\s*\$1/);
  assert.match(calls[0].text, /user_id\s*=\s*\$2/);
  assert.deepEqual(calls[0].parameters, ['9007199254740993', '42']);
});

test('owned record is returned while missing and unowned records share one 404', async () => {
  const owned = { tracked_product_id: '7', user_id: '42' };
  assert.equal(
    await requireOwnedTrackedProduct('7', '42', async () => owned),
    owned,
  );

  const missing = () => requireOwnedTrackedProduct('8', '42', async () => null);
  const unowned = () => requireOwnedTrackedProduct('7', '99', async () => null);

  await assertTrackedProductNotFound(missing);
  await assertTrackedProductNotFound(unowned);
});
