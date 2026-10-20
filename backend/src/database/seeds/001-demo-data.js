const demoSeedSql = String.raw`
-- Deterministic, non-sensitive data for the /watchlist walking skeleton.
-- Re-running this file does not duplicate the demo user's tracked products.

INSERT INTO users (email, password_hash, display_name)
VALUES (
    'demo@pricelens.local',
    '$2b$12$4WFhysFzB4prj.QNJZk9lOI9Gjy8HCiqbn7nbArdEbrxOIkUKenoK',
    'PriceLens Demo Shopper'
)
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    account_status = 'ACTIVE';

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

WITH seed_variants (
    canonical_key,
    variant_key,
    display_name,
    attributes
) AS (
    VALUES
        ('apple-iphone-15', '128gb-black', 'iPhone 15 128GB Black', '{"storage":"128GB","color":"Black"}'::JSONB),
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

WITH seed_offers (
    source_code,
    canonical_key,
    variant_key,
    normalized_url,
    external_offer_id
) AS (
    VALUES
        ('TECHMART', 'apple-iphone-15', '128gb-black', 'https://techmart.example/apple-iphone-15-128gb-black', 'TM-IP15-128-BLK'),
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
    CURRENT_TIMESTAMP,
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

WITH seed_tracking (normalized_url) AS (
    VALUES
        ('https://techmart.example/apple-iphone-15-128gb-black'),
        ('https://digital-hub.example/samsung-galaxy-s24-256gb-gray'),
        ('https://gadget-world.example/macbook-air-m2-8-256-midnight'),
        ('https://techmart.example/dell-xps-13-9340-16-512-silver'),
        ('https://digital-hub.example/sony-wh-1000xm5-black'),
        ('https://gadget-world.example/nintendo-switch-oled-white'),
        ('https://techmart.example/canon-eos-r50-18-45-black'),
        ('https://digital-hub.example/kindle-paperwhite-16gb-black'),
        ('https://gadget-world.example/xiaomi-robot-vacuum-s10-white'),
        ('https://techmart.example/logitech-mx-master-3s-graphite')
)
INSERT INTO tracked_products (
    user_id,
    product_variant_id,
    retailer_offer_id,
    normalized_source_url
)
SELECT
    u.user_id,
    ro.product_variant_id,
    ro.retailer_offer_id,
    st.normalized_url
FROM seed_tracking AS st
JOIN retailer_offers AS ro
    ON ro.normalized_url = st.normalized_url
CROSS JOIN users AS u
WHERE u.email = 'demo@pricelens.local'
ON CONFLICT (user_id, normalized_source_url) DO NOTHING;

WITH seed_prices (
    normalized_url,
    price_amount,
    availability_status,
    age_hours
) AS (
    VALUES
        ('https://techmart.example/apple-iphone-15-128gb-black', 17490000.00, 'IN_STOCK', 1),
        ('https://digital-hub.example/samsung-galaxy-s24-256gb-gray', 18990000.00, 'IN_STOCK', 2),
        ('https://gadget-world.example/macbook-air-m2-8-256-midnight', 22990000.00, 'IN_STOCK', 3),
        ('https://techmart.example/dell-xps-13-9340-16-512-silver', 34990000.00, 'IN_STOCK', 4),
        ('https://digital-hub.example/sony-wh-1000xm5-black', 7490000.00, 'OUT_OF_STOCK', 5),
        ('https://gadget-world.example/nintendo-switch-oled-white', 8490000.00, 'IN_STOCK', 6),
        ('https://techmart.example/canon-eos-r50-18-45-black', 18490000.00, 'IN_STOCK', 7),
        ('https://digital-hub.example/kindle-paperwhite-16gb-black', 3990000.00, 'IN_STOCK', 8),
        ('https://gadget-world.example/xiaomi-robot-vacuum-s10-white', 6190000.00, 'OUT_OF_STOCK', 9),
        ('https://techmart.example/logitech-mx-master-3s-graphite', 2490000.00, 'IN_STOCK', 10)
)
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
    CURRENT_TIMESTAMP - (sp.age_hours * INTERVAL '1 hour')
FROM seed_prices AS sp
JOIN retailer_offers AS ro
    ON ro.normalized_url = sp.normalized_url
WHERE NOT EXISTS (
    SELECT 1
    FROM price_observations AS existing
    WHERE existing.retailer_offer_id = ro.retailer_offer_id
);

DO $seed_validation$
DECLARE
    seeded_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO seeded_count
    FROM tracked_products AS tp
    JOIN users AS u ON u.user_id = tp.user_id
    WHERE u.email = 'demo@pricelens.local';

    IF seeded_count <> 10 THEN
        RAISE EXCEPTION
            'Seed validation failed: expected 10 tracked_products, found %',
            seeded_count;
    END IF;

    RAISE NOTICE
        'Seed validation passed: 10 tracked_products for demo@pricelens.local';
END
$seed_validation$;
`;

export async function seedDemoData(client) {
  await client.query(demoSeedSql);
}

