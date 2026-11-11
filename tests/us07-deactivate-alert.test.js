import assert from 'node:assert/strict';
import { test } from 'node:test';

import { processPriceObservation } from '../backend/src/background/price-observation/price-observation.processor.js';
import { updatePriceAlertStatusForUser } from '../backend/src/modules/tracked-products/price-alert.service.js';
import { formatStatusLabel } from '../frontend/src/utils/format.js';
import { COMPARISONS, createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const TRACKED_PRODUCT_ID = '21';
const VARIANT_ID = '31';
const OFFER_ID = '41';
const ALERT_ID = '61';
const TARGET_PRICE = '14000000.00';
const CURRENT_PRICE = '15000000.00';
const OBSERVED_AT = '2026-10-20T12:00:00.000Z';

function alertRow(status, lastState = 'ABOVE_TARGET') {
  return {
    price_alert_id: ALERT_ID,
    tracked_product_id: TRACKED_PRODUCT_ID,
    target_price: TARGET_PRICE,
    currency_code: 'VND',
    status,
    last_threshold_state: lastState,
    created_at: new Date('2026-10-15T08:00:00Z'),
  };
}

// Answers the queries behind PATCH /tracked-products/:id/alerts/:alertId.
function createAlertStatusDatabase({ alertStatus, activeAlertCount }) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/AS active_alert_count/.test(text)) return [{ active_alert_count: activeAlertCount }];
    if (/FROM tracked_products AS tp/.test(text)) {
      return parameters[0] === TRACKED_PRODUCT_ID && parameters[1] === USER_ID
        ? [{ tracked_product_id: TRACKED_PRODUCT_ID, user_id: USER_ID, product_variant_id: VARIANT_ID, retailer_offer_id: OFFER_ID }]
        : [];
    }
    if (/FROM product_variants/.test(text)) return [{ product_variant_id: VARIANT_ID }];
    if (/FROM price_alerts\s+WHERE price_alert_id = \$1/.test(text)) {
      return parameters[0] === ALERT_ID ? [alertRow(alertStatus)] : [];
    }
    if (/FROM users/.test(text)) return [{ user_id: USER_ID }];
    if (/latest_by_offer/.test(text)) {
      return [{ price_observation_id: '51', price_amount: CURRENT_PRICE, currency_code: 'VND', observed_at: OBSERVED_AT }];
    }
    if (/AS is_below_current/.test(text)) {
      const operator = text.match(/\$1::NUMERIC\s*(<=|>=|<|>)\s*\$2::NUMERIC/)[1];
      return [{ is_below_current: COMPARISONS[operator](Number(parameters[0]), Number(parameters[1])) }];
    }
    if (/^UPDATE price_alerts/.test(text)) {
      return [{ ...alertRow(parameters[1], parameters[2]) }];
    }
    return undefined;
  });
}

function useAlertStatusDatabase(t, { alertStatus, activeAlertCount = 5 }) {
  return useFakeDatabase(t, createAlertStatusDatabase({ alertStatus, activeAlertCount }));
}

function changeStatus(status) {
  return updatePriceAlertStatusForUser(
    { trackedProductId: TRACKED_PRODUCT_ID, priceAlertId: ALERT_ID, status },
    USER_ID,
  );
}

function statusUpdate(client) {
  return client.statements.find(({ sql }) => sql.startsWith('UPDATE price_alerts'));
}

