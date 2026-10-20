import pg from 'pg';

import { config } from '../config.js';
import {
  HttpError,
  translatePersistenceError,
} from '../shared/problems.js';

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

function asApplicationError(error) {
  return error instanceof HttpError ? error : translatePersistenceError(error);
}

export async function query(text, parameters) {
  try {
    return await pool.query(text, parameters);
  } catch (error) {
    throw asApplicationError(error);
  }
}

export async function withClient(operation, database = pool) {
  let client;

  try {
    client = await database.connect();
  } catch (error) {
    throw asApplicationError(error);
  }

  try {
    return await operation(client);
  } catch (error) {
    throw asApplicationError(error);
  } finally {
    client.release();
  }
}

export async function withTransaction(operation, database = pool) {
  let client;

  try {
    client = await database.connect();
  } catch (error) {
    throw asApplicationError(error);
  }

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to roll back PostgreSQL transaction', {
        name: rollbackError.name,
        code: rollbackError.code,
        message: rollbackError.message,
      });
    }

    throw asApplicationError(error);
  } finally {
    client.release();
  }
}

export function closePool() {
  closePromise ??= pool.end();
  return closePromise;
}
