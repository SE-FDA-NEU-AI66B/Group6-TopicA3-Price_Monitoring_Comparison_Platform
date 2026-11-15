import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

import {
  createOperationalMonitor,
  createRequestLogger,
  redactSensitiveFields,
  sanitizeLogPath,
  sanitizeLogText,
} from './request-logger.js';

test('sanitizeLogPath strips query parameters and preserves route paths safely', () => {
  assert.equal(
    sanitizeLogPath('/api/auth/login?email=demo@pricelens.local&password=secret'),
    '/api/auth/login',
  );
  assert.equal(sanitizeLogPath('/health'), '/health');
  assert.equal(sanitizeLogPath(''), '/');
});

test('sanitizeLogText and redactSensitiveFields scrub credentials, tokens, database URIs and PII', () => {
  const rawMessage =
    'Connection failed for postgres://pricelens_user:MySecretPass123@db.example.internal:5432/pricelens '
    + 'by shopper@example.com with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret and password=PlainTextPassword';

  const sanitizedMessage = sanitizeLogText(rawMessage);
  assert.doesNotMatch(sanitizedMessage, /MySecretPass123/);
  assert.doesNotMatch(sanitizedMessage, /postgres:\/\//);
  assert.doesNotMatch(sanitizedMessage, /shopper@example\.com/);
  assert.doesNotMatch(sanitizedMessage, /eyJhbGciOiJIUzI1NiJ9\.secret/);
  assert.doesNotMatch(sanitizedMessage, /PlainTextPassword/);
  assert.match(sanitizedMessage, /\[REDACTED_DATABASE_URI\]/);
  assert.match(sanitizedMessage, /\[REDACTED_EMAIL\]/);

  const redactedObject = redactSensitiveFields({
    method: 'POST',
    path: '/api/auth/login',
    password: 'demo-password-123',
    password_hash: '$2b$12$hashvalue',
    token: 'session-token-xyz',
    cookie: 'pricelens_session=abc123',
    authorization: 'Bearer secret-jwt',
    database_url: 'postgresql://admin:topsecret@localhost:5432/pricelens',
    email: 'demo@pricelens.local',
    nested: {
      refresh_token: 'refresh-secret',
      detail: 'User demo@pricelens.local failed login',
    },
  });

  assert.equal(redactedObject.password, '[REDACTED]');
  assert.equal(redactedObject.password_hash, '[REDACTED]');
  assert.equal(redactedObject.token, '[REDACTED]');
  assert.equal(redactedObject.cookie, '[REDACTED]');
  assert.equal(redactedObject.authorization, '[REDACTED]');
  assert.equal(redactedObject.database_url, '[REDACTED]');
  assert.equal(redactedObject.email, '[REDACTED]');
  assert.equal(redactedObject.nested.refresh_token, '[REDACTED]');
  assert.equal(redactedObject.nested.detail, 'User [REDACTED_EMAIL] failed login');
});

test('createOperationalMonitor and createRequestLogger track error rate and response time safely', () => {
  const monitor = createOperationalMonitor();
  const errorLogs = [];
  const warnLogs = [];
  let currentClock = 100;

  const middleware = createRequestLogger({
    monitor,
    slowThresholdMs: 500,
    nowFn: () => currentClock,
    logger: {
      error: (msg, payload) => errorLogs.push({ msg, payload }),
      warn: (msg, payload) => warnLogs.push({ msg, payload }),
    },
  });

  function simulateRequest({ method, originalUrl, statusCode, elapsedMs }) {
    const request = { method, originalUrl };
    const response = new EventEmitter();
    response.statusCode = statusCode;

    let nextCalled = false;
    middleware(request, response, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);

    currentClock += elapsedMs;
    response.emit('finish');
  }

  simulateRequest({
    method: 'GET',
    originalUrl: '/api/watchlist?token=secret-query-token',
    statusCode: 200,
    elapsedMs: 45,
  });
  simulateRequest({
    method: 'POST',
    originalUrl: '/api/auth/login?password=leaked',
    statusCode: 401,
    elapsedMs: 620,
  });
  simulateRequest({
    method: 'GET',
    originalUrl: '/api/tracked-products/1/price-history?email=demo@pricelens.local',
    statusCode: 500,
    elapsedMs: 135,
  });

  const snapshot = monitor.snapshot();
  assert.equal(snapshot.total_requests, 3);
  assert.equal(snapshot.client_errors, 1);
  assert.equal(snapshot.server_errors, 1);
  assert.equal(snapshot.error_rate, 0.6667);
  assert.equal(snapshot.server_error_rate, 0.3333);
  assert.equal(snapshot.last_duration_ms, 135);
  assert.equal(snapshot.max_duration_ms, 620);
  assert.equal(snapshot.avg_duration_ms, 266.67);

  assert.equal(warnLogs.length, 1);
  assert.deepEqual(warnLogs[0].payload, {
    method: 'POST',
    path: '/api/auth/login',
    status: 401,
    duration_ms: 620,
  });

  assert.equal(errorLogs.length, 1);
  assert.deepEqual(errorLogs[0].payload, {
    method: 'GET',
    path: '/api/tracked-products/1/price-history',
    status: 500,
    duration_ms: 135,
  });

  const serializedLogs = JSON.stringify({ warnLogs, errorLogs });
  assert.doesNotMatch(serializedLogs, /secret-query-token|leaked|demo@pricelens\.local/);
});
