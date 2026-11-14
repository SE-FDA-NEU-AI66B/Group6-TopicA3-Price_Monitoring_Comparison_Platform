const sessionsAndAlertUniquenessSql = String.raw`
CREATE TABLE IF NOT EXISTS user_sessions (
    user_session_id BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_user_sessions PRIMARY KEY (user_session_id),
    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_user_sessions_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires
    ON user_sessions (user_id, expires_at);

UPDATE price_alerts AS pa
SET status = 'INACTIVE'
FROM (
    SELECT
        price_alert_id,
        ROW_NUMBER() OVER (
            PARTITION BY tracked_product_id, target_price
            ORDER BY price_alert_id
        ) AS position
    FROM price_alerts
    WHERE status = 'ACTIVE'
) AS ranked
WHERE pa.price_alert_id = ranked.price_alert_id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_alerts_active_target
    ON price_alerts (tracked_product_id, target_price)
    WHERE status = 'ACTIVE';
`;

export async function applySessionsAndAlertUniqueness(client) {
  await client.query(sessionsAndAlertUniquenessSql);
}
