import {
  requireObject,
  requireString,
} from '../../shared/validation.js';

// Request-shape checks only. Throw through the shared error handling.
export function parseLoginBody(body) {
  const input = requireObject(body, {
    detail: 'Email and password are required.',
  });
  const email = requireString(input, 'email', {
    detail: 'Email and password are required.',
  });
  const password = requireString(input, 'password', {
    detail: 'Email and password are required.',
    trim: false,
  });

  return { email: email.toLowerCase(), password };
}
