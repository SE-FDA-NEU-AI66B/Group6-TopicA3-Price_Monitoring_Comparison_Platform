import { Router } from 'express';

import { config } from '../../config.js';
import {
  authenticate,
  SESSION_COOKIE_NAME,
} from '../../middleware/authenticate.js';
import { parseLoginBody } from './auth.validation.js';
import { login, SESSION_DURATION_SECONDS } from './auth.service.js';

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
    const credentials = parseLoginBody(request.body);
    const { user, token } = await login(credentials);

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
