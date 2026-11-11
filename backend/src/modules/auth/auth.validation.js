import { invalidRequest } from '../../shared/problems.js';
import {
  requireObject,
  requireString,
} from '../../shared/validation.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

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

export function parseRegisterBody(body) {
  const detail = 'Name, email and password are required.';
  const input = requireObject(body, { detail });
  const displayName = requireString(input, 'display_name', { detail });
  const email = requireString(input, 'email', { detail }).toLowerCase();
  const password = requireString(input, 'password', { detail, trim: false });

  if (displayName.length > 120) {
    throw invalidRequest('Name must be 120 characters or fewer.', [
      { field: 'display_name', reason: 'too_long' },
    ]);
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw invalidRequest('Enter a valid email address.', [
      { field: 'email', reason: 'invalid_email' },
    ]);
  }

  if (
    password.length < MIN_PASSWORD_LENGTH
    || Buffer.byteLength(password) > MAX_PASSWORD_BYTES
  ) {
    throw invalidRequest(
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_BYTES} characters.`,
      [{ field: 'password', reason: 'invalid_length' }],
    );
  }

  return { email, password, displayName };
}
