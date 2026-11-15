import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { errorHandler } from '../backend/src/middleware/error-handler.js';
import {
  createOperationalMonitor,
  createRequestLogger,
  redactSensitiveFields,
  sanitizeLogPath,
  sanitizeLogText,
} from '../backend/src/middleware/request-logger.js';

function verifyMonitoringAndSafeLogging() {
  const monitor = createOperationalMonitor();
  const capturedLogs = [];
  let simulatedNow = 1000;

  const loggerMiddleware = createRequestLogger({
    monitor,
    slowThresholdMs: 400,
    nowFn: () => simulatedNow,
    logger: {
      error: (message, entry) => capturedLogs.push({ level: 'error', message, entry }),
      warn: (message, entry) => capturedLogs.push({ level: 'warn', message, entry }),
    },
  });

  function runSimulatedRequest(method, originalUrl, statusCode, durationMs) {
    const req = { method, originalUrl };
    const res = new EventEmitter();
    res.statusCode = statusCode;
    loggerMiddleware(req, res, () => {});
    simulatedNow += durationMs;
    res.emit('finish');
  }

  runSimulatedRequest('GET', '/health', 200, 12);
  runSimulatedRequest('GET', '/api/watchlist?token=secret-session-token', 200, 48);
  runSimulatedRequest('POST', '/api/auth/login?password=SecretPass123', 401, 450);
  runSimulatedRequest('GET', '/api/tracked-products/1/price-history', 503, 90);

  const metrics = monitor.snapshot();
  assert.equal(metrics.total_requests, 4);
  assert.equal(metrics.client_errors, 1);
  assert.equal(metrics.server_errors, 1);
  assert.equal(metrics.error_rate, 0.5);
  assert.equal(metrics.server_error_rate, 0.25);
  assert.equal(metrics.max_duration_ms, 450);
  console.log('✔ Verified API response-time and error-rate monitoring metrics');

  const redacted = redactSensitiveFields({
    password: 'SecretPass123',
    token: 'jwt-secret-token',
    cookie: 'pricelens_session=raw-cookie',
    authorization: 'Bearer raw-bearer-token',
    database_url: 'postgres://pricelens_admin:dbpass123@db.internal:5432/pricelens',
    email: 'demo@pricelens.local',
    path: sanitizeLogPath('/api/auth/login?password=SecretPass123'),
    detail: sanitizeLogText(
      'Database failure on postgres://pricelens_admin:dbpass123@db.internal:5432/pricelens for demo@pricelens.local',
    ),
  });

  const serialized = JSON.stringify({ capturedLogs, redacted });
  assert.doesNotMatch(serialized, /SecretPass123|jwt-secret-token|raw-cookie|raw-bearer-token|dbpass123|demo@pricelens\.local/);
  console.log('✔ Verified safe logging redaction (passwords, tokens, cookies, DB credentials, and PII excluded)');

  const originalConsoleError = console.error;
  const errorEntries = [];
  console.error = (label, payload) => errorEntries.push({ label, payload });

  try {
    const fakeReq = {
      method: 'POST',
      originalUrl: '/api/auth/login?password=LeakedPassword999&email=demo@pricelens.local',
      headersSent: false,
    };
    const fakeRes = {
      headersSent: false,
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      type() {
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    errorHandler(
      new Error('connect ECONNREFUSED postgres://admin:SuperSecretDbPass@localhost:5432/pricelens for demo@pricelens.local'),
      fakeReq,
      fakeRes,
      () => {},
    );

    assert.equal(fakeRes.statusCode, 500);
    assert.equal(errorEntries.length, 1);
    assert.equal(errorEntries[0].payload.path, '/api/auth/login');
    assert.doesNotMatch(JSON.stringify(errorEntries), /LeakedPassword999|SuperSecretDbPass|demo@pricelens\.local/);
  } finally {
    console.error = originalConsoleError;
  }
  console.log('✔ Verified errorHandler sanitizes request paths and redacts sensitive error details');
}

function verifyRollbackTargetHistory() {
  const currentHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const previousCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD~1'], {
    encoding: 'utf8',
  }).trim();

  assert.match(currentHead, /^[0-9a-f]{7,}$/i);
  assert.match(previousCommit, /^[0-9a-f]{7,}$/i);
  assert.notEqual(currentHead, previousCommit);
  console.log(
    `✔ Verified deployment rollback target resolution (current HEAD: ${currentHead} -> previous stable commit: ${previousCommit})`,
  );
}

verifyMonitoringAndSafeLogging();
verifyRollbackTargetHistory();
