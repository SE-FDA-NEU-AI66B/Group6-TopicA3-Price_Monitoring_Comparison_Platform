import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import cookieParser from 'cookie-parser';
import express from 'express';
import { SignJWT } from 'jose';

import { config } from '../config.js';
import { errorHandler } from './error-handler.js';
import {
  createAuthenticate,
  SESSION_COOKIE_NAME,
  verifySessionToken,
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
    verifyToken: async () => {
      throw new Error('verification must not run without a cookie');
    },
    findUser: async () => {
      throw new Error('lookup must not run without a cookie');
    },
  });

  assertAuthenticationRequired(await requestThrough(authentication));

  for (const token of ['invalid', 'expired', 'malformed']) {
    await context.test(`${token} session`, async () => {
      const result = await requestThrough(createAuthenticate({
        verifyToken: async () => {
          throw new Error(`private ${token} token detail`);
        },
      }), { token });

      assertAuthenticationRequired(result);
      assert.doesNotMatch(JSON.stringify(result.body), /private|token detail/i);
    });
  }
});

test('valid authentication exposes only trusted public user context', async () => {
  const resolvedIds = [];
  const authentication = createAuthenticate({
    verifyToken: async () => '42',
    findUser: async (userId) => {
      resolvedIds.push(userId);
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
  assert.deepEqual(resolvedIds, ['42']);
  assert.deepEqual(result.body.data, {
    user_id: '42',
    email: 'owner@example.test',
    display_name: 'Owner',
  });
  assert.equal(result.body.submitted_user_id, '999');
  assert.notEqual(result.body.data.user_id, result.body.submitted_user_id);
});

test('missing or inactive database users remain unauthenticated', async () => {
  const result = await requestThrough(createAuthenticate({
    verifyToken: async () => '42',
    findUser: async () => null,
  }), { token: 'validly-signed' });

  assertAuthenticationRequired(result);
});

test('session verification enforces signature, issuer, audience and expiry', async () => {
  const now = Math.floor(Date.now() / 1000);
  const secret = new TextEncoder().encode(config.jwtSecret);
  const validToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('123')
    .setIssuer('pricelens')
    .setAudience('pricelens-web')
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(secret);
  const expiredToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('123')
    .setIssuer('pricelens')
    .setAudience('pricelens-web')
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(secret);
  const wrongSecretToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('123')
    .setIssuer('pricelens')
    .setAudience('pricelens-web')
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode('not-the-pricelens-secret'));

  assert.equal(await verifySessionToken(validToken), '123');
  await assert.rejects(() => verifySessionToken(wrongSecretToken));
  await assert.rejects(() => verifySessionToken(expiredToken));
  await assert.rejects(() => verifySessionToken('not-a-jwt'));
});
