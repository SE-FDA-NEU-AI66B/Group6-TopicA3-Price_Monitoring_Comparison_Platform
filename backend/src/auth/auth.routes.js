import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

import { config } from '../config.js';
import {
  authenticate,
  SESSION_COOKIE_NAME,
} from '../middleware/authenticate.js';
import {
  invalidCredentials,
  invalidRequest,
} from '../middleware/error-handler.js';
import { findUserByEmail } from './auth.repository.js';

export const SESSION_DURATION_SECONDS = 60 * 60;

const jwtSecret = new TextEncoder().encode(config.jwtSecret);
const router = Router();

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

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body ?? {};

    if (
      typeof email !== 'string'
      || email.trim() === ''
      || typeof password !== 'string'
      || password === ''
    ) {
      throw invalidRequest('Email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    const passwordMatches = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !passwordMatches || user.account_status !== 'ACTIVE') {
      throw invalidCredentials();
    }

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.user_id))
      .setIssuer('pricelens')
      .setAudience('pricelens-web')
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(jwtSecret);

    response
      .cookie(SESSION_COOKIE_NAME, token, {
        ...cookieOptions(),
        maxAge: SESSION_DURATION_SECONDS * 1000,
      })
      .status(200)
      .json({ data: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/session', authenticate, (request, response) => {
  response.status(200).json({ data: publicUser(request.user) });
});

router.post('/logout', (request, response) => {
  response.clearCookie(SESSION_COOKIE_NAME, cookieOptions()).status(204).end();
});

export { router as authRouter };
