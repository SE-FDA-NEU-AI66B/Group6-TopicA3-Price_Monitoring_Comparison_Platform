import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveProductSource } from '../backend/src/modules/product-sources/product-source.service.js';
import { createTrackedProductForUser } from '../backend/src/modules/tracked-products/tracked-product.service.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const PRODUCT_ID = '21';
const VARIANT_ID = '31';
const DIGITAL_HUB_OFFER_ID = '42';
const DIGITAL_HUB_URL = 'https://digital-hub.example/apple-iphone-15-128gb-black';
const TECHMART_URL = 'https://techmart.example/apple-iphone-15-128gb-black';

const OFFERS_BY_URL = Object.freeze({
  [DIGITAL_HUB_URL]: Object.freeze({ retailer_offer_id: DIGITAL_HUB_OFFER_ID, retailer_id: '2', source_code: 'DIGITAL_HUB', retailer_name: 'Digital Hub', retailer_domain: 'digital-hub.example' }),
  [TECHMART_URL]: Object.freeze({ retailer_offer_id: '41', retailer_id: '1', source_code: 'TECHMART', retailer_name: 'TechMart', retailer_domain: 'techmart.example' }),
});

const IPHONE_15 = Object.freeze({
  product_id: PRODUCT_ID,
  product_variant_id: VARIANT_ID,
  canonical_key: 'apple-iphone-15',
  brand: 'Apple',
  model: 'iPhone 15',
  product_display_name: 'Apple iPhone 15',
});

// Answers the queries behind the Add Product flow; `onInsert` decides what the
// INSERT into tracked_products returns, so a test can simulate a duplicate.
function createCatalogDatabase({ onInsert }) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/WHERE ro\.normalized_url = \$1/.test(text)) {
      const offer = OFFERS_BY_URL[parameters[0]];
      return offer ? [{ ...IPHONE_15, ...offer, normalized_url: parameters[0] }] : [];
    }
    if (/AS also_tracked_at/.test(text)) {
      return [{
        product_variant_id: VARIANT_ID,
        retailer_offer_id: DIGITAL_HUB_OFFER_ID,
        normalized_url: DIGITAL_HUB_URL,
        display_name: 'iPhone 15 128GB Black',
        attributes: { storage: '128GB', color: 'Black' },
        is_tracked: false,
        also_tracked_at: ['TechMart'],
      }];
    }
    if (/WHERE ro\.retailer_offer_id = \$1/.test(text)) {
      return [{
        ...IPHONE_15,
        ...OFFERS_BY_URL[DIGITAL_HUB_URL],
        normalized_url: DIGITAL_HUB_URL,
        variant_display_name: 'iPhone 15 128GB Black',
        variant_attributes: { storage: '128GB', color: 'Black' },
      }];
    }
    if (/^INSERT INTO tracked_products/.test(text)) {
      if (onInsert) return onInsert();
      return [{
        tracked_product_id: '51',
        user_id: parameters[0],
        product_variant_id: parameters[1],
        retailer_offer_id: parameters[2],
        normalized_source_url: parameters[3],
        tracking_status: text.match(/VALUES \([^)]*'(\w+)'\)/)[1],
        created_at: new Date('2026-10-20T12:00:00Z'),
      }];
    }
    return undefined;
  });
}

// resolveProductSource reads through pool.query; createTrackedProductForUser
// opens a transaction through pool.connect. Both are replaced for one test.
function useCatalogDatabase(t, { onInsert } = {}) {
  return useFakeDatabase(t, createCatalogDatabase({ onInsert }));
}

function findStatement(client, prefix) {
  return client.statements.find(({ sql }) => sql.startsWith(prefix));
}

function uniqueViolation(constraint) {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });
}

test('TC-US04-01 [normal] supported retailer URL resolves to its product and selectable variant', async (t) => {
  useCatalogDatabase(t);

  const source = await resolveProductSource(DIGITAL_HUB_URL, USER_ID);

  assert.equal(source.normalized_url, DIGITAL_HUB_URL);
  assert.equal(source.retailer.name, 'Digital Hub');
  assert.equal(source.product.display_name, 'Apple iPhone 15');
  assert.deepEqual(source.variants.map((variant) => variant.display_name), ['iPhone 15 128GB Black']);
});

test('TC-US04-02 [normal] adding the selected variant saves one TRACKING record', async (t) => {
  const client = useCatalogDatabase(t);

  const tracked = await createTrackedProductForUser(DIGITAL_HUB_OFFER_ID, USER_ID);

  assert.equal(tracked.tracking_status, 'TRACKING');
  assert.equal(tracked.source.url, DIGITAL_HUB_URL);
  assert.equal(tracked.product.variant.display_name, 'iPhone 15 128GB Black');
  assert.deepEqual(
    findStatement(client, 'INSERT INTO tracked_products').parameters,
    [USER_ID, VARIANT_ID, DIGITAL_HUB_OFFER_ID, DIGITAL_HUB_URL],
  );
  assert.equal(client.statements.at(-1).sql, 'COMMIT');
});

test('TC-US04-03 [normal] tracking parameters are removed before the URL is looked up', async (t) => {
  const client = useCatalogDatabase(t);

  const source = await resolveProductSource(`${TECHMART_URL}?utm_source=qa`, USER_ID);

  assert.equal(source.normalized_url, TECHMART_URL);
  assert.deepEqual(client.statements[0].parameters, [TECHMART_URL]);
});

test('TC-US04-04 [error] a URL the user already tracks is refused', async (t) => {
  const client = useCatalogDatabase(t, {
    onInsert: () => { throw uniqueViolation('uq_tracked_products_user_source_url'); },
  });

  await assert.rejects(
    createTrackedProductForUser(DIGITAL_HUB_OFFER_ID, USER_ID),
    {
      status: 409,
      code: 'DUPLICATE_TRACKED_URL',
      detail: 'This product URL is already being tracked',
    },
  );
  assert.equal(client.statements.at(-1).sql, 'ROLLBACK');
});

test('TC-US04-05 [error] malformed URL is refused before any lookup', async (t) => {
  const client = useCatalogDatabase(t);

  await assert.rejects(
    resolveProductSource('not-a-url', USER_ID),
    {
      status: 422,
      code: 'INVALID_PRODUCT_URL',
      detail: 'Unsupported or invalid product URL',
    },
  );
  assert.equal(client.statements.length, 0);
});

test('TC-US04-06 [error] URL from an unsupported retailer is refused', async (t) => {
  useCatalogDatabase(t);

  await assert.rejects(
    resolveProductSource('https://unsupported.example/product', USER_ID),
    {
      status: 422,
      code: 'INVALID_PRODUCT_URL',
      detail: 'Unsupported or invalid product URL',
    },
  );
});
