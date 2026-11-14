import assert from 'node:assert/strict';
import { test } from 'node:test';

import { config } from '../config.js';
import {
  assertSafeTestDatabaseTarget,
  prepareSeededDatabase,
} from './database.js';

test('database preparation requires explicit confirmation of the configured database', async () => {
  await assert.rejects(
    () => prepareSeededDatabase({
      confirmedDatabaseName: `${config.database.name}_not_confirmed`,
    }),
    /confirmedDatabaseName must exactly match the designated test database/,
  );
});

test('database preparation rejects production, development and the normal application database', () => {
  const safeTarget = {
    nodeEnv: 'test',
    databaseName: 'pricelens_test',
    designatedTestDatabaseName: 'pricelens_test',
    applicationDatabaseName: 'pricelens',
    confirmedDatabaseName: 'pricelens_test',
  };

  assert.doesNotThrow(() => assertSafeTestDatabaseTarget(safeTarget));
  assert.throws(
    () => assertSafeTestDatabaseTarget({ ...safeTarget, nodeEnv: 'production' }),
    /requires NODE_ENV=test/,
  );
  assert.throws(
    () => assertSafeTestDatabaseTarget({ ...safeTarget, nodeEnv: 'development' }),
    /requires NODE_ENV=test/,
  );
  assert.throws(
    () => assertSafeTestDatabaseTarget({
      ...safeTarget,
      databaseName: 'pricelens',
      designatedTestDatabaseName: 'pricelens',
    }),
    /test database must differ from the normal application DB_NAME/,
  );
});
