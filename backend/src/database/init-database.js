import pg from 'pg';

import { config } from '../config.js';
import { applyInitialSchema } from './migrations/001-initial-schema.js';
import { seedDemoData } from './seeds/001-demo-data.js';

const { Client } = pg;

const EXPECTED_TABLES = Object.freeze([
  'users',
  'products',
  'retailers',
  'product_variants',
  'retailer_offers',
  'tracked_products',
  'price_observations',
  'price_alerts',
  'notifications',
]);

const EXPECTED_TRIGGERS = Object.freeze([
  'trg_users_set_updated_at',
  'trg_retailer_offers_set_updated_at',
  'trg_tracked_products_set_updated_at',
  'trg_price_alerts_set_updated_at',
]);

const DATABASE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEMO_EMAIL = 'demo@pricelens.local';

function connectionOptions(database) {
  return {
    host: config.database.host,
    port: config.database.port,
    database,
    user: config.database.user,
    password: config.database.password,
    connectionTimeoutMillis: config.database.connectionTimeoutMillis,
  };
}

function quoteIdentifier(identifier) {
  if (!DATABASE_NAME_PATTERN.test(identifier)) {
    throw new Error(
      'DB_NAME must contain only letters, numbers and underscores and cannot start with a number.',
    );
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}

async function createDatabaseIfMissing() {
  const databaseName = config.database.name;
  const quotedDatabaseName = quoteIdentifier(databaseName);
  const maintenanceClient = new Client(connectionOptions('postgres'));

  try {
    await maintenanceClient.connect();

    const result = await maintenanceClient.query(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [databaseName],
    );

    if (!result.rows[0].exists) {
      try {
        await maintenanceClient.query(`CREATE DATABASE ${quotedDatabaseName}`);
      } catch (error) {
        // A concurrent initializer may create the same database after the check.
        if (error.code !== '42P04') {
          throw error;
        }
      }
    }
  } finally {
    await maintenanceClient.end().catch(() => {});
  }
}

async function listPublicTables(client) {
  const result = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );

  return result.rows.map((row) => row.tablename);
}

async function applySchemaWhenNeeded(client) {
  const publicTables = await listPublicTables(client);
  const expectedPresent = EXPECTED_TABLES.filter((table) => publicTables.includes(table));

  if (publicTables.length === 0) {
    await runTransaction(client, 'Initial schema migration', applyInitialSchema);
    return;
  }

  if (expectedPresent.length === EXPECTED_TABLES.length) {
    return;
  }

  const missing = EXPECTED_TABLES.filter((table) => !publicTables.includes(table));
  const present = expectedPresent.length ? expectedPresent.join(', ') : 'none';

  throw new Error(
    `Database schema is partially initialized. Present expected tables: ${present}. Missing: ${missing.join(', ')}.`,
  );
}

async function runTransaction(client, label, operation) {
  await client.query('BEGIN');

  try {
    await operation(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw new Error(`${label} failed: ${error.message}`, { cause: error });
  }
}

async function validateInitialization(client) {
  const tableResult = await client.query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = ANY($1::TEXT[])`,
    [EXPECTED_TABLES],
  );

  const triggerResult = await client.query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname = ANY($1::TEXT[])`,
    [EXPECTED_TRIGGERS],
  );

  const demoResult = await client.query(
    `SELECT
       u.user_id,
       COUNT(tp.tracked_product_id)::INTEGER AS tracked_product_count
     FROM users AS u
     LEFT JOIN tracked_products AS tp ON tp.user_id = u.user_id
     WHERE u.email = $1
     GROUP BY u.user_id`,
    [DEMO_EMAIL],
  );

  const tableCount = tableResult.rows[0].count;
  const triggerCount = triggerResult.rows[0].count;
  const demoUser = demoResult.rows[0];
  const trackedProductCount = demoUser?.tracked_product_count ?? 0;

  if (tableCount !== EXPECTED_TABLES.length) {
    throw new Error(`Validation failed: expected 9 application tables, found ${tableCount}.`);
  }

  if (triggerCount !== EXPECTED_TRIGGERS.length) {
    throw new Error(`Validation failed: expected 4 update triggers, found ${triggerCount}.`);
  }

  if (!demoUser) {
    throw new Error(`Validation failed: demo user ${DEMO_EMAIL} was not found.`);
  }

  if (trackedProductCount !== 10) {
    throw new Error(
      `Validation failed: expected 10 demo tracked products, found ${trackedProductCount}.`,
    );
  }

  return { tableCount, triggerCount, trackedProductCount };
}

async function initializeDatabase() {
  quoteIdentifier(config.database.name);
  await createDatabaseIfMissing();

  const targetClient = new Client(connectionOptions(config.database.name));

  try {
    await targetClient.connect();
    await applySchemaWhenNeeded(targetClient);
    await runTransaction(targetClient, 'Demo seed', seedDemoData);

    const result = await validateInitialization(targetClient);

    console.log('PriceLens database initialized successfully.');
    console.log(`Database: ${config.database.name}`);
    console.log(`Tables: ${result.tableCount}`);
    console.log(`Update triggers: ${result.triggerCount}`);
    console.log(`Demo tracked products: ${result.trackedProductCount}`);
  } finally {
    await targetClient.end().catch(() => {});
  }
}

initializeDatabase().catch((error) => {
  console.error(`PriceLens database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
