#!/usr/bin/env bash
set -Eeuo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pricelens}"
DB_USER="${DB_USER:-postgres}"
PSQL_BIN="${PSQL_PATH:-$(command -v psql || true)}"

on_error() {
    echo "PriceLens database initialization failed. Check the error above." >&2
}
trap on_error ERR

if [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "DB_NAME must contain only letters, numbers and underscores and cannot start with a number." >&2
    exit 1
fi

if [[ -z "$PSQL_BIN" || ! -x "$PSQL_BIN" ]]; then
    echo "psql was not found. Add PostgreSQL bin to PATH or set PSQL_PATH." >&2
    exit 1
fi

CREATEDB_BIN="$(dirname "$PSQL_BIN")/createdb"
if [[ ! -x "$CREATEDB_BIN" ]]; then
    CREATEDB_BIN="$(command -v createdb || true)"
fi
if [[ -z "$CREATEDB_BIN" || ! -x "$CREATEDB_BIN" ]]; then
    echo "createdb was not found beside psql or on PATH." >&2
    exit 1
fi

if [[ -n "${DB_PASSWORD:-}" ]]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_PATH="$SCRIPT_DIR/migrations/001_initial_schema.sql"
SEED_PATH="$SCRIPT_DIR/seeds/001_demo_data.sql"

[[ -f "$SCHEMA_PATH" ]] || { echo "Schema file not found: $SCHEMA_PATH" >&2; exit 1; }
[[ -f "$SEED_PATH" ]] || { echo "Seed file not found: $SEED_PATH" >&2; exit 1; }

echo "Checking database '$DB_NAME'..."
database_exists="$("$PSQL_BIN" -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tA -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';")"

if [[ "$database_exists" == "1" ]]; then
    echo "Database '$DB_NAME' already exists. Use a clean database or choose another DB_NAME." >&2
    exit 1
fi

echo "Creating database '$DB_NAME'..."
"$CREATEDB_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

echo "Applying schema..."
"$PSQL_BIN" -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCHEMA_PATH"

echo "Loading demo seed data..."
"$PSQL_BIN" -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SEED_PATH"

row_count="$("$PSQL_BIN" -X -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tA -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM tracked_products tp JOIN users u ON u.user_id = tp.user_id WHERE u.email = 'demo@pricelens.local';")"

if [[ "$row_count" != "10" ]]; then
    echo "Validation failed: expected 10 tracked_products, found '$row_count'." >&2
    exit 1
fi

trap - ERR
echo "PriceLens database initialized successfully."
echo "Walking-skeleton table: tracked_products"
echo "Expected demo row count: 10"
