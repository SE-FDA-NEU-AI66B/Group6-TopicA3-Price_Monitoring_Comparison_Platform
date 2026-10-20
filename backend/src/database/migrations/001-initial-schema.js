const initialSchemaSql = String.raw`
-- PriceLens initial PostgreSQL schema.
-- This migration creates structure only. Seed data belongs to Sub-Issue #77.

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_not_blank CHECK (btrim(email) <> ''),
    CONSTRAINT ck_users_email_normalized
        CHECK (email = lower(btrim(email))),
    CONSTRAINT ck_users_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT ck_users_account_status
        CHECK (account_status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE products (
    product_id BIGINT GENERATED ALWAYS AS IDENTITY,
    canonical_key VARCHAR(200) NOT NULL,
    brand VARCHAR(120) NOT NULL,
    model VARCHAR(160) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_products PRIMARY KEY (product_id),
    CONSTRAINT uq_products_canonical_key UNIQUE (canonical_key),
    CONSTRAINT ck_products_canonical_key_not_blank CHECK (btrim(canonical_key) <> ''),
    CONSTRAINT ck_products_brand_not_blank CHECK (btrim(brand) <> ''),
    CONSTRAINT ck_products_model_not_blank CHECK (btrim(model) <> ''),
    CONSTRAINT ck_products_display_name_not_blank CHECK (btrim(display_name) <> '')
);

CREATE TABLE retailers (
    retailer_id BIGINT GENERATED ALWAYS AS IDENTITY,
    source_code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_retailers PRIMARY KEY (retailer_id),
    CONSTRAINT uq_retailers_source_code UNIQUE (source_code),
    CONSTRAINT uq_retailers_domain UNIQUE (domain),
    CONSTRAINT ck_retailers_source_code_not_blank CHECK (btrim(source_code) <> ''),
    CONSTRAINT ck_retailers_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_retailers_domain_not_blank CHECK (btrim(domain) <> '')
);

CREATE TABLE product_variants (
    product_variant_id BIGINT GENERATED ALWAYS AS IDENTITY,
    product_id BIGINT NOT NULL,
    variant_key VARCHAR(200) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_product_variants PRIMARY KEY (product_variant_id),
    CONSTRAINT fk_product_variants_product
        FOREIGN KEY (product_id)
        REFERENCES products (product_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_product_variants_product_variant_key
        UNIQUE (product_id, variant_key),
    CONSTRAINT ck_product_variants_variant_key_not_blank
        CHECK (btrim(variant_key) <> ''),
    CONSTRAINT ck_product_variants_display_name_not_blank
        CHECK (btrim(display_name) <> ''),
    CONSTRAINT ck_product_variants_attributes_object
        CHECK (jsonb_typeof(attributes) = 'object')
);

CREATE TABLE retailer_offers (
    retailer_offer_id BIGINT GENERATED ALWAYS AS IDENTITY,
    retailer_id BIGINT NOT NULL,
    product_variant_id BIGINT NOT NULL,
    normalized_url TEXT NOT NULL,
    external_offer_id VARCHAR(200),
    last_refresh_attempt_at TIMESTAMPTZ,
    last_refresh_status VARCHAR(20),
    last_refresh_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_retailer_offers PRIMARY KEY (retailer_offer_id),
    CONSTRAINT fk_retailer_offers_retailer
        FOREIGN KEY (retailer_id)
        REFERENCES retailers (retailer_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_retailer_offers_product_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variants (product_variant_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_retailer_offers_listing
        UNIQUE (retailer_id, product_variant_id, normalized_url),
    CONSTRAINT uq_retailer_offers_id_variant
        UNIQUE (retailer_offer_id, product_variant_id),
    CONSTRAINT ck_retailer_offers_url_not_blank
        CHECK (btrim(normalized_url) <> ''),
    CONSTRAINT ck_retailer_offers_refresh_status
        CHECK (
            last_refresh_status IS NULL
            OR last_refresh_status IN ('SUCCEEDED', 'FAILED')
        ),
    CONSTRAINT ck_retailer_offers_refresh_metadata
        CHECK (
            (
                last_refresh_attempt_at IS NULL
                AND last_refresh_status IS NULL
                AND last_refresh_error IS NULL
            )
            OR (last_refresh_attempt_at IS NOT NULL AND last_refresh_status IS NOT NULL)
        ),
    CONSTRAINT ck_retailer_offers_success_has_no_error
        CHECK (
            last_refresh_status IS DISTINCT FROM 'SUCCEEDED'
            OR last_refresh_error IS NULL
        ),
    CONSTRAINT ck_retailer_offers_failure_has_error
        CHECK (
            last_refresh_status IS DISTINCT FROM 'FAILED'
            OR NULLIF(btrim(last_refresh_error), '') IS NOT NULL
        )
);

CREATE TABLE tracked_products (
    tracked_product_id BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT NOT NULL,
    product_variant_id BIGINT NOT NULL,
    retailer_offer_id BIGINT NOT NULL,
    normalized_source_url TEXT NOT NULL,
    tracking_status VARCHAR(20) NOT NULL DEFAULT 'TRACKING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_tracked_products PRIMARY KEY (tracked_product_id),
    CONSTRAINT fk_tracked_products_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tracked_products_product_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variants (product_variant_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tracked_products_offer_variant
        FOREIGN KEY (retailer_offer_id, product_variant_id)
        REFERENCES retailer_offers (retailer_offer_id, product_variant_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_tracked_products_user_source_url
        UNIQUE (user_id, normalized_source_url),
    CONSTRAINT ck_tracked_products_source_url_not_blank
        CHECK (btrim(normalized_source_url) <> ''),
    CONSTRAINT ck_tracked_products_status
        CHECK (tracking_status = 'TRACKING')
);

CREATE TABLE price_observations (
    price_observation_id BIGINT GENERATED ALWAYS AS IDENTITY,
    retailer_offer_id BIGINT NOT NULL,
    price_amount NUMERIC(14,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    availability_status VARCHAR(20) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_price_observations PRIMARY KEY (price_observation_id),
    CONSTRAINT fk_price_observations_retailer_offer
        FOREIGN KEY (retailer_offer_id)
        REFERENCES retailer_offers (retailer_offer_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_price_observations_offer_time
        UNIQUE (retailer_offer_id, observed_at),
    CONSTRAINT ck_price_observations_positive_price
        CHECK (price_amount > 0),
    CONSTRAINT ck_price_observations_currency_code
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_price_observations_availability
        CHECK (availability_status IN ('IN_STOCK', 'OUT_OF_STOCK'))
);

CREATE TABLE price_alerts (
    price_alert_id BIGINT GENERATED ALWAYS AS IDENTITY,
    tracked_product_id BIGINT NOT NULL,
    target_price NUMERIC(14,2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_threshold_state VARCHAR(30) NOT NULL DEFAULT 'ABOVE_TARGET',
    price_observation_id BIGINT NOT NULL,
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_price_alerts PRIMARY KEY (price_alert_id),
    CONSTRAINT fk_price_alerts_tracked_product
        FOREIGN KEY (tracked_product_id)
        REFERENCES tracked_products (tracked_product_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_price_alerts_price_observation
        FOREIGN KEY (price_observation_id)
        REFERENCES price_observations (price_observation_id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_price_alerts_positive_target
        CHECK (target_price > 0),
    CONSTRAINT ck_price_alerts_currency_code
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_price_alerts_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    CONSTRAINT ck_price_alerts_threshold_state
        CHECK (
            last_threshold_state IN ('ABOVE_TARGET', 'AT_OR_BELOW_TARGET')
        )
);

CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY,
    price_alert_id BIGINT NOT NULL,
    price_observation_id BIGINT NOT NULL,
    recipient_email VARCHAR(254) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    qualified_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    provider_message_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_notifications PRIMARY KEY (notification_id),
    CONSTRAINT fk_notifications_price_alert
        FOREIGN KEY (price_alert_id)
        REFERENCES price_alerts (price_alert_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notifications_price_observation
        FOREIGN KEY (price_observation_id)
        REFERENCES price_observations (price_observation_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_notifications_alert_observation
        UNIQUE (price_alert_id, price_observation_id),
    CONSTRAINT ck_notifications_recipient_not_blank
        CHECK (btrim(recipient_email) <> ''),
    CONSTRAINT ck_notifications_subject_not_blank
        CHECK (btrim(subject) <> ''),
    CONSTRAINT ck_notifications_delivery_status
        CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
    CONSTRAINT ck_notifications_delivery_metadata
        CHECK (
            (
                delivery_status = 'PENDING'
                AND sent_at IS NULL
                AND failure_reason IS NULL
            )
            OR (
                delivery_status = 'SENT'
                AND sent_at IS NOT NULL
                AND sent_at >= qualified_at
                AND failure_reason IS NULL
            )
            OR (
                delivery_status = 'FAILED'
                AND sent_at IS NULL
                AND NULLIF(btrim(failure_reason), '') IS NOT NULL
            )
        )
);

-- Keep update timestamps consistent for both interactive and background writers.

CREATE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_retailer_offers_set_updated_at
    BEFORE UPDATE ON retailer_offers
    FOR EACH ROW
    EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_tracked_products_set_updated_at
    BEFORE UPDATE ON tracked_products
    FOR EACH ROW
    EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_price_alerts_set_updated_at
    BEFORE UPDATE ON price_alerts
    FOR EACH ROW
    EXECUTE FUNCTION set_row_updated_at();

-- Foreign-key and high-frequency query indexes. Primary-key and UNIQUE
-- constraints already create their own indexes and are not duplicated here.

CREATE INDEX idx_retailer_offers_variant_retailer
    ON retailer_offers (product_variant_id, retailer_id);

CREATE INDEX idx_tracked_products_user_status_created
    ON tracked_products (user_id, tracking_status, created_at DESC);

CREATE INDEX idx_tracked_products_product_variant
    ON tracked_products (product_variant_id);

CREATE INDEX idx_price_alerts_tracked_product_status
    ON price_alerts (tracked_product_id, status);

CREATE INDEX idx_price_alerts_price_observation
    ON price_alerts (price_observation_id);

CREATE INDEX idx_notifications_alert_created
    ON notifications (price_alert_id, created_at DESC);

CREATE INDEX idx_notifications_price_observation
    ON notifications (price_observation_id);
`;

export async function applyInitialSchema(client) {
  await client.query(initialSchemaSql);
}

