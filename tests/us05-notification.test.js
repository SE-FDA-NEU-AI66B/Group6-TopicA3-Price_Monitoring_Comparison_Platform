import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pool } from '../backend/src/db/pool.js';
import { processPriceObservation } from '../backend/src/background/price-observation/price-observation.processor.js';

const OFFER_ID = '41';
const VARIANT_ID = '31';
const ALERT_ID = '61';
const RECIPIENT = 'demo@pricelens.local';
const PRODUCT_NAME = 'Dell XPS 13 9340';
const TARGET_PRICE = '14000000.00';
const OBSERVED_AT = '2026-10-20T12:00:00.000Z';

const COMPARISONS = {
  '<': (left, right) => left < right,
  '<=': (left, right) => left <= right,
  '>': (left, right) => left > right,
  '>=': (left, right) => left >= right,
};

// Evaluates a threshold column exactly as written in the SQL the processor
// sends, e.g. `$4::NUMERIC <= pa.target_price`, so changing the operator is caught.
function evaluateThreshold(text, column, values) {
  const pattern = new RegExp(`ELSE\\s+(\\$\\d)::NUMERIC\\s*(<=|>=|<|>)\\s*pa\\.target_price(?:\\s*([+-])\\s*(\\d+))?\\s+END AS ${column}`);
  const [, placeholder, operator, sign, offset] = text.match(pattern);
  const left = values[placeholder];
  const right = Number(TARGET_PRICE) + (offset ? Number(`${sign}${offset}`) : 0);

  return left === null ? null : COMPARISONS[operator](Number(left), right);
}

// `previousPrice` is the current price before the new observation, `newPrice`
// the observation being processed, and `lastState` the alert's stored state.
function createFakeDatabaseClient({ previousPrice, newPrice, lastState }) {
  const statements = [];
  let currentPriceReads = 0;

  const answer = (text, parameters) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return [];
    if (/FOR UPDATE OF pv/.test(text)) {
      return [{ retailer_offer_id: OFFER_ID, product_variant_id: VARIANT_ID, product_name: PRODUCT_NAME }];
    }
    if (/AS is_valid_amount/.test(text)) return [{ is_valid_amount: Number(parameters[0]) > 0 }];
    if (/latest_by_offer/.test(text)) {
      currentPriceReads += 1;
      const amount = currentPriceReads === 1 ? previousPrice : newPrice;
      return [{ price_observation_id: currentPriceReads === 1 ? '70' : '71', price_amount: amount, currency_code: 'VND', observed_at: OBSERVED_AT }];
    }
    if (/^INSERT INTO price_observations/.test(text)) {
      return [{
        price_observation_id: '71',
        retailer_offer_id: parameters[0],
        price_amount: parameters[1],
        currency_code: parameters[2],
        availability_status: parameters[3],
        observed_at: parameters[4],
      }];
    }
    if (/^UPDATE retailer_offers/.test(text)) return [{ retailer_offer_id: OFFER_ID }];
    if (/AS is_latest/.test(text)) return [{ is_latest: true }];
    if (/FOR UPDATE OF pa/.test(text)) {
      const values = { $3: parameters[2], $4: parameters[3] };
      return [{
        price_alert_id: ALERT_ID,
        target_price: TARGET_PRICE,
        last_threshold_state: lastState,
        recipient_email: RECIPIENT,
        product_name: PRODUCT_NAME,
        previous_is_above: evaluateThreshold(text, 'previous_is_above', values),
        new_is_at_or_below: evaluateThreshold(text, 'new_is_at_or_below', values),
      }];
    }
    if (/^UPDATE price_alerts/.test(text)) return [{ price_alert_id: parameters[0] }];
    if (/^INSERT INTO notifications/.test(text)) return [{ notification_id: '81' }];
    throw new Error(`Unexpected SQL in fake database client: ${text}`);
  };

  return {
    statements,
    async query(text, parameters = []) {
      const sql = text.trim();
      statements.push({ sql, parameters });
      return { rows: answer(sql, parameters) };
    },
    release() {},
  };
}

function useFakeDatabase(t, scenario) {
  const client = createFakeDatabaseClient(scenario);
  t.mock.method(pool, 'connect', async () => client);
  return client;
}

function observation(priceAmount) {
  return {
    retailerOfferId: OFFER_ID,
    acquisitionStatus: 'SUCCEEDED',
    priceAmount,
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: OBSERVED_AT,
  };
}

function notificationsCreated(client) {
  return client.statements.filter(({ sql }) => sql.startsWith('INSERT INTO notifications'));
}

function savedThresholdState(client) {
  return client.statements.find(({ sql }) => sql.startsWith('UPDATE price_alerts')).parameters[1];
}

test('TC-US05-01 [normal] price falling from above to below the target creates one notification', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '15000000.00', newPrice: '13900000.00', lastState: 'ABOVE_TARGET' });

  const result = await processPriceObservation(observation('13900000.00'));

  assert.equal(result.notificationCount, 1);
  assert.equal(notificationsCreated(client).length, 1);
  assert.equal(notificationsCreated(client)[0].parameters[2], RECIPIENT);
  assert.equal(savedThresholdState(client), 'AT_OR_BELOW_TARGET');
  assert.equal(client.statements.at(-1).sql, 'COMMIT');
});

test('TC-US05-02 [normal] notification subject names the product exactly', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '15000000.00', newPrice: '13900000.00', lastState: 'ABOVE_TARGET' });

  await processPriceObservation(observation('13900000.00'));

  assert.equal(notificationsCreated(client)[0].parameters[3], 'Price Drop Alert: Dell XPS 13 9340');
});

test('TC-US05-03 [error] price staying below the target sends no further notification', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '13900000.00', newPrice: '13800000.00', lastState: 'AT_OR_BELOW_TARGET' });

  const result = await processPriceObservation(observation('13800000.00'));

  assert.equal(result.notificationCount, 0);
  assert.equal(notificationsCreated(client).length, 0);
  assert.equal(savedThresholdState(client), 'AT_OR_BELOW_TARGET');
});

test('TC-US05-04 [normal] price rising above the target re-arms the alert without a notification', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '13800000.00', newPrice: '14200000.00', lastState: 'AT_OR_BELOW_TARGET' });

  const result = await processPriceObservation(observation('14200000.00'));

  assert.equal(result.notificationCount, 0);
  assert.equal(savedThresholdState(client), 'ABOVE_TARGET');
});

test('TC-US05-05 [boundary, on the limit] price falling to exactly the target creates one new notification', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '14200000.00', newPrice: '14000000.00', lastState: 'ABOVE_TARGET' });

  const result = await processPriceObservation(observation('14000000.00'));

  assert.equal(result.notificationCount, 1);
  assert.equal(notificationsCreated(client).length, 1);
  assert.equal(savedThresholdState(client), 'AT_OR_BELOW_TARGET');
});

test('TC-US05-06 [boundary, just above] price falling to 1 VND above the target creates no notification', async (t) => {
  const client = useFakeDatabase(t, { previousPrice: '14200000.00', newPrice: '14000001.00', lastState: 'ABOVE_TARGET' });

  const result = await processPriceObservation(observation('14000001.00'));

  assert.equal(result.notificationCount, 0);
  assert.equal(notificationsCreated(client).length, 0);
  assert.equal(savedThresholdState(client), 'ABOVE_TARGET');
});
