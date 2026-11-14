import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError, trackedProductNotFound } from '../shared/problems.js';
import { closePool, withTransaction } from './pool.js';

function fakeDatabase({ rollbackError } = {}) {
  const statements = [];
  let releases = 0;
  const client = {
    async query(text, parameters) {
      statements.push({ text, parameters });

      if (text === 'ROLLBACK' && rollbackError) {
        throw rollbackError;
      }

      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  };

  return {
    database: { connect: async () => client },
    statements,
    releaseCount: () => releases,
  };
}

test('withTransaction commits on success and releases its client', async () => {
  const fake = fakeDatabase();

  const value = await withTransaction(async (client) => {
    await client.query('UPDATE example SET value = $1 WHERE id = $2', ['safe', '1']);
    return 'completed';
  }, fake.database);

  assert.equal(value, 'completed');
  assert.deepEqual(fake.statements, [
    { text: 'BEGIN', parameters: undefined },
    {
      text: 'UPDATE example SET value = $1 WHERE id = $2',
      parameters: ['safe', '1'],
    },
    { text: 'COMMIT', parameters: undefined },
  ]);
  assert.equal(fake.releaseCount(), 1);
});

test('withTransaction rolls back, safely translates database failures and releases', async () => {
  const fake = fakeDatabase();
  const databaseError = {
    name: 'DatabaseError',
    code: 'XX999',
    detail: 'PRIVATE_DATABASE_DETAIL',
  };

  await assert.rejects(
    () => withTransaction(async () => {
      throw databaseError;
    }, fake.database),
    (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 500);
      assert.equal(error.code, 'INTERNAL_SERVER_ERROR');
      assert.equal(error.detail, 'An unexpected server failure occurred.');
      assert.equal(error.cause, databaseError);
      assert.doesNotMatch(error.detail, /PRIVATE_DATABASE_DETAIL/);
      return true;
    },
  );

  assert.deepEqual(fake.statements.map(({ text }) => text), ['BEGIN', 'ROLLBACK']);
  assert.equal(fake.releaseCount(), 1);
});

test('withTransaction preserves application errors and releases after rollback failure', async () => {
  const fake = fakeDatabase({ rollbackError: new Error('rollback failed') });
  const applicationError = trackedProductNotFound();
  const originalConsoleError = console.error;
  const logCalls = [];
  console.error = (...arguments_) => logCalls.push(arguments_);

  try {
    await assert.rejects(
      () => withTransaction(async () => {
        throw applicationError;
      }, fake.database),
      (error) => error === applicationError,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(fake.statements.map(({ text }) => text), ['BEGIN', 'ROLLBACK']);
  assert.equal(fake.releaseCount(), 1);
  assert.equal(logCalls.length, 1);
});

test('shared pool shutdown is idempotent', async () => {
  const firstClose = closePool();
  const secondClose = closePool();

  assert.equal(secondClose, firstClose);
  await firstClose;
});

test('loadConfig parses production DATABASE_URL, PORT, SSL and CORS origins', async () => {
  const { loadConfig } = await import('../config.js');

  const prodConfig = loadConfig({
    NODE_ENV: 'production',
    PORT: '10000',
    DATABASE_URL: 'postgresql://neon_user:secret%40pass@ep-cool-cloud.aws.neon.tech:5432/pricelens_prod?sslmode=require',
    FRONTEND_ORIGIN: 'https://pricelens.onrender.com, https://pricelens.vercel.app/',
    COOKIE_SAME_SITE: 'none',
  });

  assert.equal(prodConfig.nodeEnv, 'production');
  assert.equal(prodConfig.apiPort, 10000);
  assert.equal(prodConfig.database.host, 'ep-cool-cloud.aws.neon.tech');
  assert.equal(prodConfig.database.port, 5432);
  assert.equal(prodConfig.database.name, 'pricelens_prod');
  assert.equal(prodConfig.database.user, 'neon_user');
  assert.equal(prodConfig.database.password, 'secret@pass');
  assert.deepEqual(prodConfig.database.ssl, { rejectUnauthorized: false });
  assert.deepEqual(prodConfig.frontendOrigins, [
    'https://pricelens.onrender.com',
    'https://pricelens.vercel.app',
  ]);
  assert.equal(prodConfig.cookieSameSite, 'none');
});
