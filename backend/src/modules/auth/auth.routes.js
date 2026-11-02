import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { config } from '../../config.js';
import {
  authenticate,
  SESSION_COOKIE_NAME,
} from '../../middleware/authenticate.js';
import { tooManyRequests } from '../../shared/problems.js';
import { parseLoginBody, parseRegisterBody } from './auth.validation.js';
import {
  login,
  logout,
  register,
  SESSION_DURATION_SECONDS,
} from './auth.service.js';

const router = Router();

// Each client address and email gets its own 5-minute window, so a shared
// network address or a failing registration never blocks another shopper.
function createCredentialAttemptLimit() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (request) => {
      const email = typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : '';

      return `${request.ip}|${email}`;
    },
    handler: (request, response, next) => next(tooManyRequests()),
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  };
}

function publicUser(user) {
  return {
    user_id: String(user.user_id),
    email: user.email,
    display_name: user.display_name,
  };
}

function sendSession(response, status, { user, token }) {
  response
    .cookie(SESSION_COOKIE_NAME, token, {
      ...cookieOptions(),
      maxAge: SESSION_DURATION_SECONDS * 1000,
    })
    .status(status)
    .json({ data: publicUser(user) });
}

router.post('/login', createCredentialAttemptLimit(), async (request, response, next) => {
  try {
    sendSession(response, 200, await login(parseLoginBody(request.body)));
  } catch (error) {
    next(error);
  }
});

router.post('/register', createCredentialAttemptLimit(), async (request, response, next) => {
  try {
    sendSession(response, 201, await register(parseRegisterBody(request.body)));
  } catch (error) {
    next(error);
  }
});

router.get('/session', authenticate, (request, response) => {
  response.status(200).json({ data: publicUser(request.user) });
});

router.post('/logout', async (request, response, next) => {
  try {
    await logout(request.cookies?.[SESSION_COOKIE_NAME]);
    response.clearCookie(SESSION_COOKIE_NAME, cookieOptions()).status(204).end();
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
