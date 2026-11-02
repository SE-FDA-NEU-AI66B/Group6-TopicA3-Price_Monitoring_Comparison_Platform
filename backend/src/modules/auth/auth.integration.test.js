import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../../app.js';
import { config } from '../../config.js';
import { closePool, query } from '../../db/pool.js';
import { assertProblemCode } from '../../test-support/assertions.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../../test-support/request.js';
import { withTestServer } from '../../test-support/server.js';

const NEW_ACCOUNT = Object.freeze({
  display_name: 'Registration Check',
  email: 'Registration.Check@Example.test',
  password: 'registration-pass-1',
});

after(() => closePool());

async function deleteAccount(email) {
  await query('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);
}

test('registration creates an account with a revocable database session', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  await deleteAccount(NEW_ACCOUNT.email);

  try {
    await withTestServer(app, async ({ baseUrl }) => {
      for (const [body, detail] of [
        [{ ...NEW_ACCOUNT, email: 'not-an-email' }, 'Enter a valid email address.'],
        [{ ...NEW_ACCOUNT, password: 'short' }, 'Password must be between 8 and 72 characters.'],
        [{ ...NEW_ACCOUNT, display_name: ' ' }, 'Name, email and password are required.'],
      ]) {
        const rejected = await requestJson(baseUrl, '/api/auth/register', {
          method: 'POST',
          json: body,
        });
        assertProblemCode(rejected, 'INVALID_REQUEST', { status: 400, detail });
      }

      const registered = await requestJson(baseUrl, '/api/auth/register', {
        method: 'POST',
        json: NEW_ACCOUNT,
      });
      assert.equal(registered.status, 201);
      assert.equal(registered.body.data.email, NEW_ACCOUNT.email.toLowerCase());
      assert.equal(registered.body.data.display_name, NEW_ACCOUNT.display_name);
      assert.match(registered.headers.get('set-cookie') ?? '', /pricelens_session=[\w-]{43};.*HttpOnly/);

      const duplicate = await requestJson(baseUrl, '/api/auth/register', {
        method: 'POST',
        json: { ...NEW_ACCOUNT, email: NEW_ACCOUNT.email.toUpperCase() },
      });
      assertProblemCode(duplicate, 'EMAIL_ALREADY_REGISTERED', {
        status: 409,
        detail: 'An account with this email address already exists',
      });

      const session = await loginAs(baseUrl, {
        email: NEW_ACCOUNT.email,
        password: NEW_ACCOUNT.password,
      });
      const watchlist = await authenticatedRequest(session, '/api/watchlist');
      assert.equal(watchlist.status, 200);
      assert.equal(watchlist.body.meta.count, 0);

      const stored = await query(
        `SELECT s.token_hash
         FROM user_sessions AS s
         JOIN users AS u ON u.user_id = s.user_id
         WHERE u.email = $1`,
        [NEW_ACCOUNT.email.toLowerCase()],
      );
      const cookieToken = session.cookie.split('=')[1];
      assert.ok(stored.rows.length >= 1);
      assert.ok(stored.rows.every(({ token_hash: hash }) => (
        /^[0-9a-f]{64}$/.test(hash) && hash !== cookieToken
      )));

      await authenticatedRequest(session, '/api/auth/logout', { method: 'POST' });
      assertProblemCode(
        await authenticatedRequest(session, '/api/watchlist'),
        'AUTHENTICATION_REQUIRED',
        { status: 401 },
      );
    });
  } finally {
    await deleteAccount(NEW_ACCOUNT.email);
  }
});

test('repeated failures lock one email on one client, not the whole address', {
  timeout: 90_000,
}, async () => {
  const locked = { email: 'lockout.target@pricelens.test', password: 'wrong-password' };
  const neighbour = { email: 'lockout.other@pricelens.test', password: 'wrong-password' };

  await withTestServer(app, async ({ baseUrl }) => {
    const attempt = (credentials) => requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      json: credentials,
    });

    for (let index = 0; index < 10; index += 1) {
      assert.equal((await attempt(locked)).status, 401, `attempt ${index + 1}`);
    }

    const blocked = await attempt(locked);
    assertProblemCode(blocked, 'TOO_MANY_REQUESTS', {
      status: 429,
      detail: 'Too many attempts. Try again in a few minutes.',
    });

    const retryAfter = Number(blocked.headers.get('retry-after'));
    assert.ok(retryAfter > 0 && retryAfter <= 300, `retry-after was ${retryAfter}`);

    assert.equal((await attempt(neighbour)).status, 401);

    const registration = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      json: { display_name: 'Locked Out', email: locked.email, password: 'another-pass-1' },
    });
    assert.equal(registration.status, 201);
    await deleteAccount(locked.email);
  });
});

test('unknown API routes return the shared problem shape', async () => {
  await withTestServer(app, async ({ baseUrl }) => {
    assertProblemCode(
      await requestJson(baseUrl, '/api/does-not-exist'),
      'ROUTE_NOT_FOUND',
      { status: 404, detail: 'The requested API route does not exist.' },
    );
  });
});
