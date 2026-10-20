import { jwtVerify } from 'jose';

import { findActiveUserById } from '../modules/auth/auth.repository.js';
import { config } from '../config.js';
import { authenticationRequired } from '../shared/problems.js';
import { parseIdentifier } from '../shared/validation.js';

export const SESSION_COOKIE_NAME = 'pricelens_session';

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, jwtSecret, {
    issuer: 'pricelens',
    audience: 'pricelens-web',
    algorithms: ['HS256'],
  });

  return parseIdentifier(payload.sub, 'user_id');
}

function authenticatedUserContext(user) {
  return Object.freeze({
    user_id: String(user.user_id),
    email: user.email,
    display_name: user.display_name,
  });
}

export function createAuthenticate({
  verifyToken = verifySessionToken,
  findUser = findActiveUserById,
} = {}) {
  return async function authenticateRequest(request, response, next) {
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      next(authenticationRequired());
      return;
    }

    let userId;

    try {
      userId = await verifyToken(token);
    } catch {
      next(authenticationRequired());
      return;
    }

    try {
      const user = await findUser(userId);

      if (!user) {
        next(authenticationRequired());
        return;
      }

      request.user = authenticatedUserContext(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate();
