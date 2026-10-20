import pg from 'pg';

import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.max,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', {
    name: error.name,
    code: error.code,
    message: error.message,
  });
});

let closePromise;

export function closePool() {
  closePromise ??= pool.end();
  return closePromise;
}
