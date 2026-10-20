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
