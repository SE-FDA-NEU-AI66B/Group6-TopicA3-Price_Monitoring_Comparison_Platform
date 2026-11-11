import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from '../../shared/problems.js';
import {
  countActiveAlertsForUser,
  insertPriceAlert,
  isPositiveTargetPrice,
  isTargetPriceBelowCurrent,
  lockUserForAlertCreation,
} from './price-alert.repository.js';
import { assemblePriceAlert } from './price-alert.service.js';
import { parseCreatePriceAlertBody } from './price-alert.validation.js';

test('price-alert validation requires a decimal string and preserves precision', () => {
  assert.deepEqual(parseCreatePriceAlertBody({
    target_price: '14000000.25',
  }), {
    targetPrice: '14000000.25',
  });
  assert.equal(
    parseCreatePriceAlertBody({ target_price: '-1.25' }).targetPrice,
    '-1.25',
  );

  for (const body of [
    undefined,
    null,
    {},
    { target_price: null },
    { target_price: true },
    { target_price: [] },
    { target_price: {} },
    { target_price: '' },
    { target_price: 'abc' },
    { target_price: '1,000' },
    { target_price: '1.234' },
  ]) {
    assert.throws(
      () => parseCreatePriceAlertBody(body),
      (error) => error instanceof HttpError
        && error.status === 400
        && error.code === 'INVALID_REQUEST',
    );
  }
});

test('money rules are delegated to PostgreSQL NUMERIC with parameterized values', async () => {
  const calls = [];
  const executeQuery = async (text, parameters) => {
    calls.push({ text, parameters });

    if (parameters.length === 1) {
      return { rows: [{ is_positive: true }] };
    }

    return { rows: [{ is_below_current: true }] };
  };

  assert.equal(
    await isPositiveTargetPrice('14000000.25', executeQuery),
    true,
  );
  assert.equal(await isTargetPriceBelowCurrent({
    targetPrice: '14000000.25',
    currentPrice: '15000000.00',
  }, executeQuery), true);

  assert.match(calls[0].text, /\$1::NUMERIC\s*>\s*0/);
  assert.deepEqual(calls[0].parameters, ['14000000.25']);
  assert.match(calls[1].text, /\$1::NUMERIC\s*<\s*\$2::NUMERIC/);
  assert.deepEqual(calls[1].parameters, ['14000000.25', '15000000.00']);
});

test('BR1 repository operations lock one user and keep count plus insert parameterized', async () => {
  const calls = [];
  const executeQuery = async (text, parameters) => {
    calls.push({ text, parameters });

    if (/FOR UPDATE/.test(text)) {
      return { rows: [{ user_id: '9007199254740993' }] };
    }

    if (/active_alert_count/.test(text)) {
      return { rows: [{ active_alert_count: 19 }] };
    }

    return {
      rows: [{
        price_alert_id: '71',
        tracked_product_id: '9007199254740995',
        target_price: '14000000.25',
        currency_code: 'VND',
        status: 'ACTIVE',
        last_threshold_state: 'ABOVE_TARGET',
        price_observation_id: '81',
        last_evaluated_at: new Date('2026-10-20T10:00:00.000Z'),
        created_at: new Date('2026-10-20T10:00:00.000Z'),
      }],
    };
  };

  const user = await lockUserForAlertCreation(
    '9007199254740993',
    executeQuery,
  );
  const count = await countActiveAlertsForUser(
    '9007199254740993',
    executeQuery,
  );
  const inserted = await insertPriceAlert({
    trackedProductId: '9007199254740995',
    targetPrice: '14000000.25',
    currencyCode: 'VND',
    priceObservationId: '81',
  }, executeQuery);

  assert.equal(user.user_id, '9007199254740993');
  assert.equal(count, 19);
  assert.equal(inserted.status, 'ACTIVE');
  assert.match(calls[0].text, /FROM users[\s\S]*FOR UPDATE/);
  assert.deepEqual(calls[0].parameters, ['9007199254740993']);
  assert.match(calls[1].text, /pa\.status = 'ACTIVE'/);
  assert.match(calls[1].text, /tp\.user_id = \$1/);
  assert.deepEqual(calls[1].parameters, ['9007199254740993']);
  assert.match(calls[2].text, /'ACTIVE', 'ABOVE_TARGET'/);
  assert.deepEqual(calls[2].parameters, [
    '9007199254740995',
    '14000000.25',
    'VND',
    '81',
  ]);
});

test('PriceAlert response contains only the documented public representation', () => {
  const data = assemblePriceAlert({
    alert: {
      price_alert_id: '71',
      tracked_product_id: '9007199254740995',
      target_price: '14000000.25',
      currency_code: 'VND',
      status: 'ACTIVE',
      last_threshold_state: 'ABOVE_TARGET',
      price_observation_id: '81',
      created_at: new Date('2026-10-20T10:00:00.000Z'),
    },
    currentPrice: {
      price_observation_id: '81',
      price_amount: '15000000.00',
      currency_code: 'VND',
    },
  });

  assert.deepEqual(data, {
    price_alert_id: '71',
    tracked_product_id: '9007199254740995',
    target_price: '14000000.25',
    currency_code: 'VND',
    status: 'ACTIVE',
    current_price: '15000000.00',
    created_at: '2026-10-20T10:00:00.000Z',
  });
});
