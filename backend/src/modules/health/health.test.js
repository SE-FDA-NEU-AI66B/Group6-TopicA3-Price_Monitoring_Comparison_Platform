import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import express from 'express';

import { app } from '../../app.js';
import { closePool } from '../../db/pool.js';
import { requestJson } from '../../test-support/request.js';
import { startTestServer } from '../../test-support/server.js';
import {
  checkSystemHealth,
  createHealthRouter,
} from './health.routes.js';

after(async () => {
  await closePool();
});

test('checkSystemHealth returns 200 when application and database are healthy', async () => {
  const fixedDate = new Date('2026-11-15T08:00:00.000Z');
  const queries = [];

  const result = await checkSystemHealth({
    nowFn: () => fixedDate,
    queryFn: async (sql) => {
      queries.push(sql);
      return { rows: [{ healthy: 1 }] };
    },
  });

  assert.deepEqual(queries, ['SELECT 1 AS healthy']);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    status: 'ok',
    service: 'pricelens-backend',
    checks: {
      application: 'up',
      database: 'up',
    },
    timestamp: '2026-11-15T08:00:00.000Z',
  });
});

test('checkSystemHealth returns 503 without leaking credentials when database fails', async () => {
  const fixedDate = new Date('2026-11-15T08:05:00.000Z');

  const result = await checkSystemHealth({
    nowFn: () => fixedDate,
    queryFn: async () => {
      const error = new Error(
        'connect ECONNREFUSED postgres://pricelens_admin:super-secret-password@db.internal:5432/pricelens',
      );
      error.code = 'ECONNREFUSED';
      throw error;
    },
  });

  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.body, {
    status: 'unhealthy',
    service: 'pricelens-backend',
    checks: {
      application: 'up',
      database: 'down',
    },
    timestamp: '2026-11-15T08:05:00.000Z',
  });

  const serialized = JSON.stringify(result.body);
  assert.doesNotMatch(serialized, /super-secret-password/i);
  assert.doesNotMatch(serialized, /postgres:\/\//i);
  assert.doesNotMatch(serialized, /db\.internal/i);
  assert.doesNotMatch(serialized, /ECONNREFUSED/i);
});

test('checkSystemHealth returns 503 when database returns unexpected payload', async () => {
  const result = await checkSystemHealth({
    queryFn: async () => ({ rows: [] }),
  });

  assert.equal(result.statusCode, 503);
  assert.equal(result.body.status, 'unhealthy');
  assert.equal(result.body.checks.database, 'down');
});

test('GET /health returns 503 HTTP response when database dependency is unavailable', async (t) => {
  const testApp = express();
  testApp.use(
    '/health',
    createHealthRouter({
      queryFn: async () => {
        throw new Error('Database connection lost');
      },
    }),
  );

  const server = await startTestServer(testApp);
  t.after(() => server.close());

  const response = await requestJson(server.baseUrl, '/health');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.body.status, 'unhealthy');
  assert.equal(response.body.checks.application, 'up');
  assert.equal(response.body.checks.database, 'down');
});

test('GET /health and GET /api/health return 200 against the live application and PostgreSQL pool', async (t) => {
  const server = await startTestServer(app);
  t.after(() => server.close());

  for (const path of ['/health', '/api/health']) {
    const response = await requestJson(server.baseUrl, path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.service, 'pricelens-backend');
    assert.deepEqual(response.body.checks, {
      application: 'up',
      database: 'up',
    });
    assert.match(response.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  }
});
