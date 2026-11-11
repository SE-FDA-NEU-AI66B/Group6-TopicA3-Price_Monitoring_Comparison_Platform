import { findSessionUser } from '../modules/auth/auth.service.js';
import { authenticationRequired } from '../shared/problems.js';

export const SESSION_COOKIE_NAME = 'pricelens_session';

function authenticatedUserContext(user) {
  return Object.freeze({
    user_id: String(user.user_id),
    email: user.email,
    display_name: user.display_name,
  });
}

export function createAuthenticate({ findUser = findSessionUser } = {}) {
  return async function authenticateRequest(request, response, next) {
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      next(authenticationRequired());
      return;
    }

    try {
      const user = await findUser(token);

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
