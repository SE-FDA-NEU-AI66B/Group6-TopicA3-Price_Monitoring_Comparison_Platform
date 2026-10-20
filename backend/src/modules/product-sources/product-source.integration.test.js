import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../../app.js';
import { config } from '../../config.js';
import { closePool } from '../../db/pool.js';
import { assertProblemCode } from '../../test-support/assertions.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import {
  deleteTrackedProductByOwnerAndUrl,
  missingRetailerOfferId,
  offerByNormalizedUrl,
  P0_FIXTURE_KEYS,
  TEST_USERS,
  trackedProductByOwnerAndUrl,
  trackedProductCountByOwnerEmail,
  userByEmail,
} from '../../test-support/fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../../test-support/request.js';
import { withTestServer } from '../../test-support/server.js';

after(() => closePool());

test('API-03 resolves supported URLs and rejects malformed, unsupported or unauthenticated requests', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  const submittedOffer = await offerByNormalizedUrl(P0_FIXTURE_KEYS.us04.duplicateUrl);
  const otherTechMartOffer = await offerByNormalizedUrl(P0_FIXTURE_KEYS.us03.boundaryUrl);

  await withTestServer(app, async ({ baseUrl }) => {
    const guest = await requestJson(baseUrl, '/api/product-sources/resolve', {
      method: 'POST',
      json: { url: P0_FIXTURE_KEYS.us04.duplicateUrl },
    });
    assertProblemCode(guest, 'AUTHENTICATION_REQUIRED', { status: 401 });

    const session = await loginAs(baseUrl, TEST_USERS.demo);
    const canonical = await authenticatedRequest(
      session,
      '/api/product-sources/resolve',
      { method: 'POST', json: { url: P0_FIXTURE_KEYS.us04.duplicateUrl } },
    );

    assert.equal(canonical.status, 200);
    assert.equal(canonical.body.data.normalized_url, P0_FIXTURE_KEYS.us04.duplicateUrl);
    assert.equal(canonical.body.data.retailer.source_code, P0_FIXTURE_KEYS.us04.sourceCode);
    assert.equal(canonical.body.data.product.canonical_key, 'apple-iphone-15');
    assert.deepEqual(
      new Set(canonical.body.data.variants.map((variant) => variant.retailer_offer_id)),
      new Set([
        submittedOffer.retailer_offer_id,
        otherTechMartOffer.retailer_offer_id,
      ]),
    );
    assert.ok(canonical.body.data.variants.every(
      (variant) => typeof variant.product_variant_id === 'string',
    ));

    const tracked = await authenticatedRequest(
      session,
      '/api/product-sources/resolve',
      {
        method: 'POST',
        json: { url: `${P0_FIXTURE_KEYS.us04.duplicateUrl}?utm_source=email` },
      },
    );
    assert.equal(tracked.status, 200);
    assert.equal(tracked.body.data.normalized_url, canonical.body.data.normalized_url);

    for (const url of [
      'not-a-url',
      'https://unsupported.example/product/123',
      'https://techmart.example/not-a-seeded-product',
    ]) {
      const rejected = await authenticatedRequest(
        session,
        '/api/product-sources/resolve',
        { method: 'POST', json: { url } },
      );
      assertProblemCode(rejected, 'INVALID_PRODUCT_URL', {
        status: 422,
        detail: 'Unsupported or invalid product URL',
      });
    }
  });
});