// Answers the queries of a price observation. The alert query returns the alert
// only when its status passes the filter written in the SQL, as PostgreSQL would.
function createObservationDatabase({ alertStatus }) {
  let currentPriceReads = 0;

  return createFakeDatabaseClient((text, parameters) => {
    if (/FOR UPDATE OF pv/.test(text)) {
      return [{ retailer_offer_id: OFFER_ID, product_variant_id: VARIANT_ID, product_name: 'Dell XPS 13 9340' }];
    }
    if (/AS is_valid_amount/.test(text)) return [{ is_valid_amount: Number(parameters[0]) > 0 }];
    if (/latest_by_offer/.test(text)) {
      currentPriceReads += 1;
      const amount = currentPriceReads === 1 ? CURRENT_PRICE : '13900000.00';
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
      const statusFilter = text.match(/pa\.status = '([A-Z_]+)'/)?.[1];
      if (statusFilter && statusFilter !== alertStatus) return [];
      return [{
        price_alert_id: ALERT_ID,
        target_price: TARGET_PRICE,
        last_threshold_state: 'ABOVE_TARGET',
        recipient_email: 'demo@pricelens.local',
        product_name: 'Dell XPS 13 9340',
        previous_is_above: Number(parameters[2]) > Number(TARGET_PRICE),
        new_is_at_or_below: Number(parameters[3]) <= Number(TARGET_PRICE),
      }];
    }
    if (/^UPDATE price_alerts/.test(text)) return [{ price_alert_id: parameters[0] }];
    if (/^INSERT INTO notifications/.test(text)) return [{ notification_id: '81' }];
    return undefined;
  });
}

test('TC-US07-01 [normal] deactivating an alert makes it "Inactive" and keeps its 14,000,000 VND target', async (t) => {
  const client = useAlertStatusDatabase(t, { alertStatus: 'ACTIVE' });

  const alert = await changeStatus('INACTIVE');

  assert.equal(alert.status, 'INACTIVE');
  assert.equal(formatStatusLabel(alert.status), 'Inactive');
  assert.equal(alert.target_price, TARGET_PRICE);
  assert.equal(statusUpdate(client).parameters[1], 'INACTIVE');
  assert.equal(client.statements.at(-1).sql, 'COMMIT');
});

test('TC-US07-02 [error] an inactive alert sends no email when the price falls to 13,900,000 VND', async (t) => {
  const client = useFakeDatabase(t, createObservationDatabase({ alertStatus: 'INACTIVE' }));

  const result = await processPriceObservation({
    retailerOfferId: OFFER_ID,
    acquisitionStatus: 'SUCCEEDED',
    priceAmount: '13900000.00',
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: OBSERVED_AT,
  });

  assert.equal(result.notificationCount, 0);
  assert.equal(client.statements.some(({ sql }) => sql.startsWith('INSERT INTO notifications')), false);
});

test('TC-US07-03 [boundary, just above] reactivating with 20 active alerts is refused', async (t) => {
  const client = useAlertStatusDatabase(t, { alertStatus: 'INACTIVE', activeAlertCount: 20 });

  await assert.rejects(changeStatus('ACTIVE'), {
    status: 409,
    code: 'ACTIVE_ALERT_LIMIT_REACHED',
    detail: 'Maximum 20 active alerts reached',
  });
  assert.equal(statusUpdate(client), undefined);
  assert.equal(client.statements.at(-1).sql, 'ROLLBACK');
});

test('TC-US07-04 [boundary, on the limit] reactivating with 19 active alerts makes it the 20th active alert', async (t) => {
  const client = useAlertStatusDatabase(t, { alertStatus: 'INACTIVE', activeAlertCount: 19 });

  const alert = await changeStatus('ACTIVE');

  assert.equal(alert.status, 'ACTIVE');
  assert.equal(statusUpdate(client).parameters[1], 'ACTIVE');
});

test('TC-US07-05 [normal] reactivating while the price is above the target re-arms the alert', async (t) => {
  const client = useAlertStatusDatabase(t, { alertStatus: 'INACTIVE' });

  await changeStatus('ACTIVE');

  assert.equal(statusUpdate(client).parameters[2], 'ABOVE_TARGET');
});

test('TC-US07-06 [normal] deactivating is allowed even when the user has 20 active alerts', async (t) => {
  useAlertStatusDatabase(t, { alertStatus: 'ACTIVE', activeAlertCount: 20 });

  const alert = await changeStatus('INACTIVE');

  assert.equal(alert.status, 'INACTIVE');
});
