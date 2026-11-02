import { pool } from '../../backend/src/db/pool.js';

// Operators a fake can read from SQL text and evaluate, so a test notices when
// the service changes `<` to `<=` in a query.
export const COMPARISONS = Object.freeze({
  '<': (left, right) => left < right,
  '<=': (left, right) => left <= right,
  '>': (left, right) => left > right,
  '>=': (left, right) => left >= right,
});

// A stand-in for a pg client. `answer(sql, parameters)` returns the rows for a
// statement, or undefined when the statement is not expected; transaction
// statements are answered here. Every statement is recorded in `statements`.
export function createFakeDatabaseClient(answer) {
  const statements = [];

  return {
    statements,
    async query(text, parameters = []) {
      const sql = text.trim();
      statements.push({ sql, parameters });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };

      const rows = answer(sql, parameters);
      if (rows === undefined) {
        throw new Error(`Unexpected SQL in fake database client: ${sql}`);
      }
      return { rows };
    },
    release() {},
  };
}

// Routes pool.query and pool.connect to `client` for the duration of one test.
export function useFakeDatabase(t, client) {
  t.mock.method(pool, 'connect', async () => client);
  t.mock.method(pool, 'query', (text, parameters) => client.query(text, parameters));
  return client;
}
