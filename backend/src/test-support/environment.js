import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const applicationDatabaseName = process.env.PRICELENS_APPLICATION_DB_NAME?.trim()
  || process.env.DB_NAME?.trim();
const testDatabaseName = process.env.TEST_DB_NAME?.trim();

if (!applicationDatabaseName) {
  throw new Error('DB_NAME must identify the normal PriceLens application database.');
}

if (!testDatabaseName) {
  throw new Error(
    'TEST_DB_NAME must explicitly identify a separate PostgreSQL test database.',
  );
}

if (testDatabaseName === applicationDatabaseName) {
  throw new Error('TEST_DB_NAME must be different from the normal DB_NAME.');
}

process.env.PRICELENS_APPLICATION_DB_NAME = applicationDatabaseName;
process.env.NODE_ENV = 'test';
process.env.DB_NAME = testDatabaseName;
