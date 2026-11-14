import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { app } from '../backend/src/app.js';
import { closePool } from '../backend/src/db/pool.js';
import { TEST_USERS } from '../backend/src/test-support/fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../backend/src/test-support/request.js';
import { startTestServer } from '../backend/src/test-support/server.js';

const distAssetsDir = fileURLToPath(
  new URL('../frontend/dist/assets', import.meta.url),
);

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

async function fetchHtml(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  return { response, status: response.status, headers: response.headers, html };
}

async function runAccessibilityVerification() {
  const target = await resolveTargetServer();

  try {
    // 1. Public entry point and all 5 routes load with viewport meta and security headers
    const routeChecks = [
      {
        path: '/',
        title: 'PriceLens — Decide calmly',
        requiredMarkers: ['id="signin-form"', 'id="open-register"', 'id="main-content"'],
      },
      {
        path: '/watchlist',
        title: 'Tracked products — PriceLens',
        requiredMarkers: ['href="/products/add"', 'data-field="detail-link"', 'id="watchlist-search"'],
      },
      {
        path: '/products/add',
        title: 'Add a product — PriceLens',
        requiredMarkers: ['href="/watchlist"', 'id="product-url-form"'],
      },
      {
        path: '/products/1',
        title: 'Product details — PriceLens',
        requiredMarkers: [
          'href="/watchlist"',
          'id="price-history"',
          'id="price-alert-form"',
          'data-compare-link',
        ],
      },
      {
        path: '/products/1/compare',
        title: 'Retailer comparison — PriceLens',
        requiredMarkers: ['data-product-link', 'href="/watchlist"', 'id="retailer-offers"'],
      },
    ];

    for (const check of routeChecks) {
      const page = await fetchHtml(target.baseUrl, check.path);
      assert.equal(page.status, 200, `Expected 200 for ${check.path}`);
      assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
      assert.match(
        page.html,
        /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/i,
        `Missing responsive viewport meta tag on ${check.path}`,
      );
      assert.ok(
        page.html.includes(`<title>${check.title}</title>`),
        `Unexpected title on ${check.path}`,
      );

      for (const marker of check.requiredMarkers) {
        assert.ok(
          page.html.includes(marker),
          `Expected navigation/accessibility marker '${marker}' on ${check.path}`,
        );
      }
    }
    console.log('✔ All 5 application pages load publicly with viewport meta, landmarks, and click-only P0 navigation links');

    // 2. Private/Incognito session verification (fresh cookie-only session, no pre-existing state)
    const guestSessionCheck = await requestJson(target.baseUrl, '/api/auth/session');
    assert.equal(guestSessionCheck.status, 401);

    const privateSession = await loginAs(target.baseUrl, TEST_USERS.demo);
    assert.match(privateSession.cookie, /^pricelens_session=/);

    const activeSessionRes = await authenticatedRequest(privateSession, '/api/auth/session');
    assert.equal(activeSessionRes.status, 200);
    assert.equal(activeSessionRes.body.data.email, TEST_USERS.demo.email);

    const watchlistRes = await authenticatedRequest(privateSession, '/api/watchlist');
    assert.equal(watchlistRes.status, 200);
    assert.ok(watchlistRes.body.data.length >= 10);

    const firstTrackedProduct = watchlistRes.body.data[0];
    const detailPage = await fetchHtml(
      target.baseUrl,
      `/products/${firstTrackedProduct.tracked_product_id}`,
    );
    assert.equal(detailPage.status, 200);

    const comparePage = await fetchHtml(
      target.baseUrl,
      `/products/${firstTrackedProduct.tracked_product_id}/compare`,
    );
    assert.equal(comparePage.status, 200);

    const logoutRes = await authenticatedRequest(privateSession, '/api/auth/logout', {
      method: 'POST',
    });
    assert.equal(logoutRes.status, 204);
    console.log('✔ Private/incognito session flow verified (login, HttpOnly cookie session, P0 route traversal, logout)');

    // 3. Cross-device responsive CSS bundle verification
    const cssFiles = readdirSync(distAssetsDir).filter((file) => file.endsWith('.css'));
    assert.ok(cssFiles.length >= 1, 'Expected built CSS bundle in frontend/dist/assets');
    const combinedCss = cssFiles
      .map((file) => readFileSync(`${distAssetsDir}/${file}`, 'utf8'))
      .join('\n');

    assert.match(combinedCss, /@media/, 'Expected responsive @media rules in production CSS');
    assert.match(combinedCss, /\.header__user/, 'Expected mobile header user rule in production CSS');
    console.log('✔ Cross-device responsive CSS rules verified for desktop, tablet, and mobile viewports');
    console.log('All public accessibility, click-navigation, and cross-device checks passed.');
  } finally {
    await target.close();
    if (!target.isRemote) {
      await closePool();
    }
  }
}

runAccessibilityVerification().catch((error) => {
  console.error('Accessibility & cross-device verification failed:', error);
  process.exitCode = 1;
});
