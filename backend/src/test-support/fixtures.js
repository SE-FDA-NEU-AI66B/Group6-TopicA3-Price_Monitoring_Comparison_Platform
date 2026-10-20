import { query } from '../db/pool.js';

const freeze = (value) => Object.freeze(value);

export const TEST_USERS = freeze({
  demo: freeze({
    email: 'demo@pricelens.local',
    // Public local fixture credential already documented by PriceLens setup.
    password: 'PriceLensDemo2026!',
  }),
  alertBoundary: freeze({
    email: 'alert-boundary@pricelens.local',
    password: 'PriceLensDemo2026!',
  }),
});

export const P0_FIXTURE_KEYS = freeze({
  us02: freeze({
    fullHistory: freeze({
      canonicalKey: 'apple-macbook-air-m2',
      variantKey: '8gb-256gb-midnight',
      sourceUrl: 'https://gadget-world.example/macbook-air-m2-8-256-midnight',
    }),
    singleObservationUrl: 'https://digital-hub.example/kindle-paperwhite-16gb-black',
    noObservationUrl: 'https://digital-hub.example/sony-wh-1000xm5-black',
  }),
  us03: freeze({
    currentPriceUrl: 'https://techmart.example/dell-xps-13-9340-16-512-silver',
    boundaryUrl: 'https://techmart.example/apple-iphone-15-512gb-black',
  }),
  us04: freeze({
    sourceCode: 'TECHMART',
    duplicateUrl: 'https://techmart.example/apple-iphone-15-128gb-black',
    creationUrl: 'https://digital-hub.example/apple-iphone-15-128gb-black',
    exactVariants: freeze([
      freeze({ canonicalKey: 'apple-iphone-15', variantKey: '128gb-black' }),
      freeze({ canonicalKey: 'apple-iphone-15', variantKey: '256gb-black' }),
      freeze({ canonicalKey: 'apple-iphone-15', variantKey: '512gb-black' }),
    ]),
  }),
  us05: freeze({
    url: 'https://gadget-world.example/nintendo-switch-oled-white',
    targetPrice: '8000000.00',
    lastCrossingAt: '2026-10-05T08:00:00.000Z',
  }),
  us09: freeze({
    exactVariant: freeze({
      canonicalKey: 'apple-iphone-15',
      variantKey: '128gb-black',
    }),
    mismatchedVariant: freeze({
      canonicalKey: 'apple-iphone-15',
      variantKey: '256gb-black',
    }),
    singleOfferVariant: freeze({
      canonicalKey: 'dell-xps-13-9340',
      variantKey: '16gb-512gb-silver',
    }),
    zeroAvailableVariant: freeze({
      canonicalKey: 'xiaomi-robot-vacuum-s10',
      variantKey: 'white',
    }),
  }),
});

export function expectExactlyOneFixture(rows, description) {
  if (rows.length !== 1) {
    throw new Error(
      `Expected exactly one fixture for ${description}; found ${rows.length}.`,
    );
  }

  return rows[0];
}

export async function userByEmail(email) {
  const result = await query(
    `SELECT user_id::TEXT AS user_id, email, display_name, account_status
     FROM users
     WHERE email = $1`,
    [email],
  );

  return expectExactlyOneFixture(result.rows, `user email ${email}`);
}

export async function productByCanonicalKey(canonicalKey) {
  const result = await query(
    `SELECT product_id::TEXT AS product_id, canonical_key, brand, model, display_name
     FROM products
     WHERE canonical_key = $1`,
    [canonicalKey],
  );

  return expectExactlyOneFixture(
    result.rows,
    `product canonical_key ${canonicalKey}`,
  );
}

export async function variantByNaturalKey({ canonicalKey, variantKey }) {
  const result = await query(
    `SELECT
       pv.product_variant_id::TEXT AS product_variant_id,
       p.product_id::TEXT AS product_id,
       p.canonical_key,
       pv.variant_key,
       pv.display_name,
       pv.attributes
     FROM product_variants AS pv
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE p.canonical_key = $1
       AND pv.variant_key = $2`,
    [canonicalKey, variantKey],
  );

  return expectExactlyOneFixture(
    result.rows,
    `variant ${canonicalKey}/${variantKey}`,
  );
}

export async function retailerBySourceCode(sourceCode) {
  const result = await query(
    `SELECT retailer_id::TEXT AS retailer_id, source_code, name, domain, is_active
     FROM retailers
     WHERE source_code = $1`,
    [sourceCode],
  );

  return expectExactlyOneFixture(result.rows, `retailer source_code ${sourceCode}`);
}

