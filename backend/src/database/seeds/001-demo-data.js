const demoSeedSql = String.raw`
-- Deterministic PriceLens demo and Sprint 3 P0 acceptance fixtures.
-- Stable natural keys keep re-initialization repeatable without explicit BIGINT IDs.

-- Base M2 user plus the isolated BR1 boundary user.
INSERT INTO users (email, password_hash, display_name)
VALUES
    (
        'demo@pricelens.local',
        '$2b$12$4WFhysFzB4prj.QNJZk9lOI9Gjy8HCiqbn7nbArdEbrxOIkUKenoK',
        'PriceLens Demo Shopper'
    ),
    (
        'alert-boundary@pricelens.local',
        '$2b$12$4WFhysFzB4prj.QNJZk9lOI9Gjy8HCiqbn7nbArdEbrxOIkUKenoK',
        'PriceLens Alert Boundary'
    )
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    account_status = 'ACTIVE';

-- Base M2 catalogue remains unchanged.
INSERT INTO products (canonical_key, brand, model, display_name)
VALUES
    ('apple-iphone-15', 'Apple', 'iPhone 15', 'Apple iPhone 15'),
    ('samsung-galaxy-s24', 'Samsung', 'Galaxy S24', 'Samsung Galaxy S24'),
    ('apple-macbook-air-m2', 'Apple', 'MacBook Air M2', 'Apple MacBook Air M2'),
    ('dell-xps-13-9340', 'Dell', 'XPS 13 9340', 'Dell XPS 13 9340'),
    ('sony-wh-1000xm5', 'Sony', 'WH-1000XM5', 'Sony WH-1000XM5'),
    ('nintendo-switch-oled', 'Nintendo', 'Switch OLED', 'Nintendo Switch OLED'),
    ('canon-eos-r50', 'Canon', 'EOS R50', 'Canon EOS R50'),
    ('amazon-kindle-paperwhite', 'Amazon', 'Kindle Paperwhite', 'Kindle Paperwhite'),
    ('xiaomi-robot-vacuum-s10', 'Xiaomi', 'Robot Vacuum S10', 'Xiaomi Robot Vacuum S10'),
    ('logitech-mx-master-3s', 'Logitech', 'MX Master 3S', 'Logitech MX Master 3S')
ON CONFLICT (canonical_key) DO NOTHING;

INSERT INTO retailers (source_code, name, domain)
VALUES
    ('TECHMART', 'TechMart', 'techmart.example'),
    ('DIGITAL_HUB', 'Digital Hub', 'digital-hub.example'),
    ('GADGET_WORLD', 'Gadget World', 'gadget-world.example')
ON CONFLICT (source_code) DO NOTHING;

-- US04/US09: exact iPhone variants make capacity mismatches explicit.
WITH seed_variants (
    canonical_key,
    variant_key,
    display_name,
    attributes
) AS (
    VALUES
        ('apple-iphone-15', '128gb-black', 'iPhone 15 128GB Black', '{"storage":"128GB","color":"Black"}'::JSONB),
        ('apple-iphone-15', '256gb-black', 'iPhone 15 256GB Black', '{"storage":"256GB","color":"Black"}'::JSONB),
        ('apple-iphone-15', '512gb-black', 'iPhone 15 512GB Black', '{"storage":"512GB","color":"Black"}'::JSONB),
        ('samsung-galaxy-s24', '256gb-gray', 'Galaxy S24 256GB Gray', '{"storage":"256GB","color":"Gray"}'::JSONB),
        ('apple-macbook-air-m2', '8gb-256gb-midnight', 'MacBook Air M2 8GB/256GB Midnight', '{"memory":"8GB","storage":"256GB","color":"Midnight"}'::JSONB),
        ('dell-xps-13-9340', '16gb-512gb-silver', 'XPS 13 16GB/512GB Silver', '{"memory":"16GB","storage":"512GB","color":"Silver"}'::JSONB),
        ('sony-wh-1000xm5', 'black', 'WH-1000XM5 Black', '{"color":"Black"}'::JSONB),
        ('nintendo-switch-oled', 'white', 'Switch OLED White', '{"color":"White"}'::JSONB),
        ('canon-eos-r50', '18-45mm-black', 'EOS R50 18-45mm Kit Black', '{"lens":"18-45mm","color":"Black"}'::JSONB),
        ('amazon-kindle-paperwhite', '16gb-black', 'Kindle Paperwhite 16GB Black', '{"storage":"16GB","color":"Black"}'::JSONB),
        ('xiaomi-robot-vacuum-s10', 'white', 'Robot Vacuum S10 White', '{"color":"White"}'::JSONB),
        ('logitech-mx-master-3s', 'graphite', 'MX Master 3S Graphite', '{"color":"Graphite"}'::JSONB)
)
INSERT INTO product_variants (
    product_id,
    variant_key,
    display_name,
    attributes
)
SELECT
    p.product_id,
    sv.variant_key,
    sv.display_name,
    sv.attributes
FROM seed_variants AS sv
JOIN products AS p
    ON p.canonical_key = sv.canonical_key
ON CONFLICT (product_id, variant_key) DO NOTHING;

-- M2 offers plus US04 resolver and US09 comparison offers.
WITH seed_offers (
    source_code,
    canonical_key,
    variant_key,
    normalized_url,
    external_offer_id
) AS (
    VALUES
        ('TECHMART', 'apple-iphone-15', '128gb-black', 'https://techmart.example/apple-iphone-15-128gb-black', 'TM-IP15-128-BLK'),
        ('DIGITAL_HUB', 'apple-iphone-15', '128gb-black', 'https://digital-hub.example/apple-iphone-15-128gb-black', 'DH-IP15-128-BLK'),
        ('GADGET_WORLD', 'apple-iphone-15', '128gb-black', 'https://gadget-world.example/apple-iphone-15-128gb-black', 'GW-IP15-128-BLK'),
        ('GADGET_WORLD', 'apple-iphone-15', '256gb-black', 'https://gadget-world.example/apple-iphone-15-256gb-black', 'GW-IP15-256-BLK'),
        ('TECHMART', 'apple-iphone-15', '512gb-black', 'https://techmart.example/apple-iphone-15-512gb-black', 'TM-IP15-512-BLK'),
        ('DIGITAL_HUB', 'samsung-galaxy-s24', '256gb-gray', 'https://digital-hub.example/samsung-galaxy-s24-256gb-gray', 'DH-S24-256-GRY'),
        ('GADGET_WORLD', 'apple-macbook-air-m2', '8gb-256gb-midnight', 'https://gadget-world.example/macbook-air-m2-8-256-midnight', 'GW-MBA-M2-256'),
        ('TECHMART', 'dell-xps-13-9340', '16gb-512gb-silver', 'https://techmart.example/dell-xps-13-9340-16-512-silver', 'TM-XPS13-512'),
        ('DIGITAL_HUB', 'sony-wh-1000xm5', 'black', 'https://digital-hub.example/sony-wh-1000xm5-black', 'DH-XM5-BLK'),
        ('GADGET_WORLD', 'nintendo-switch-oled', 'white', 'https://gadget-world.example/nintendo-switch-oled-white', 'GW-NSW-OLED-WHT'),
        ('TECHMART', 'canon-eos-r50', '18-45mm-black', 'https://techmart.example/canon-eos-r50-18-45-black', 'TM-R50-KIT'),
        ('DIGITAL_HUB', 'amazon-kindle-paperwhite', '16gb-black', 'https://digital-hub.example/kindle-paperwhite-16gb-black', 'DH-KPW-16-BLK'),
        ('GADGET_WORLD', 'xiaomi-robot-vacuum-s10', 'white', 'https://gadget-world.example/xiaomi-robot-vacuum-s10-white', 'GW-S10-WHT'),
        ('TECHMART', 'logitech-mx-master-3s', 'graphite', 'https://techmart.example/logitech-mx-master-3s-graphite', 'TM-MX3S-GRA')
)
INSERT INTO retailer_offers (
    retailer_id,
    product_variant_id,
    normalized_url,
    external_offer_id,
    last_refresh_attempt_at,
    last_refresh_status
)
SELECT
    r.retailer_id,
    pv.product_variant_id,
    so.normalized_url,
    so.external_offer_id,
    '2026-10-10T12:00:00Z'::TIMESTAMPTZ,
    'SUCCEEDED'
FROM seed_offers AS so
JOIN retailers AS r
    ON r.source_code = so.source_code
JOIN products AS p
    ON p.canonical_key = so.canonical_key
JOIN product_variants AS pv
    ON pv.product_id = p.product_id
   AND pv.variant_key = so.variant_key
ON CONFLICT (retailer_id, product_variant_id, normalized_url) DO NOTHING;

-- Preserve the 10-item M2 Watchlist and add one isolated boundary-user item.
WITH seed_tracking (email, normalized_url, created_at) AS (
    VALUES
        ('demo@pricelens.local', 'https://techmart.example/apple-iphone-15-128gb-black', '2026-09-01T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://digital-hub.example/samsung-galaxy-s24-256gb-gray', '2026-09-02T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://gadget-world.example/macbook-air-m2-8-256-midnight', '2026-09-03T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://techmart.example/dell-xps-13-9340-16-512-silver', '2026-09-04T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://digital-hub.example/sony-wh-1000xm5-black', '2026-09-05T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://gadget-world.example/nintendo-switch-oled-white', '2026-09-06T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://techmart.example/canon-eos-r50-18-45-black', '2026-09-07T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://digital-hub.example/kindle-paperwhite-16gb-black', '2026-09-08T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://gadget-world.example/xiaomi-robot-vacuum-s10-white', '2026-09-09T09:00:00Z'::TIMESTAMPTZ),
        ('demo@pricelens.local', 'https://techmart.example/logitech-mx-master-3s-graphite', '2026-09-10T09:00:00Z'::TIMESTAMPTZ),
        ('alert-boundary@pricelens.local', 'https://techmart.example/apple-iphone-15-512gb-black', '2026-09-11T09:00:00Z'::TIMESTAMPTZ)
)
INSERT INTO tracked_products (
    user_id,
    product_variant_id,
    retailer_offer_id,
    normalized_source_url,
    created_at,
    updated_at
)
SELECT
    u.user_id,
    ro.product_variant_id,
    ro.retailer_offer_id,
    st.normalized_url,
    st.created_at,
    st.created_at
FROM seed_tracking AS st
JOIN users AS u
    ON u.email = st.email
JOIN retailer_offers AS ro
    ON ro.normalized_url = st.normalized_url
ON CONFLICT (user_id, normalized_source_url) DO NOTHING;

-- Seed-owned alerts are reset before their supporting observations are rebuilt.
DELETE FROM price_alerts AS pa
USING tracked_products AS tp, users AS u
WHERE pa.tracked_product_id = tp.tracked_product_id
  AND tp.user_id = u.user_id
  AND u.email IN (
      'demo@pricelens.local',
      'alert-boundary@pricelens.local'
  );

CREATE TEMP TABLE seed_price_fixtures (
    normalized_url TEXT NOT NULL,
    price_amount NUMERIC(14,2) NOT NULL,
    availability_status VARCHAR(20) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    scenario_code VARCHAR(20) NOT NULL,
    PRIMARY KEY (normalized_url, observed_at)
) ON COMMIT DROP;

-- US02-A: exactly 30 fixed daily observations.
INSERT INTO seed_price_fixtures VALUES
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23990000.00, 'IN_STOCK', '2026-09-20T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23790000.00, 'IN_STOCK', '2026-09-21T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23590000.00, 'IN_STOCK', '2026-09-22T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23890000.00, 'IN_STOCK', '2026-09-23T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23490000.00, 'IN_STOCK', '2026-09-24T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23290000.00, 'IN_STOCK', '2026-09-25T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23690000.00, 'IN_STOCK', '2026-09-26T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23190000.00, 'IN_STOCK', '2026-09-27T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22990000.00, 'IN_STOCK', '2026-09-28T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 23390000.00, 'IN_STOCK', '2026-09-29T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22790000.00, 'IN_STOCK', '2026-09-30T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22590000.00, 'IN_STOCK', '2026-10-01T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22890000.00, 'IN_STOCK', '2026-10-02T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22490000.00, 'IN_STOCK', '2026-10-03T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22290000.00, 'IN_STOCK', '2026-10-04T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22690000.00, 'IN_STOCK', '2026-10-05T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22190000.00, 'IN_STOCK', '2026-10-06T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21990000.00, 'IN_STOCK', '2026-10-07T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22390000.00, 'IN_STOCK', '2026-10-08T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21790000.00, 'IN_STOCK', '2026-10-09T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21590000.00, 'IN_STOCK', '2026-10-10T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21890000.00, 'IN_STOCK', '2026-10-11T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21490000.00, 'IN_STOCK', '2026-10-12T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21290000.00, 'IN_STOCK', '2026-10-13T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21690000.00, 'IN_STOCK', '2026-10-14T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21190000.00, 'IN_STOCK', '2026-10-15T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 20990000.00, 'IN_STOCK', '2026-10-16T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21390000.00, 'IN_STOCK', '2026-10-17T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 21090000.00, 'IN_STOCK', '2026-10-18T02:00:00Z', 'US02-A'),
    ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 20890000.00, 'IN_STOCK', '2026-10-19T02:00:00Z', 'US02-A');

-- US02-B/C, US03, US05 and US09 deterministic price states.
INSERT INTO seed_price_fixtures VALUES
    ('https://digital-hub.example/kindle-paperwhite-16gb-black', 3990000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US02-B'),
    ('https://techmart.example/dell-xps-13-9340-16-512-silver', 34990000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US03-A'),
    ('https://gadget-world.example/nintendo-switch-oled-white', 8500000.00, 'IN_STOCK', '2026-10-01T08:00:00Z', 'US05'),
    ('https://gadget-world.example/nintendo-switch-oled-white', 7900000.00, 'IN_STOCK', '2026-10-02T08:00:00Z', 'US05'),
    ('https://gadget-world.example/nintendo-switch-oled-white', 7800000.00, 'IN_STOCK', '2026-10-03T08:00:00Z', 'US05'),
    ('https://gadget-world.example/nintendo-switch-oled-white', 8200000.00, 'IN_STOCK', '2026-10-04T08:00:00Z', 'US05'),
    ('https://gadget-world.example/nintendo-switch-oled-white', 7950000.00, 'IN_STOCK', '2026-10-05T08:00:00Z', 'US05'),
    ('https://techmart.example/apple-iphone-15-128gb-black', 19900000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US09-A'),
    ('https://digital-hub.example/apple-iphone-15-128gb-black', 20200000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US09-A'),
    ('https://gadget-world.example/apple-iphone-15-128gb-black', 18200000.00, 'OUT_OF_STOCK', '2026-10-10T08:00:00Z', 'US09-C'),
    ('https://gadget-world.example/apple-iphone-15-256gb-black', 18500000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US09-B'),
    ('https://digital-hub.example/samsung-galaxy-s24-256gb-gray', 18990000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'M2'),
    ('https://techmart.example/apple-iphone-15-512gb-black', 29900000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'US03-C'),
    ('https://techmart.example/canon-eos-r50-18-45-black', 18490000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'M2'),
    ('https://gadget-world.example/xiaomi-robot-vacuum-s10-white', 6190000.00, 'OUT_OF_STOCK', '2026-10-10T08:00:00Z', 'US09-E'),
    ('https://techmart.example/logitech-mx-master-3s-graphite', 2490000.00, 'IN_STOCK', '2026-10-10T08:00:00Z', 'M2');

-- Remove prior M2/runtime observations only for the managed fixture offers.
DELETE FROM price_observations AS po
USING retailer_offers AS ro
WHERE po.retailer_offer_id = ro.retailer_offer_id
  AND ro.normalized_url IN (
      'https://techmart.example/apple-iphone-15-128gb-black',
      'https://digital-hub.example/apple-iphone-15-128gb-black',
      'https://gadget-world.example/apple-iphone-15-128gb-black',
      'https://gadget-world.example/apple-iphone-15-256gb-black',
      'https://techmart.example/apple-iphone-15-512gb-black',
      'https://digital-hub.example/samsung-galaxy-s24-256gb-gray',
      'https://gadget-world.example/macbook-air-m2-8-256-midnight',
      'https://techmart.example/dell-xps-13-9340-16-512-silver',
      'https://digital-hub.example/sony-wh-1000xm5-black',
      'https://gadget-world.example/nintendo-switch-oled-white',
      'https://techmart.example/canon-eos-r50-18-45-black',
      'https://digital-hub.example/kindle-paperwhite-16gb-black',
      'https://gadget-world.example/xiaomi-robot-vacuum-s10-white',
      'https://techmart.example/logitech-mx-master-3s-graphite'
  );

INSERT INTO price_observations (
    retailer_offer_id,
    price_amount,
    currency_code,
    availability_status,
    observed_at
)
SELECT
    ro.retailer_offer_id,
    sp.price_amount,
    'VND',
    sp.availability_status,
    sp.observed_at
FROM seed_price_fixtures AS sp
JOIN retailer_offers AS ro
    ON ro.normalized_url = sp.normalized_url
ORDER BY sp.observed_at, sp.normalized_url;

-- US05: alert state after the second legitimate threshold crossing.
WITH fixture AS (
    SELECT tp.tracked_product_id, po.price_observation_id
    FROM tracked_products AS tp
    JOIN users AS u
        ON u.user_id = tp.user_id
    JOIN retailer_offers AS ro
        ON ro.retailer_offer_id = tp.retailer_offer_id
    JOIN price_observations AS po
        ON po.retailer_offer_id = ro.retailer_offer_id
       AND po.observed_at = '2026-10-05T08:00:00Z'::TIMESTAMPTZ
    WHERE u.email = 'demo@pricelens.local'
      AND tp.normalized_source_url = 'https://gadget-world.example/nintendo-switch-oled-white'
)
INSERT INTO price_alerts (
    tracked_product_id,
    target_price,
    currency_code,
    status,
    last_threshold_state,
    price_observation_id,
    last_evaluated_at,
    created_at,
    updated_at
)
SELECT
    tracked_product_id,
    8000000.00,
    'VND',
    'ACTIVE',
    'AT_OR_BELOW_TARGET',
    price_observation_id,
    '2026-10-05T08:00:00Z',
    '2026-10-01T07:00:00Z',
    '2026-10-05T08:00:00Z'
FROM fixture;

-- US03-C/BR1: exactly 20 active alerts for an isolated user.
WITH fixture AS (
    SELECT tp.tracked_product_id, po.price_observation_id
    FROM tracked_products AS tp
    JOIN users AS u
        ON u.user_id = tp.user_id
    JOIN retailer_offers AS ro
        ON ro.retailer_offer_id = tp.retailer_offer_id
    JOIN price_observations AS po
        ON po.retailer_offer_id = ro.retailer_offer_id
       AND po.observed_at = '2026-10-10T08:00:00Z'::TIMESTAMPTZ
    WHERE u.email = 'alert-boundary@pricelens.local'
      AND tp.normalized_source_url = 'https://techmart.example/apple-iphone-15-512gb-black'
)
INSERT INTO price_alerts (
    tracked_product_id,
    target_price,
    currency_code,
    status,
    last_threshold_state,
    price_observation_id,
    last_evaluated_at,
    created_at,
    updated_at
)
SELECT
    fixture.tracked_product_id,
    (10000000 + series.alert_number * 500000)::NUMERIC(14,2),
    'VND',
    'ACTIVE',
    'ABOVE_TARGET',
    fixture.price_observation_id,
    '2026-10-10T08:00:00Z',
    '2026-10-10T07:00:00Z'::TIMESTAMPTZ + series.alert_number * INTERVAL '1 minute',
    '2026-10-10T08:00:00Z'
FROM fixture
CROSS JOIN generate_series(1, 20) AS series(alert_number);

-- US05/BR4: notifications exist only for the two qualifying crossings.
WITH us05_alert AS (
    SELECT pa.price_alert_id
    FROM price_alerts AS pa
    JOIN tracked_products AS tp
        ON tp.tracked_product_id = pa.tracked_product_id
    JOIN users AS u
        ON u.user_id = tp.user_id
    WHERE u.email = 'demo@pricelens.local'
      AND tp.normalized_source_url = 'https://gadget-world.example/nintendo-switch-oled-white'
      AND pa.target_price = 8000000.00
),
crossings (observed_at, sent_at, provider_message_id) AS (
    VALUES
        ('2026-10-02T08:00:00Z'::TIMESTAMPTZ, '2026-10-02T08:01:00Z'::TIMESTAMPTZ, 'demo-us05-crossing-1'),
        ('2026-10-05T08:00:00Z'::TIMESTAMPTZ, '2026-10-05T08:01:00Z'::TIMESTAMPTZ, 'demo-us05-crossing-2')
)
INSERT INTO notifications (
    price_alert_id,
    price_observation_id,
    recipient_email,
    subject,
    delivery_status,
    qualified_at,
    sent_at,
    provider_message_id,
    created_at
)
SELECT
    ua.price_alert_id,
    po.price_observation_id,
    'demo@pricelens.local',
    'Price Drop Alert: Nintendo Switch OLED',
    'SENT',
    c.observed_at,
    c.sent_at,
    c.provider_message_id,
    c.observed_at
FROM us05_alert AS ua
CROSS JOIN crossings AS c
JOIN retailer_offers AS ro
    ON ro.normalized_url = 'https://gadget-world.example/nintendo-switch-oled-white'
JOIN price_observations AS po
    ON po.retailer_offer_id = ro.retailer_offer_id
   AND po.observed_at = c.observed_at;

-- Lightweight drift checks for all P0 fixtures.
DO $seed_validation$
DECLARE
    demo_tracked_count INTEGER;
    history_30_count INTEGER;
    history_1_count INTEGER;
    history_0_count INTEGER;
    boundary_alert_count INTEGER;
    users_over_limit INTEGER;
    iphone_variant_count INTEGER;
    duplicate_baseline_count INTEGER;
    matching_in_stock_count INTEGER;
    matching_out_of_stock_count INTEGER;
    mismatched_offer_count INTEGER;
    single_offer_count INTEGER;
    zero_available_count INTEGER;
    us05_notification_count INTEGER;
    us05_prices NUMERIC[];
BEGIN
    SELECT COUNT(*) INTO demo_tracked_count
    FROM tracked_products AS tp
    JOIN users AS u ON u.user_id = tp.user_id
    WHERE u.email = 'demo@pricelens.local';

    SELECT COUNT(*) INTO history_30_count
    FROM price_observations AS po
    JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
    JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
    JOIN products AS p ON p.product_id = pv.product_id
    WHERE p.canonical_key = 'apple-macbook-air-m2'
      AND pv.variant_key = '8gb-256gb-midnight';

    SELECT COUNT(*) INTO history_1_count
    FROM price_observations AS po
    JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
    WHERE ro.normalized_url = 'https://digital-hub.example/kindle-paperwhite-16gb-black';

    SELECT COUNT(*) INTO history_0_count
    FROM price_observations AS po
    JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
    WHERE ro.normalized_url = 'https://digital-hub.example/sony-wh-1000xm5-black';

    SELECT COUNT(*) INTO boundary_alert_count
    FROM price_alerts AS pa
    JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
    JOIN users AS u ON u.user_id = tp.user_id
    WHERE u.email = 'alert-boundary@pricelens.local'
      AND pa.status = 'ACTIVE';

    SELECT COUNT(*) INTO users_over_limit
    FROM (
        SELECT tp.user_id
        FROM price_alerts AS pa
        JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
        WHERE pa.status = 'ACTIVE'
        GROUP BY tp.user_id
        HAVING COUNT(*) > 20
    ) AS over_limit;

    SELECT COUNT(*) INTO iphone_variant_count
    FROM product_variants AS pv
    JOIN products AS p ON p.product_id = pv.product_id
    WHERE p.canonical_key = 'apple-iphone-15';

    SELECT COUNT(*) INTO duplicate_baseline_count
    FROM tracked_products AS tp
    JOIN users AS u ON u.user_id = tp.user_id
    WHERE u.email = 'demo@pricelens.local'
      AND tp.normalized_source_url = 'https://techmart.example/apple-iphone-15-128gb-black';

    SELECT COUNT(*) FILTER (WHERE latest.availability_status = 'IN_STOCK'),
           COUNT(*) FILTER (WHERE latest.availability_status = 'OUT_OF_STOCK')
    INTO matching_in_stock_count, matching_out_of_stock_count
    FROM retailer_offers AS ro
    JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
    JOIN products AS p ON p.product_id = pv.product_id
    JOIN LATERAL (
        SELECT po.availability_status
        FROM price_observations AS po
        WHERE po.retailer_offer_id = ro.retailer_offer_id
        ORDER BY po.observed_at DESC
        LIMIT 1
    ) AS latest ON TRUE
    WHERE p.canonical_key = 'apple-iphone-15'
      AND pv.variant_key = '128gb-black';

    SELECT COUNT(*) INTO mismatched_offer_count
    FROM retailer_offers AS ro
    JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
    JOIN products AS p ON p.product_id = pv.product_id
    WHERE p.canonical_key = 'apple-iphone-15'
      AND pv.variant_key = '256gb-black';

    SELECT COUNT(*) INTO single_offer_count
    FROM retailer_offers AS ro
    JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
    JOIN products AS p ON p.product_id = pv.product_id
    JOIN price_observations AS po ON po.retailer_offer_id = ro.retailer_offer_id
    WHERE p.canonical_key = 'dell-xps-13-9340'
      AND pv.variant_key = '16gb-512gb-silver'
      AND po.availability_status = 'IN_STOCK';

    SELECT COUNT(*) INTO zero_available_count
    FROM retailer_offers AS ro
    JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
    JOIN products AS p ON p.product_id = pv.product_id
    JOIN price_observations AS po ON po.retailer_offer_id = ro.retailer_offer_id
    WHERE p.canonical_key = 'xiaomi-robot-vacuum-s10'
      AND pv.variant_key = 'white'
      AND po.availability_status = 'IN_STOCK';

    SELECT array_agg(po.price_amount ORDER BY po.observed_at)
    INTO us05_prices
    FROM price_observations AS po
    JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
    WHERE ro.normalized_url = 'https://gadget-world.example/nintendo-switch-oled-white';

    SELECT COUNT(*) INTO us05_notification_count
    FROM notifications AS n
    JOIN price_alerts AS pa ON pa.price_alert_id = n.price_alert_id
    JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
    WHERE tp.normalized_source_url = 'https://gadget-world.example/nintendo-switch-oled-white';

    IF demo_tracked_count <> 10
       OR history_30_count <> 30
       OR history_1_count <> 1
       OR history_0_count <> 0
       OR boundary_alert_count <> 20
       OR users_over_limit <> 0
       OR iphone_variant_count <> 3
       OR duplicate_baseline_count <> 1
       OR matching_in_stock_count <> 2
       OR matching_out_of_stock_count <> 1
       OR mismatched_offer_count <> 1
       OR single_offer_count <> 1
       OR zero_available_count <> 0
       OR us05_notification_count <> 2
       OR us05_prices <> ARRAY[
           8500000.00,
           7900000.00,
           7800000.00,
           8200000.00,
           7950000.00
       ]::NUMERIC[] THEN
        RAISE EXCEPTION 'P0 seed validation failed';
    END IF;

    RAISE NOTICE
        'P0 seed validation passed: M2=10, US02=30/1/0, BR1=20, US05=5, US09=2/1/1';
END
$seed_validation$;
`;

export async function seedDemoData(client) {
  await client.query(demoSeedSql);
}
