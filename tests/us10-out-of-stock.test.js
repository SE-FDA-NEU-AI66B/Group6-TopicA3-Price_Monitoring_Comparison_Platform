import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOfferComparisonForUser } from '../backend/src/modules/tracked-products/offer-comparison.service.js';
import { formatStatusLabel } from '../frontend/src/utils/format.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const VARIANT_ID = '31';
const TRACKED = Object.freeze({ tracked_product_id: '51', product_variant_id: VARIANT_ID, retailer_offer_id: '42' });
const OBSERVED_AT = new Date('2026-10-10T08:00:00Z');

const RETAILERS = Object.freeze({
  A: Object.freeze({ retailer_id: '3', source_code: 'GADGET_WORLD', retailer_name: 'Gadget World', domain: 'gadget-world.example' }),
  B: Object.freeze({ retailer_id: '2', source_code: 'DIGITAL_HUB', retailer_name: 'Digital Hub', domain: 'digital-hub.example' }),
  C: Object.freeze({ retailer_id: '1', source_code: 'TECHMART', retailer_name: 'TechMart', domain: 'techmart.example' }),
});

// One comparison row; `difference` is what PostgreSQL computes for in-stock rows.
function offer(id, retailer, amount, availability, difference = null) {
  const { domain, ...retailerColumns } = RETAILERS[retailer];
  return Object.freeze({
    retailer_offer_id: id,
    normalized_url: `https://${domain}/apple-iphone-15-128gb-black`,
    ...retailerColumns,
    price_amount: amount,
    currency_code: 'VND',
    availability_status: availability,
    observed_at: OBSERVED_AT,
    difference_from_lowest: difference,
  });
}

// `offers` must be in the comparison query's sort order (in stock first, then by price).
function createComparisonDatabase(offers) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/FROM tracked_products AS tp/.test(text)) {
      return parameters[0] === TRACKED.tracked_product_id && parameters[1] === USER_ID
        ? [{ ...TRACKED, user_id: USER_ID, tracking_status: 'TRACKING' }]
        : [];
    }
    if (/FROM product_variants AS pv/.test(text)) {
      return [{
        product_id: '21',
        brand: 'Apple',
        model: 'iPhone 15',
        product_display_name: 'Apple iPhone 15',
        product_variant_id: VARIANT_ID,
        variant_display_name: 'iPhone 15 128GB Black',
        variant_attributes: { storage: '128GB', color: 'Black' },
      }];
    }
    if (/^SELECT po\.currency_code/.test(text)) return [{ currency_code: 'VND' }];
    if (/latest_by_offer/.test(text)) return offers;
    return undefined;
  });
}

function compare(t, offers) {
  useFakeDatabase(t, createComparisonDatabase(offers));
  return getOfferComparisonForUser(TRACKED.tracked_product_id, USER_ID);
}

function availabilityOf(comparison, retailerName) {
  return comparison.offers.find((entry) => entry.retailer.name === retailerName).availability_status;
}

test('TC-US10-01 [normal] a retailer with 0 available units is shown exactly as "Out of stock"', async (t) => {
  const comparison = await compare(t, [
    offer('42', 'B', '18500000.00', 'IN_STOCK', '0.00'),
    offer('43', 'A', '18200000.00', 'OUT_OF_STOCK'),
  ]);

  assert.equal(formatStatusLabel(availabilityOf(comparison, 'Gadget World')), 'Out of stock');
  assert.equal(formatStatusLabel(availabilityOf(comparison, 'Digital Hub')), 'In stock');
});

test('TC-US10-02 [error] a cheaper out-of-stock offer at 18,200,000 VND is not the lowest available offer', async (t) => {
  const comparison = await compare(t, [
    offer('42', 'B', '18500000.00', 'IN_STOCK', '0.00'),
    offer('43', 'A', '18200000.00', 'OUT_OF_STOCK'),
  ]);

  assert.equal(comparison.lowest_offer.retailer.name, 'Digital Hub');
  assert.equal(comparison.lowest_offer.amount, '18500000.00');
});

test('TC-US10-03 [error] when every retailer is out of stock the page says so and names no lowest offer', async (t) => {
  const comparison = await compare(t, [
    offer('43', 'A', '18200000.00', 'OUT_OF_STOCK'),
    offer('42', 'B', '18500000.00', 'OUT_OF_STOCK'),
  ]);

  assert.equal(comparison.status, 'ALL_OUT_OF_STOCK');
  assert.equal(comparison.message, 'Currently out of stock across all tracked sources');
  assert.equal(comparison.lowest_offer, null);
});

test('TC-US10-04 [boundary, just below] one in-stock offer among out-of-stock ones is still the lowest available', async (t) => {
  const comparison = await compare(t, [
    offer('44', 'C', '19900000.00', 'IN_STOCK', '0.00'),
    offer('43', 'A', '18200000.00', 'OUT_OF_STOCK'),
    offer('42', 'B', '18500000.00', 'OUT_OF_STOCK'),
  ]);

  assert.equal(comparison.status, 'SINGLE_OFFER');
  assert.equal(comparison.lowest_offer.retailer.name, 'TechMart');
  assert.notEqual(comparison.message, 'Currently out of stock across all tracked sources');
});

test('TC-US10-05 [normal] out-of-stock offers stay listed without a difference from the lowest price', async (t) => {
  const comparison = await compare(t, [
    offer('42', 'B', '18500000.00', 'IN_STOCK', '0.00'),
    offer('44', 'C', '19900000.00', 'IN_STOCK', '1400000.00'),
    offer('43', 'A', '18200000.00', 'OUT_OF_STOCK'),
  ]);

  const outOfStock = comparison.offers.find((entry) => entry.availability_status === 'OUT_OF_STOCK');
  assert.equal(comparison.offers.length, 3);
  assert.equal(outOfStock.difference_from_lowest, null);
});
