import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import cookieParser from 'cookie-parser';
import express from 'express';

import { errorHandler } from './error-handler.js';
import {
  createAuthenticate,
  SESSION_COOKIE_NAME,
} from './authenticate.js';

async function requestThrough(authentication, options = {}) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post('/', authentication, (request, response) => {
    response.status(200).json({
      data: request.user,
      submitted_user_id: request.body.user_id,
    });
  });
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.token
          ? { cookie: `${SESSION_COOKIE_NAME}=${options.token}` }
          : {}),
      },
      body: JSON.stringify({ user_id: options.submittedUserId ?? '999' }),
    });

    return { response, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertAuthenticationRequired(result) {
  assert.equal(result.response.status, 401);
  assert.match(
    result.response.headers.get('content-type'),
    /^application\/problem\+json(?:;|$)/,
  );
  assert.equal(result.body.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(result.body.detail, 'Authentication is required');
}

test('protected requests require a valid session cookie', async (context) => {
  const authentication = createAuthenticate({
    findUser: async () => {
      throw new Error('lookup must not run without a cookie');
    },
  });

  assertAuthenticationRequired(await requestThrough(authentication));

  for (const token of ['unknown', 'expired', 'revoked']) {
    await context.test(`${token} session`, async () => {
      const result = await requestThrough(createAuthenticate({
        findUser: async () => null,
      }), { token });

      assertAuthenticationRequired(result);
    });
  }
});

test('valid authentication exposes only trusted public user context', async () => {
  const resolvedTokens = [];
  const authentication = createAuthenticate({
    findUser: async (token) => {
      resolvedTokens.push(token);
      return {
        user_id: '42',
        email: 'owner@example.test',
        display_name: 'Owner',
        password_hash: 'must-not-be-exposed',
        account_status: 'ACTIVE',
      };
    },
  });

  const result = await requestThrough(authentication, {
    token: 'valid',
    submittedUserId: '999',
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(resolvedTokens, ['valid']);
  assert.deepEqual(result.body.data, {
    user_id: '42',
    email: 'owner@example.test',
    display_name: 'Owner',
  });
  assert.equal(result.body.submitted_user_id, '999');
  assert.notEqual(result.body.data.user_id, result.body.submitted_user_id);
});

test('session lookup failures surface as safe server errors', async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const result = await requestThrough(createAuthenticate({
      findUser: async () => {
        throw new Error('private database detail');
      },
    }), { token: 'valid' });

    assert.equal(result.response.status, 500);
    assert.doesNotMatch(JSON.stringify(result.body), /private database detail/);
  } finally {
    console.error = originalConsoleError;
  }
});