export async function offerByNormalizedUrl(normalizedUrl) {
  const result = await query(
    `SELECT
       ro.retailer_offer_id::TEXT AS retailer_offer_id,
       ro.product_variant_id::TEXT AS product_variant_id,
       r.retailer_id::TEXT AS retailer_id,
       r.source_code,
       p.canonical_key,
       pv.variant_key,
       ro.normalized_url
     FROM retailer_offers AS ro
     JOIN retailers AS r ON r.retailer_id = ro.retailer_id
     JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE ro.normalized_url = $1`,
    [normalizedUrl],
  );

  return expectExactlyOneFixture(result.rows, `offer URL ${normalizedUrl}`);
}

export async function trackedProductByOwnerAndUrl({ email, normalizedUrl }) {
  const result = await query(
    `SELECT
       tp.tracked_product_id::TEXT AS tracked_product_id,
       tp.user_id::TEXT AS user_id,
       tp.product_variant_id::TEXT AS product_variant_id,
       tp.retailer_offer_id::TEXT AS retailer_offer_id,
       u.email,
       tp.normalized_source_url,
       tp.tracking_status
     FROM tracked_products AS tp
     JOIN users AS u ON u.user_id = tp.user_id
     WHERE u.email = $1
       AND tp.normalized_source_url = $2`,
    [email, normalizedUrl],
  );

  return expectExactlyOneFixture(
    result.rows,
    `tracked product owner ${email} and URL ${normalizedUrl}`,
  );
}

export async function observationByOfferAndTime({ normalizedUrl, observedAt }) {
  const result = await query(
    `SELECT
       po.price_observation_id::TEXT AS price_observation_id,
       po.retailer_offer_id::TEXT AS retailer_offer_id,
       ro.normalized_url,
       po.price_amount::TEXT AS price_amount,
       po.currency_code,
       po.availability_status,
       po.observed_at
     FROM price_observations AS po
     JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
     WHERE ro.normalized_url = $1
       AND po.observed_at = $2::TIMESTAMPTZ`,
    [normalizedUrl, observedAt],
  );

  return expectExactlyOneFixture(
    result.rows,
    `observation URL ${normalizedUrl} at ${observedAt}`,
  );
}

export async function observationsByOfferUrl(normalizedUrl, { expectedCount } = {}) {
  const result = await query(
    `SELECT
       po.price_observation_id::TEXT AS price_observation_id,
       ro.normalized_url,
       po.price_amount::TEXT AS price_amount,
       po.currency_code,
       po.availability_status,
       po.observed_at
     FROM price_observations AS po
     JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
     WHERE ro.normalized_url = $1
     ORDER BY po.observed_at, po.price_observation_id`,
    [normalizedUrl],
  );

  assertExpectedCount(result.rows, expectedCount, `observations for URL ${normalizedUrl}`);
  return result.rows;
}

export async function observationsByVariant(
  { canonicalKey, variantKey },
  { expectedCount } = {},
) {
  const result = await query(
    `SELECT
       po.price_observation_id::TEXT AS price_observation_id,
       p.canonical_key,
       pv.variant_key,
       ro.normalized_url,
       po.price_amount::TEXT AS price_amount,
       po.currency_code,
       po.availability_status,
       po.observed_at
     FROM price_observations AS po
     JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
     JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE p.canonical_key = $1
       AND pv.variant_key = $2
     ORDER BY po.observed_at, po.price_observation_id`,
    [canonicalKey, variantKey],
  );

  assertExpectedCount(
    result.rows,
    expectedCount,
    `observations for variant ${canonicalKey}/${variantKey}`,
  );
  return result.rows;
}

export async function offersByVariant(
  { canonicalKey, variantKey },
  { expectedCount } = {},
) {
  const result = await query(
    `SELECT
       ro.retailer_offer_id::TEXT AS retailer_offer_id,
       r.retailer_id::TEXT AS retailer_id,
       r.source_code,
       p.canonical_key,
       pv.variant_key,
       ro.normalized_url,
       latest.price_amount::TEXT AS latest_price_amount,
       latest.currency_code AS latest_currency_code,
       latest.availability_status AS latest_availability_status,
       latest.observed_at AS latest_observed_at
     FROM retailer_offers AS ro
     JOIN retailers AS r ON r.retailer_id = ro.retailer_id
     JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p ON p.product_id = pv.product_id
     LEFT JOIN LATERAL (
       SELECT
         po.price_amount,
         po.currency_code,
         po.availability_status,
         po.observed_at
       FROM price_observations AS po
       WHERE po.retailer_offer_id = ro.retailer_offer_id
       ORDER BY po.observed_at DESC, po.price_observation_id DESC
       LIMIT 1
     ) AS latest ON TRUE
     WHERE p.canonical_key = $1
       AND pv.variant_key = $2
     ORDER BY r.source_code, ro.normalized_url`,
    [canonicalKey, variantKey],
  );

  assertExpectedCount(
    result.rows,
    expectedCount,
    `offers for variant ${canonicalKey}/${variantKey}`,
  );
  return result.rows;
}