test('API-04 creates one owned exact-variant row and leaves counts unchanged on failures', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  try {
    const demoUser = await userByEmail(TEST_USERS.demo.email);
    const boundaryUser = await userByEmail(TEST_USERS.alertBoundary.email);
    const baselineCount = await trackedProductCountByOwnerEmail(TEST_USERS.demo.email);
    const duplicateOffer = await offerByNormalizedUrl(P0_FIXTURE_KEYS.us04.duplicateUrl);
    const creationOffer = await offerByNormalizedUrl(P0_FIXTURE_KEYS.us04.creationUrl);
    const missingOfferId = await missingRetailerOfferId();

    assert.equal(baselineCount, 10);

    await withTestServer(app, async ({ baseUrl }) => {
      const guest = await requestJson(
        baseUrl,
        `/api/tracked-products?user_id=${boundaryUser.user_id}`,
        {
          method: 'POST',
          json: { retailer_offer_id: creationOffer.retailer_offer_id },
        },
      );
      assertProblemCode(guest, 'AUTHENTICATION_REQUIRED', { status: 401 });
      assert.equal(
        await trackedProductCountByOwnerEmail(TEST_USERS.demo.email),
        baselineCount,
      );

      const session = await loginAs(baseUrl, TEST_USERS.demo);
      const normalizedDuplicate = await authenticatedRequest(
        session,
        '/api/product-sources/resolve',
        {
          method: 'POST',
          json: { url: `${P0_FIXTURE_KEYS.us04.duplicateUrl}?utm_source=email` },
        },
      );
      const duplicateSelection = normalizedDuplicate.body.data.variants.find(
        (variant) => variant.retailer_offer_id === duplicateOffer.retailer_offer_id,
      );
      assert.ok(duplicateSelection);

      const seededDuplicate = await authenticatedRequest(
        session,
        '/api/tracked-products',
        {
          method: 'POST',
          json: { retailer_offer_id: duplicateSelection.retailer_offer_id },
        },
      );
      assertProblemCode(seededDuplicate, 'DUPLICATE_TRACKED_URL', {
        status: 409,
        detail: 'This product URL is already being tracked',
      });
      assert.equal(
        await trackedProductCountByOwnerEmail(TEST_USERS.demo.email),
        baselineCount,
      );

      const resolved = await authenticatedRequest(
        session,
        '/api/product-sources/resolve',
        { method: 'POST', json: { url: P0_FIXTURE_KEYS.us04.creationUrl } },
      );
      assert.equal(resolved.status, 200);
      const selected = resolved.body.data.variants.find(
        (variant) => variant.retailer_offer_id === creationOffer.retailer_offer_id,
      );
      assert.ok(selected);

      const created = await authenticatedRequest(
        session,
        `/api/tracked-products?user_id=${boundaryUser.user_id}`,
        {
          method: 'POST',
          json: {
            retailer_offer_id: selected.retailer_offer_id,
            user_id: boundaryUser.user_id,
            product_variant_id: duplicateOffer.product_variant_id,
            tracking_status: 'NOT_TRUSTED',
          },
        },
      );

      assert.equal(created.status, 201);
      assert.equal(
        created.headers.get('location'),
        `/api/tracked-products/${created.body.data.tracked_product_id}`,
      );
      assert.equal(created.body.data.tracking_status, 'TRACKING');
      assert.equal(
        created.body.data.product.variant.product_variant_id,
        creationOffer.product_variant_id,
      );
      assert.equal(created.body.data.source.retailer_offer_id, creationOffer.retailer_offer_id);
      assert.equal(created.body.data.source.url, P0_FIXTURE_KEYS.us04.creationUrl);

      const persisted = await trackedProductByOwnerAndUrl({
        email: TEST_USERS.demo.email,
        normalizedUrl: P0_FIXTURE_KEYS.us04.creationUrl,
      });
      assert.equal(persisted.user_id, demoUser.user_id);
      assert.notEqual(persisted.user_id, boundaryUser.user_id);
      assert.equal(persisted.product_variant_id, creationOffer.product_variant_id);
      assert.equal(persisted.retailer_offer_id, creationOffer.retailer_offer_id);
      assert.equal(persisted.tracking_status, 'TRACKING');
      assert.equal(
        await trackedProductCountByOwnerEmail(TEST_USERS.demo.email),
        baselineCount + 1,
      );

      const duplicate = await authenticatedRequest(
        session,
        '/api/tracked-products',
        {
          method: 'POST',
          json: { retailer_offer_id: selected.retailer_offer_id },
        },
      );
      assertProblemCode(duplicate, 'DUPLICATE_TRACKED_URL', {
        status: 409,
        detail: 'This product URL is already being tracked',
      });
      assert.equal(
        await trackedProductCountByOwnerEmail(TEST_USERS.demo.email),
        baselineCount + 1,
      );

      const missing = await authenticatedRequest(
        session,
        '/api/tracked-products',
        {
          method: 'POST',
          json: { retailer_offer_id: missingOfferId },
        },
      );
      assertProblemCode(missing, 'RETAILER_OFFER_NOT_FOUND', { status: 404 });
      assert.equal(
        await trackedProductCountByOwnerEmail(TEST_USERS.demo.email),
        baselineCount + 1,
      );
    });
  } finally {
    await deleteTrackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: P0_FIXTURE_KEYS.us04.creationUrl,
    });
    await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  }
});
