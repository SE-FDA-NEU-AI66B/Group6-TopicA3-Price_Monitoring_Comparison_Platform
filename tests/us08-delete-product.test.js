import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deleteTrackedProductForUser } from '../backend/src/modules/tracked-products/tracked-product.service.js';
import {
  getRemoveConfirmationMessage,
  PRODUCT_REMOVED_MESSAGE,
} from '../frontend/src/utils/helpers.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const OTHER_USER_ID = '12';
const TRACKED_PRODUCT_ID = '21';

// The watchlist of one user: 15 tracked products. DELETE removes a product only
// when it belongs to the user named in the statement, as the SQL WHERE clause does.
function createWatchlistDatabase() {
  const owners = new Map(
    Array.from({ length: 15 }, (_, index) => [String(21 + index), USER_ID]),
  );

  const client = createFakeDatabaseClient((text, parameters) => {
    if (/^DELETE FROM tracked_products/.test(text)) {
      const [trackedProductId, userId] = parameters;
      const checksOwner = /AND user_id = \$2/.test(text);
      if (!owners.has(trackedProductId)) return [];
      if (checksOwner && owners.get(trackedProductId) !== userId) return [];
      owners.delete(trackedProductId);
      return [{ tracked_product_id: trackedProductId }];
    }
    return undefined;
  });

  client.countFor = (userId) => [...owners.values()].filter((owner) => owner === userId).length;
  return client;
}

function watchlistItem(alertCount) {
  return {
    alert_count: alertCount,
    product: {
      display_name: 'Dell XPS 13 9340',
      variant: { display_name: 'XPS 13 16GB/512GB Silver' },
    },
  };
}

function deletions(client) {
  return client.statements.filter(({ sql }) => sql.startsWith('DELETE FROM tracked_products'));
}

test('TC-US08-01 [normal] confirming the deletion leaves 14 of 15 products and shows the removed message', async (t) => {
  const client = useFakeDatabase(t, createWatchlistDatabase());

  await deleteTrackedProductForUser(TRACKED_PRODUCT_ID, USER_ID);

  assert.equal(client.countFor(USER_ID), 14);
  assert.deepEqual(deletions(client)[0].parameters, [TRACKED_PRODUCT_ID, USER_ID]);
  assert.equal(PRODUCT_REMOVED_MESSAGE, 'Product removed from your watchlist');
});

test('TC-US08-02 [normal] a product with 2 alerts asks "Deleting this product will also delete 2 price alerts"', () => {
  assert.equal(
    getRemoveConfirmationMessage(watchlistItem(2)),
    'Deleting this product will also delete 2 price alerts',
  );
});

test('TC-US08-03 [boundary, on the limit] a product with 1 alert names that single alert', () => {
  assert.equal(
    getRemoveConfirmationMessage(watchlistItem(1)),
    'Deleting this product will also delete 1 price alert',
  );
});

test('TC-US08-04 [boundary, just below] a product with no alerts does not mention alerts', () => {
  const message = getRemoveConfirmationMessage(watchlistItem(0));

  assert.equal(message, 'Remove Dell XPS 13 9340 — XPS 13 16GB/512GB Silver from your watchlist?');
  assert.doesNotMatch(message, /alert/);
});

test('TC-US08-05 [error] another user cannot delete the product and the watchlist keeps 15 products', async (t) => {
  const client = useFakeDatabase(t, createWatchlistDatabase());

  await assert.rejects(
    deleteTrackedProductForUser(TRACKED_PRODUCT_ID, OTHER_USER_ID),
    { status: 404, code: 'TRACKED_PRODUCT_NOT_FOUND' },
  );
  assert.equal(client.countFor(USER_ID), 15);
});

test('TC-US08-06 [error] deleting a product that is already removed is refused', async (t) => {
  const client = useFakeDatabase(t, createWatchlistDatabase());

  await deleteTrackedProductForUser(TRACKED_PRODUCT_ID, USER_ID);
  await assert.rejects(
    deleteTrackedProductForUser(TRACKED_PRODUCT_ID, USER_ID),
    { status: 404, code: 'TRACKED_PRODUCT_NOT_FOUND' },
  );
  assert.equal(client.countFor(USER_ID), 14);
});
