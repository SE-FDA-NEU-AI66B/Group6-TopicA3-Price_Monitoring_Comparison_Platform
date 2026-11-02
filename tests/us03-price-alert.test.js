import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPriceAlertForUser } from '../backend/src/modules/tracked-products/price-alert.service.js';
import { COMPARISONS, createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const TRACKED_PRODUCT_ID = '21';
const CURRENT_PRICE = '15000000.00';

// Evaluates the NUMERIC comparison exactly as written in the SQL the service sends.
function evaluateComparison(text, parameters) {
  const match = text.match(/\$1::NUMERIC\s*(<=|>=|<|>)\s*(\$2::NUMERIC|0)/);
  const right = match[2] === '0' ? 0 : Number(parameters[1]);

  return COMPARISONS[match[1]](Number(parameters[0]), right);
}

function createAlertDatabase({ activeAlertCount }) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/FROM tracked_products AS tp/.test(text)) {
      return [{
        tracked_product_id: TRACKED_PRODUCT_ID,
        user_id: USER_ID,
        product_variant_id: '31',
        retailer_offer_id: '41',
      }];
    }
    if (/AS is_positive/.test(text)) return [{ is_positive: evaluateComparison(text, parameters) }];
    if (/AS is_below_current/.test(text)) return [{ is_below_current: evaluateComparison(text, parameters) }];
    if (/FROM product_variants/.test(text)) return [{ product_variant_id: '31' }];
    if (/SELECT po\.currency_code/.test(text)) return [{ currency_code: 'VND' }];
    if (/latest_by_offer/.test(text)) {
      return [{ price_observation_id: '51', price_amount: CURRENT_PRICE, currency_code: 'VND' }];
    }
    if (/FROM users/.test(text)) return [{ user_id: USER_ID }];
    if (/AS active_alert_count/.test(text)) return [{ active_alert_count: activeAlertCount }];
    if (/INSERT INTO price_alerts/.test(text)) {
      return [{
        price_alert_id: '61',
        tracked_product_id: parameters[0],
        target_price: parameters[1],
        currency_code: parameters[2],
        status: 'ACTIVE',
        created_at: new Date('2026-10-20T12:00:00Z'),
      }];
    }
    return undefined;
  });
}

function useAlertDatabase(t, { activeAlertCount = 5 } = {}) {
  return useFakeDatabase(t, createAlertDatabase({ activeAlertCount }));
}

function insertedAlert(client) {
  return client.statements.some(({ sql }) => sql.startsWith('INSERT INTO price_alerts'));
}

test('TC-US03-01 [normal] target below the current price creates an active alert', async (t) => {
  const client = useAlertDatabase(t);

  const alert = await createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, '14000000.00');

  assert.equal(alert.status, 'ACTIVE');
  assert.equal(alert.target_price, '14000000.00');
  assert.equal(alert.current_price, CURRENT_PRICE);
  assert.equal(insertedAlert(client), true);
  assert.equal(client.statements.at(-1).sql, 'COMMIT');
});

test('TC-US03-02 [error] target above the current price is refused', async (t) => {
  const client = useAlertDatabase(t);

  await assert.rejects(
    createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, '16000000.00'),
    {
      status: 422,
      code: 'TARGET_PRICE_NOT_BELOW_CURRENT',
      detail: 'Target price must be lower than the current price',
    },
  );
  assert.equal(insertedAlert(client), false);
  assert.equal(client.statements.at(-1).sql, 'ROLLBACK');
});

test('TC-US03-03 [error] target price of 0 is refused', async (t) => {
  const client = useAlertDatabase(t);

  await assert.rejects(
    createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, '0'),
    {
      status: 422,
      code: 'TARGET_PRICE_NOT_POSITIVE',
      detail: 'Target price must be greater than 0',
    },
  );
  assert.equal(insertedAlert(client), false);
});

test('TC-US03-04 [boundary, on the limit] user with 19 active alerts can create the 20th', async (t) => {
  const client = useAlertDatabase(t, { activeAlertCount: 19 });

  const alert = await createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, '14000000.00');

  assert.equal(alert.status, 'ACTIVE');
  assert.equal(insertedAlert(client), true);
});

test('TC-US03-05 [boundary, just above] user with 20 active alerts cannot create a 21st', async (t) => {
  const client = useAlertDatabase(t, { activeAlertCount: 20 });

  await assert.rejects(
    createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, '14000000.00'),
    {
      status: 409,
      code: 'ACTIVE_ALERT_LIMIT_REACHED',
      detail: 'Maximum 20 active alerts reached',
    },
  );
  assert.equal(insertedAlert(client), false);
});

test('TC-US03-06 [boundary, on the limit] target equal to the current price is refused', async (t) => {
  const client = useAlertDatabase(t);

  await assert.rejects(
    createPriceAlertForUser(TRACKED_PRODUCT_ID, USER_ID, CURRENT_PRICE),
    { status: 422, code: 'TARGET_PRICE_NOT_BELOW_CURRENT' },
  );
  assert.equal(insertedAlert(client), false);
});
