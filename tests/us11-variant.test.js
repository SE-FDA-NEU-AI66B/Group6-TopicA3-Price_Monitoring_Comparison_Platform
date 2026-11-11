import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOfferComparisonForUser } from '../backend/src/modules/tracked-products/offer-comparison.service.js';
import {
  parseCreateTrackedProductBody,
  SELECT_VARIANT_MESSAGE,
} from '../backend/src/modules/tracked-products/tracked-product.validation.js';
import { SELECT_VARIANT_MESSAGE as PAGE_SELECT_VARIANT_MESSAGE } from '../frontend/src/utils/helpers.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const VARIANT_128GB_ID = '31';
const VARIANT_256GB_ID = '32';
const TRACKED_256GB = Object.freeze({ tracked_product_id: '52', product_variant_id: VARIANT_256GB_ID, retailer_offer_id: '44' });
const OBSERVED_AT = new Date('2026-10-10T08:00:00Z');

function offer(id, variantId, retailerName, amount, difference) {
  return Object.freeze({
    retailer_offer_id: id,
    product_variant_id: variantId,
    normalized_url: `https://shop.example/${id}`,
    retailer_id: id,
    source_code: retailerName.toUpperCase().replace(/\s+/g, '_'),
    retailer_name: retailerName,
    price_amount: amount,
    currency_code: 'VND',
    availability_status: 'IN_STOCK',
    observed_at: OBSERVED_AT,
    difference_from_lowest: difference,
  });
}

// One retailer sells only the 128 GB variant; the comparison query returns the
// offers of the variant named in its first parameter, as the SQL WHERE clause does.
const OFFERS = Object.freeze([
  offer('44', VARIANT_256GB_ID, 'Gadget World', '20000000.00', '0.00'),
  offer('45', VARIANT_256GB_ID, 'TechMart', '20500000.00', '500000.00'),
  offer('41', VARIANT_128GB_ID, 'Digital Hub', '18000000.00', '0.00'),
]);

function createComparisonDatabase() {
  return createFakeDatabaseClient((text, parameters) => {
    if (/FROM tracked_products AS tp/.test(text)) {
      return parameters[0] === TRACKED_256GB.tracked_product_id
        ? [{ ...TRACKED_256GB, user_id: USER_ID, tracking_status: 'TRACKING' }]
        : [];
    }
    if (/FROM product_variants AS pv/.test(text)) {
      return [{
        product_id: '21',
        brand: 'Apple',
        model: 'iPhone 15',
        product_display_name: 'Apple iPhone 15',
        product_variant_id: VARIANT_256GB_ID,
        variant_display_name: 'iPhone 15 256GB Black',
        variant_attributes: { storage: '256GB', color: 'Black' },
      }];
    }
    if (/^SELECT po\.currency_code/.test(text)) return [{ currency_code: 'VND' }];
    if (/latest_by_offer/.test(text)) {
      return OFFERS
        .filter((row) => row.product_variant_id === parameters[0])
        .map(({ product_variant_id, ...row }) => row);
    }
    return undefined;
  });
}

test('TC-US11-01 [normal] choosing the 256 GB option sends exactly that one variant offer', () => {
  assert.deepEqual(parseCreateTrackedProductBody({ retailer_offer_id: '44' }), { retailerOfferId: '44' });
});

test('TC-US11-02 [error] starting to track without choosing a variant is refused with "Select 1 product variant to continue"', () => {
  assert.throws(() => parseCreateTrackedProductBody({}), {
    status: 400,
    code: 'INVALID_REQUEST',
    detail: 'Select 1 product variant to continue',
  });
});

test('TC-US11-03 [error] an empty variant choice is refused with the same message', () => {
  assert.throws(() => parseCreateTrackedProductBody({ retailer_offer_id: '  ' }), {
    status: 400,
    detail: 'Select 1 product variant to continue',
  });
});

test('TC-US11-04 [normal] the Add Product page shows the same message as the server', () => {
  assert.equal(PAGE_SELECT_VARIANT_MESSAGE, SELECT_VARIANT_MESSAGE);
});

test('TC-US11-05 [error] a cheaper 128 GB offer does not change the tracked 256 GB price of 20,000,000 VND', async (t) => {
  const client = useFakeDatabase(t, createComparisonDatabase());

  const comparison = await getOfferComparisonForUser(TRACKED_256GB.tracked_product_id, USER_ID);

  assert.equal(comparison.lowest_offer.amount, '20000000.00');
  const comparisonQuery = client.statements.find(({ sql }) => /latest_by_offer/.test(sql));
  assert.equal(comparisonQuery.parameters[0], VARIANT_256GB_ID);
});

test('TC-US11-06 [error] a retailer that sells only the 128 GB variant is excluded from the 256 GB offers', async (t) => {
  useFakeDatabase(t, createComparisonDatabase());

  const comparison = await getOfferComparisonForUser(TRACKED_256GB.tracked_product_id, USER_ID);

  assert.deepEqual(comparison.offers.map((entry) => entry.retailer.name), ['Gadget World', 'TechMart']);
});
