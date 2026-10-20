import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assembleOfferComparison,
  comparisonState,
  NO_MULTI_SOURCE_MESSAGE,
} from './offer-comparison.service.js';

test('comparison states preserve the documented successful outcomes', () => {
  assert.deepEqual(comparisonState(0), {
    status: 'NO_AVAILABLE_OFFERS',
    message: null,
  });
  assert.deepEqual(comparisonState(1), {
    status: 'SINGLE_OFFER',
    message: NO_MULTI_SOURCE_MESSAGE,
  });
  assert.deepEqual(comparisonState(2), {
    status: 'AVAILABLE',
    message: null,
  });
  assert.throws(() => comparisonState(-1), /non-negative integer/);
});

test('offer comparison assembly keeps identifiers and exact money strings', () => {
  const context = {
    product_id: '9007199254740994',
    brand: 'Apple',
    model: 'iPhone 15',
    product_display_name: 'Apple iPhone 15',
    product_variant_id: '9007199254740995',
    variant_display_name: 'iPhone 15 256GB Black',
    variant_attributes: { storage: '256GB', color: 'Black' },
  };
  const rows = [
    comparisonRow({
      retailerOfferId: '9007199254740997',
      retailerId: '9007199254740999',
      sourceCode: 'SOURCE_B',
      retailerName: 'Source B',
      amount: '18500000.00',
      difference: '0.00',
    }),
    comparisonRow({
      retailerOfferId: '9007199254740996',
      retailerId: '9007199254740998',
      sourceCode: 'SOURCE_A',
      retailerName: 'Source A',
      amount: '18900000.00',
      difference: '400000.00',
    }),
  ];

  const result = assembleOfferComparison({
    trackedProductId: '9007199254740993',
    context,
    rows,
  });

  assert.equal(result.tracked_product_id, '9007199254740993');
  assert.equal(result.product.variant.product_variant_id, '9007199254740995');
  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.message, null);
  assert.deepEqual(
    result.offers.map(({ amount, difference_from_lowest: difference }) => ({
      amount,
      difference,
    })),
    [
      { amount: '18500000.00', difference: '0.00' },
      { amount: '18900000.00', difference: '400000.00' },
    ],
  );
  assert.deepEqual(result.lowest_offer, result.offers[0]);
  assert.equal(typeof result.offers[0].retailer_offer_id, 'string');
  assert.equal(result.offers[0].observed_at, '2026-10-12T08:00:00.000Z');
});

function comparisonRow({
  retailerOfferId,
  retailerId,
  sourceCode,
  retailerName,
  amount,
  difference,
}) {
  return {
    retailer_offer_id: retailerOfferId,
    normalized_url: `https://${sourceCode.toLowerCase()}.example/item`,
    retailer_id: retailerId,
    source_code: sourceCode,
    retailer_name: retailerName,
    price_amount: amount,
    currency_code: 'VND',
    availability_status: 'IN_STOCK',
    observed_at: new Date('2026-10-12T08:00:00.000Z'),
    difference_from_lowest: difference,
  };
}