export async function alertsByOwnerEmail(email, { status, expectedCount } = {}) {
  const parameters = [email];
  const statusClause = status === undefined ? '' : 'AND pa.status = $2';

  if (status !== undefined) {
    parameters.push(status);
  }

  const result = await query(
    `SELECT
       pa.price_alert_id::TEXT AS price_alert_id,
       tp.tracked_product_id::TEXT AS tracked_product_id,
       u.email,
       tp.normalized_source_url,
       pa.target_price::TEXT AS target_price,
       pa.currency_code,
       pa.status,
       pa.last_threshold_state
     FROM price_alerts AS pa
     JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
     JOIN users AS u ON u.user_id = tp.user_id
     WHERE u.email = $1
       ${statusClause}
     ORDER BY pa.created_at, pa.price_alert_id`,
    parameters,
  );

  assertExpectedCount(result.rows, expectedCount, `${status ?? 'all'} alerts for ${email}`);
  return result.rows;
}

export async function notificationsByOwnerAndUrl(
  { email, normalizedUrl },
  { expectedCount } = {},
) {
  const result = await query(
    `SELECT
       n.notification_id::TEXT AS notification_id,
       n.price_alert_id::TEXT AS price_alert_id,
       n.price_observation_id::TEXT AS price_observation_id,
       u.email,
       tp.normalized_source_url,
       n.recipient_email,
       n.subject,
       n.delivery_status,
       n.qualified_at,
       n.sent_at
     FROM notifications AS n
     JOIN price_alerts AS pa ON pa.price_alert_id = n.price_alert_id
     JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
     JOIN users AS u ON u.user_id = tp.user_id
     WHERE u.email = $1
       AND tp.normalized_source_url = $2
     ORDER BY n.qualified_at, n.notification_id`,
    [email, normalizedUrl],
  );

  assertExpectedCount(
    result.rows,
    expectedCount,
    `notifications for owner ${email} and URL ${normalizedUrl}`,
  );
  return result.rows;
}

export async function ownedAndUnownedTrackedProducts() {
  const authenticatedUser = await userByEmail(TEST_USERS.demo.email);
  const owned = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us04.duplicateUrl,
  });
  const unowned = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.alertBoundary.email,
    normalizedUrl: P0_FIXTURE_KEYS.us03.boundaryUrl,
  });

  if (owned.user_id !== authenticatedUser.user_id) {
    throw new Error('Owned tracked-product fixture does not belong to the demo user.');
  }

  if (unowned.user_id === authenticatedUser.user_id) {
    throw new Error('Unowned tracked-product fixture unexpectedly belongs to the demo user.');
  }

  return { authenticatedUser, owned, unowned };
}

export async function missingTrackedProductId() {
  const result = await query(
    `SELECT (COALESCE(MAX(tracked_product_id), 0) + 1)::TEXT AS tracked_product_id
     FROM tracked_products`,
  );

  return expectExactlyOneFixture(
    result.rows,
    'generated missing tracked-product identifier',
  ).tracked_product_id;
}

export async function missingRetailerOfferId() {
  const result = await query(
    `SELECT (COALESCE(MAX(retailer_offer_id), 0) + 1)::TEXT AS retailer_offer_id
     FROM retailer_offers`,
  );

  return expectExactlyOneFixture(
    result.rows,
    'generated missing retailer-offer identifier',
  ).retailer_offer_id;
}

export async function trackedProductCountByOwnerEmail(email) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM tracked_products AS tp
     JOIN users AS u ON u.user_id = tp.user_id
     WHERE u.email = $1`,
    [email],
  );

  return expectExactlyOneFixture(
    result.rows,
    `tracked-product count for ${email}`,
  ).count;
}

export async function deleteTrackedProductByOwnerAndUrl({ email, normalizedUrl }) {
  const result = await query(
    `DELETE FROM tracked_products AS tp
     USING users AS u
     WHERE tp.user_id = u.user_id
       AND u.email = $1
       AND tp.normalized_source_url = $2`,
    [email, normalizedUrl],
  );

  return result.rowCount;
}

function assertExpectedCount(rows, expectedCount, description) {
  if (expectedCount !== undefined && rows.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} fixtures for ${description}; found ${rows.length}.`,
    );
  }
}
