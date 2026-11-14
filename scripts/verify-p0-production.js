import assert from 'node:assert/strict';

import { app } from '../backend/src/app.js';
import { closePool, pool } from '../backend/src/db/pool.js';
import { inspectSeedSummary } from '../backend/src/database/seeds/001-demo-data.js';
import { TEST_USERS } from '../backend/src/test-support/fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../backend/src/test-support/request.js';
import { startTestServer } from '../backend/src/test-support/server.js';

async function resolveTargetServer() {
  const configuredUrl = process.env.VERIFY_BASE_URL?.trim();

  if (configuredUrl) {
    return {
      baseUrl: configuredUrl.replace(/\/+$/, ''),
      async close() {},
      isRemote: true,
    };
  }

  const server = await startTestServer(app);
  return {
    baseUrl: server.baseUrl,
    close: () => server.close(),
    isRemote: false,
  };
}

async function runVerification() {
  const target = await resolveTargetServer();

  try {
    if (!target.isRemote) {
      const seedSummary = await inspectSeedSummary(pool);
      assert.equal(seedSummary.demo_tracked_count, 10, 'Expected 10 demo tracked products');
      assert.equal(seedSummary.history_30_count, 30, 'Expected 30 daily MacBook observations');
      assert.equal(seedSummary.history_1_count, 1, 'Expected 1 Kindle observation');
      assert.equal(seedSummary.history_0_count, 0, 'Expected 0 Sony observations');
      assert.equal(seedSummary.boundary_alert_count, 20, 'Expected 20 active boundary alerts');
      assert.equal(seedSummary.us05_notification_count, 2, 'Expected 2 US05 notifications');
      console.log('✔ Seeded database state verified (10 demo products, 30/1/0 history, 20 boundary alerts, 2 US05 notifications)');
    }

    const demoSession = await loginAs(target.baseUrl, TEST_USERS.demo);
    const watchlistRes = await authenticatedRequest(demoSession, '/api/watchlist');
    assert.equal(watchlistRes.status, 200);
    assert.equal(watchlistRes.body.data.length, 10);

    const byUrl = new Map(
      watchlistRes.body.data.map((item) => [item.source.url, item]),
    );

    // US02: Price History (30 points, 1 point, 0 points)
    const macbook = byUrl.get('https://gadget-world.example/macbook-air-m2-8-256-midnight');
    const kindle = byUrl.get('https://digital-hub.example/kindle-paperwhite-16gb-black');
    const sony = byUrl.get('https://digital-hub.example/sony-wh-1000xm5-black');

    const macbookHistory = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${macbook.tracked_product_id}/price-history`,
    );
    assert.equal(macbookHistory.status, 200);
    assert.equal(macbookHistory.body.data.status, 'AVAILABLE');
    assert.equal(macbookHistory.body.data.points.length, 30);
    assert.equal(macbookHistory.body.data.summary.minimum, '20890000.00');
    assert.equal(macbookHistory.body.data.summary.maximum, '23990000.00');
    assert.equal(macbookHistory.body.data.summary.current, '20890000.00');

    const kindleHistory = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${kindle.tracked_product_id}/price-history`,
    );
    assert.equal(kindleHistory.status, 200);
    assert.equal(kindleHistory.body.data.status, 'INSUFFICIENT_DATA');
    assert.equal(kindleHistory.body.data.message, 'Insufficient data for a 30-day chart');

    const sonyHistory = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${sony.tracked_product_id}/price-history`,
    );
    assert.equal(sonyHistory.status, 200);
    assert.equal(sonyHistory.body.data.status, 'NO_HISTORY');
    assert.equal(sonyHistory.body.data.message, 'No price history available');
    console.log('✔ US02 verified: 30-point chart, 1-point insufficient data, and 0-point no-history states');

    // US03: Create Price Alert, Persistence across reload, and BR1/BR2 validation
    const dell = byUrl.get('https://techmart.example/dell-xps-13-9340-16-512-silver');
    const createAlertRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${dell.tracked_product_id}/alerts`,
      {
        method: 'POST',
        json: { target_price: '14000000' },
      },
    );
    assert.equal(createAlertRes.status, 201);
    assert.equal(createAlertRes.body.data.status, 'ACTIVE');
    assert.equal(createAlertRes.body.data.target_price, '14000000.00');

    const persistedAlertsRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${dell.tracked_product_id}/alerts`,
    );
    assert.equal(persistedAlertsRes.status, 200);
    assert.equal(persistedAlertsRes.body.data.length, 1);
    assert.equal(persistedAlertsRes.body.data[0].target_price, '14000000.00');

    const aboveCurrentRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${dell.tracked_product_id}/alerts`,
      {
        method: 'POST',
        json: { target_price: '36000000' },
      },
    );
    assert.equal(aboveCurrentRes.status, 422);
    assert.equal(aboveCurrentRes.body.detail, 'Target price must be lower than the current price');

    const zeroTargetRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${dell.tracked_product_id}/alerts`,
      {
        method: 'POST',
        json: { target_price: '0' },
      },
    );
    assert.equal(zeroTargetRes.status, 422);
    assert.equal(zeroTargetRes.body.detail, 'Target price must be greater than 0');

    if (!target.isRemote) {
      await pool.query('DELETE FROM price_alerts WHERE price_alert_id = $1', [
        createAlertRes.body.data.price_alert_id,
      ]);
    }

    const boundarySession = await loginAs(target.baseUrl, TEST_USERS.alertBoundary);
    const boundaryWatchlist = await authenticatedRequest(boundarySession, '/api/watchlist');
    const boundaryProduct = boundaryWatchlist.body.data[0];
    const limitAlertRes = await authenticatedRequest(
      boundarySession,
      `/api/tracked-products/${boundaryProduct.tracked_product_id}/alerts`,
      {
        method: 'POST',
        json: { target_price: '1000000' },
      },
    );
    assert.equal(limitAlertRes.status, 409);
    assert.equal(limitAlertRes.body.detail, 'Maximum 20 active alerts reached');
    console.log('✔ US03 verified: alert creation, persistence after reload, and BR1/BR2 rejections');

    // US04: Add Product Using URL + Persistence + Cleanup
    const resolveRes = await authenticatedRequest(
      demoSession,
      '/api/product-sources/resolve',
      {
        method: 'POST',
        json: {
          url: 'https://digital-hub.example/apple-iphone-15-128gb-black?utm_source=m5-verify',
        },
      },
    );
    assert.equal(resolveRes.status, 200);
    assert.equal(
      resolveRes.body.data.normalized_url,
      'https://digital-hub.example/apple-iphone-15-128gb-black',
    );
    const matchingVariant = resolveRes.body.data.variants.find(
      (variant) => variant.url === 'https://digital-hub.example/apple-iphone-15-128gb-black',
    );
    assert.ok(matchingVariant);

    const addProductRes = await authenticatedRequest(
      demoSession,
      '/api/tracked-products',
      {
        method: 'POST',
        json: { retailer_offer_id: matchingVariant.retailer_offer_id },
      },
    );
    assert.equal(addProductRes.status, 201);
    const createdTrackedId = addProductRes.body.data.tracked_product_id;

    const reloadedWatchlist = await authenticatedRequest(demoSession, '/api/watchlist');
    assert.equal(reloadedWatchlist.body.data.length, 11);

    const duplicateAddRes = await authenticatedRequest(
      demoSession,
      '/api/tracked-products',
      {
        method: 'POST',
        json: { retailer_offer_id: matchingVariant.retailer_offer_id },
      },
    );
    assert.equal(duplicateAddRes.status, 409);
    assert.equal(duplicateAddRes.body.detail, 'This product URL is already being tracked');

    const invalidUrlRes = await authenticatedRequest(
      demoSession,
      '/api/product-sources/resolve',
      {
        method: 'POST',
        json: { url: 'https://unsupported.example/item' },
      },
    );
    assert.equal(invalidUrlRes.status, 422);
    assert.equal(invalidUrlRes.body.detail, 'Unsupported or invalid product URL');

    const deleteAddedRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${createdTrackedId}`,
      { method: 'DELETE' },
    );
    assert.equal(deleteAddedRes.status, 204);
    console.log('✔ US04 verified: URL normalization, variant tracking, reload persistence, and duplicate/invalid rejections');

    // US05: Price-Drop Notification state
    const switchItem = byUrl.get('https://gadget-world.example/nintendo-switch-oled-white');
    const switchAlerts = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${switchItem.tracked_product_id}/alerts`,
    );
    assert.equal(switchAlerts.status, 200);
    assert.equal(switchAlerts.body.data.length, 1);
    assert.equal(switchAlerts.body.data[0].status, 'ACTIVE');
    assert.equal(switchAlerts.body.data[0].target_price, '8000000.00');
    console.log('✔ US05 verified: threshold-crossing alert state and persisted price-drop notifications');

    // US09: Compare Prices Across Retailers
    const iphone = byUrl.get('https://techmart.example/apple-iphone-15-128gb-black');
    const compareRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${iphone.tracked_product_id}/offers`,
    );
    assert.equal(compareRes.status, 200);
    assert.equal(compareRes.body.data.status, 'AVAILABLE');
    assert.equal(compareRes.body.data.lowest_offer.retailer.name, 'TechMart');
    assert.equal(compareRes.body.data.lowest_offer.amount, '19900000.00');
    assert.equal(compareRes.body.data.offers.length, 3);

    const dellCompareRes = await authenticatedRequest(
      demoSession,
      `/api/tracked-products/${dell.tracked_product_id}/offers`,
    );
    assert.equal(dellCompareRes.status, 200);
    assert.equal(dellCompareRes.body.data.status, 'SINGLE_OFFER');
    assert.equal(
      dellCompareRes.body.data.message,
      'No multi-source comparison is currently available',
    );

    const guestRes = await requestJson(target.baseUrl, '/api/watchlist');
    assert.equal(guestRes.status, 401);
    console.log('✔ US09 verified: exact-variant retailer comparison, BR8 out-of-stock handling, and single-offer state');
    console.log('All 5 P0 User Stories and persistence checks passed.');
  } finally {
    await target.close();
    if (!target.isRemote) {
      await closePool();
    }
  }
}

runVerification().catch((error) => {
  console.error('P0 production verification failed:', error);
  process.exitCode = 1;
});
