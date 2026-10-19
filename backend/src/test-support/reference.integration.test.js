import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../app.js';
import { config } from '../config.js';
import { closePool } from '../db/pool.js';
import { requireOwnedTrackedProduct } from '../modules/tracked-products/tracked-product.service.js';
import { assertProblemCode } from './assertions.js';
import { prepareSeededDatabase } from './database.js';
import {
  alertsByOwnerEmail,
  notificationsByOwnerAndUrl,
  missingTrackedProductId,
  observationByOfferAndTime,
  observationsByOfferUrl,
  observationsByVariant,
  offerByNormalizedUrl,
  offersByVariant,
  ownedAndUnownedTrackedProducts,
  P0_FIXTURE_KEYS,
  TEST_USERS,
  userByEmail,
} from './fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from './request.js';
import { withTestServer } from './server.js';

after(() => closePool());

test('shared integration support uses real auth, PostgreSQL fixtures and problem responses', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  const demoUser = await userByEmail(TEST_USERS.demo.email);
  const boundaryUser = await userByEmail(TEST_USERS.alertBoundary.email);
  assert.match(demoUser.user_id, /^\d+$/);
  assert.match(boundaryUser.user_id, /^\d+$/);

  const history = await observationsByVariant(
    P0_FIXTURE_KEYS.us02.fullHistory,
    { expectedCount: 30 },
  );
  const duplicateOffer = await offerByNormalizedUrl(P0_FIXTURE_KEYS.us04.duplicateUrl);
  const thresholdSequence = await observationsByOfferUrl(
    P0_FIXTURE_KEYS.us05.url,
    { expectedCount: 5 },
  );
  const comparisonOffers = await offersByVariant(
    P0_FIXTURE_KEYS.us09.exactVariant,
    { expectedCount: 3 },
  );
  const boundaryAlerts = await alertsByOwnerEmail(TEST_USERS.alertBoundary.email, {
    status: 'ACTIVE',
    expectedCount: 20,
  });
  const historicalNotifications = await notificationsByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us05.url,
  }, { expectedCount: 2 });

  assert.equal(history[0].canonical_key, P0_FIXTURE_KEYS.us02.fullHistory.canonicalKey);
  assert.equal(duplicateOffer.normalized_url, P0_FIXTURE_KEYS.us04.duplicateUrl);
  assert.equal(thresholdSequence.length, 5);
  assert.equal(comparisonOffers.length, 3);
  assert.equal(
    comparisonOffers.filter((offer) => offer.latest_availability_status === 'IN_STOCK').length,
    2,
  );
  assert.equal(
    comparisonOffers.filter((offer) => offer.latest_availability_status === 'OUT_OF_STOCK').length,
    1,
  );
  assert.equal(boundaryAlerts.length, 20);
  assert.equal(historicalNotifications.length, 2);

  const ownership = await ownedAndUnownedTrackedProducts();
  const owned = await requireOwnedTrackedProduct(
    ownership.owned.tracked_product_id,
    ownership.authenticatedUser.user_id,
  );
  assert.equal(owned.tracked_product_id, ownership.owned.tracked_product_id);

  const missingId = await missingTrackedProductId();

  for (const hiddenId of [
    ownership.unowned.tracked_product_id,
    missingId,
  ]) {
    await assert.rejects(
      () => requireOwnedTrackedProduct(hiddenId, ownership.authenticatedUser.user_id),
      (error) => error.code === 'TRACKED_PRODUCT_NOT_FOUND' && error.status === 404,
    );
  }

  const firstResolution = await observationByOfferAndTime({
    normalizedUrl: P0_FIXTURE_KEYS.us05.url,
    observedAt: P0_FIXTURE_KEYS.us05.lastCrossingAt,
  });

  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  const secondResolution = await observationByOfferAndTime({
    normalizedUrl: P0_FIXTURE_KEYS.us05.url,
    observedAt: P0_FIXTURE_KEYS.us05.lastCrossingAt,
  });

  assert.equal(secondResolution.normalized_url, firstResolution.normalized_url);
  assert.equal(
    secondResolution.observed_at.toISOString(),
    firstResolution.observed_at.toISOString(),
  );
  assert.equal(secondResolution.price_amount, firstResolution.price_amount);
  assert.equal(secondResolution.currency_code, firstResolution.currency_code);
  assert.equal(secondResolution.availability_status, firstResolution.availability_status);
  assert.match(firstResolution.price_observation_id, /^\d+$/);
  assert.match(secondResolution.price_observation_id, /^\d+$/);

  await withTestServer(app, async ({ baseUrl }) => {
    const guestWatchlist = await requestJson(baseUrl, '/api/watchlist');
    assertProblemCode(guestWatchlist, 'AUTHENTICATION_REQUIRED', {
      status: 401,
      detail: 'Authentication is required',
    });

    const session = await loginAs(baseUrl, TEST_USERS.demo);
    assert.match(session.cookie, /^pricelens_session=/);
    assert.equal(session.user.email, TEST_USERS.demo.email);

    const sessionResult = await authenticatedRequest(session, '/api/auth/session');
    assert.equal(sessionResult.status, 200);
    assert.equal(sessionResult.body.data.user_id, demoUser.user_id);

    const watchlist = await authenticatedRequest(
      session,
      `/api/watchlist?user_id=${boundaryUser.user_id}`,
    );
    assert.equal(watchlist.status, 200);
    assert.match(watchlist.headers.get('content-type'), /^application\/json(?:;|$)/);
    assert.equal(watchlist.body.meta.count, 10);
    assert.equal(watchlist.body.data.length, 10);

    const logout = await authenticatedRequest(session, '/api/auth/logout', {
      method: 'POST',
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie') ?? '', /pricelens_session=;/);

    const afterLogout = await requestJson(baseUrl, '/api/auth/session');
    assertProblemCode(afterLogout, 'AUTHENTICATION_REQUIRED', { status: 401 });
  });
});
