import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import express from 'express';

import { errorHandler } from './error-handler.js';
import {
  activeAlertLimitReached,
  authenticationRequired,
  duplicateTrackedUrl,
  internalServerError,
  invalidProductUrl,
  targetPriceNotBelowCurrent,
  targetPriceNotPositive,
  trackedProductNotFound,
  translatePersistenceError,
} from '../shared/problems.js';

async function requestProblem(error, request = {}) {
  const app = express();
  app.use(express.json());
  app.all('/', (incomingRequest, response, next) => next(error));
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, request);
    return {
      response,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertProblem(result, expected) {
  assert.equal(result.response.status, expected.status);
  assert.match(
    result.response.headers.get('content-type'),
    /^application\/problem\+json(?:;|$)/,
  );
  assert.equal(result.body.type, expected.type);
  assert.equal(result.body.title, expected.title);
  assert.equal(result.body.status, expected.status);
  assert.equal(result.body.code, expected.code);
  assert.equal(result.body.detail, expected.detail);
}

test('representative shared problems preserve status, code and safe response shape', async (context) => {
  await context.test('401 authentication required', async () => {
    const result = await requestProblem(authenticationRequired());

    assertProblem(result, {
      status: 401,
      type: '/problems/authentication-required',
      title: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      detail: 'Authentication is required',
    });
    assert.equal('errors' in result.body, false);
  });

  await context.test('404 missing and unowned resources use the same response', async () => {
    const missing = await requestProblem(trackedProductNotFound());
    const unowned = await requestProblem(trackedProductNotFound());

    assert.deepEqual(unowned.body, missing.body);
    assertProblem(missing, {
      status: 404,
      type: '/problems/tracked-product-not-found',
      title: 'Tracked product not found',
      code: 'TRACKED_PRODUCT_NOT_FOUND',
      detail: 'Tracked product not found',
    });
  });

  await context.test('409 known PostgreSQL uniqueness conflict is translated', async () => {
    const persistenceError = {
      code: '23505',
      constraint: 'uq_tracked_products_user_source_url',
      detail: 'raw PostgreSQL detail must not be returned',
    };
    const result = await requestProblem(translatePersistenceError(persistenceError));

    assertProblem(result, {
      status: 409,
      type: '/problems/duplicate-tracked-url',
      title: 'Duplicate tracked product',
      code: 'DUPLICATE_TRACKED_URL',
      detail: 'This product URL is already being tracked',
    });
    assert.doesNotMatch(JSON.stringify(result.body), /PostgreSQL|constraint/i);
  });

  await context.test('422 semantic validation includes field details', async () => {
    const result = await requestProblem(invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]));

    assertProblem(result, {
      status: 422,
      type: '/problems/invalid-product-url',
      title: 'Invalid product URL',
      code: 'INVALID_PRODUCT_URL',
      detail: 'Unsupported or invalid product URL',
    });
    assert.deepEqual(result.body.errors, [
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  });
});

test('malformed JSON produces a 400 problem with a field error', async () => {
  const app = express();
  app.use(express.json());
  app.post('/', (request, response) => response.json({ data: request.body }));
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    const body = await response.json();

    assertProblem({ response, body }, {
      status: 400,
      type: '/problems/invalid-request',
      title: 'Invalid request',
      code: 'INVALID_REQUEST',
      detail: 'The request body must contain valid JSON.',
    });
    assert.deepEqual(body.errors, [{ field: 'body', reason: 'invalid_json' }]);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('unexpected and unknown persistence errors produce a safe 500 problem', async () => {
  const sentinel = 'INTERNAL_SENTINEL_SHOULD_NOT_LEAK';
  const originalConsoleError = console.error;
  const logCalls = [];
  console.error = (...arguments_) => logCalls.push(arguments_);

  try {
    const rawResult = await requestProblem(new Error(sentinel));
    const persistenceResult = await requestProblem(translatePersistenceError({
      code: 'XX999',
      detail: sentinel,
    }));

    for (const result of [rawResult, persistenceResult]) {
      assertProblem(result, {
        status: 500,
        type: '/problems/internal-server-error',
        title: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        detail: 'An unexpected server failure occurred.',
      });
      assert.doesNotMatch(JSON.stringify(result.body), new RegExp(sentinel));
      assert.equal('stack' in result.body, false);
    }

    assert.equal(logCalls.length, 2);
  } finally {
    console.error = originalConsoleError;
  }
});

test('exact M1 failure wording remains protected by shared factories', () => {
  assert.equal(
    duplicateTrackedUrl().detail,
    'This product URL is already being tracked',
  );
  assert.equal(
    activeAlertLimitReached().detail,
    'Maximum 20 active alerts reached',
  );
  assert.equal(
    invalidProductUrl().detail,
    'Unsupported or invalid product URL',
  );
  assert.equal(
    targetPriceNotPositive().detail,
    'Target price must be greater than 0',
  );
  assert.equal(
    targetPriceNotBelowCurrent().detail,
    'Target price must be lower than the current price',
  );
  assert.equal(
    internalServerError(new Error('private')).detail,
    'An unexpected server failure occurred.',
  );
});
