import { invalidRequest } from '../../middleware/error-handler.js';

// Request-shape checks only. Throw through the shared error handling.
export function parseLoginBody(body) {
  const { email, password } = body ?? {};

  if (
    typeof email !== 'string'
    || email.trim() === ''
    || typeof password !== 'string'
    || password === ''
  ) {
    throw invalidRequest('Email and password are required.');
  }

  return { email: email.trim().toLowerCase(), password };
}
