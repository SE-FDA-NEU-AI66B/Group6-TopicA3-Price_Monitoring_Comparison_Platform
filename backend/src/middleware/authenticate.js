import { jwtVerify } from 'jose';

import { findActiveUserById } from '../auth/auth.repository.js';
import { config } from '../config.js';
import { authenticationRequired } from './error-handler.js';

export const SESSION_COOKIE_NAME = 'pricelens_session';

const jwtSecret = new TextEncoder().encode(config.jwtSecret);
const DECIMAL_ID = /^[1-9]\d*$/;

export async function authenticate(request, response, next) {
  const token = request.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    next(authenticationRequired());
    return;
  }

  let payload;

  try {
    ({ payload } = await jwtVerify(token, jwtSecret, {
      issuer: 'pricelens',
      audience: 'pricelens-web',
      algorithms: ['HS256'],
    }));

    if (typeof payload.sub !== 'string' || !DECIMAL_ID.test(payload.sub)) {
      throw new Error('JWT subject is invalid');
    }
  } catch {
    next(authenticationRequired());
    return;
  }

  try {
    const user = await findActiveUserById(payload.sub);

    if (!user) {
      next(authenticationRequired());
      return;
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
