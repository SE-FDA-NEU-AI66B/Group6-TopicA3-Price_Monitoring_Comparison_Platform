import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { config } from '../config.js';

const execFileAsync = promisify(execFile);
const initializerPath = fileURLToPath(
  new URL('../database/init-database.js', import.meta.url),
);
const backendDirectory = fileURLToPath(new URL('../..', import.meta.url));

export async function prepareSeededDatabase({ confirmedDatabaseName } = {}) {
  assertSafeTestDatabaseTarget({ confirmedDatabaseName });

  const result = await execFileAsync(process.execPath, [initializerPath], {
    cwd: backendDirectory,
    env: process.env,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  return Object.freeze({
    databaseName: config.database.name,
    output: result.stdout.trim(),
  });
}

export function assertSafeTestDatabaseTarget({
  nodeEnv = config.nodeEnv,
  databaseName = config.database.name,
  designatedTestDatabaseName = process.env.TEST_DB_NAME?.trim(),
  applicationDatabaseName = process.env.PRICELENS_APPLICATION_DB_NAME?.trim(),
  confirmedDatabaseName,
} = {}) {
  if (nodeEnv !== 'test') {
    throw new Error('Test database preparation requires NODE_ENV=test.');
  }

  if (!designatedTestDatabaseName || databaseName !== designatedTestDatabaseName) {
    throw new Error(
      'Refusing to prepare PostgreSQL: configured DB_NAME must equal the explicit TEST_DB_NAME.',
    );
  }

  if (!applicationDatabaseName || databaseName === applicationDatabaseName) {
    throw new Error(
      'Refusing to prepare PostgreSQL: the test database must differ from the normal application DB_NAME.',
    );
  }

  if (
    typeof confirmedDatabaseName !== 'string'
    || confirmedDatabaseName !== databaseName
  ) {
    throw new Error(
      `Refusing to prepare PostgreSQL: confirmedDatabaseName must exactly match the designated test database (${databaseName}).`,
    );
  }
}
