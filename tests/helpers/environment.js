// Loaded with `node --import` before any test file. It sets every variable the
// backend configuration requires, so the suite needs no `.env` file. The
// database host is unresolvable on purpose: a query that escapes the fake
// database fails instead of reaching a real PostgreSQL server.
Object.assign(process.env, {
  NODE_ENV: 'test',
  API_PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:4173',
  DB_HOST: 'fake-database.invalid',
  DB_PORT: '5432',
  DB_NAME: 'pricelens_test',
  DB_USER: 'pricelens_test',
  DB_PASSWORD: 'not-used-by-the-tests',
  EMAIL_TRANSPORT: 'jsonl',
});
