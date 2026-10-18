import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

import { config } from '../../config.js';
import { invalidCredentials } from '../../shared/problems.js';
import { findUserByEmail } from './auth.repository.js';

export const SESSION_DURATION_SECONDS = 60 * 60;

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

// Verifies credentials and issues the session JWT. Unknown account, wrong
// password and non-active account all produce the same error.
export async function login({ email, password }) {
  const user = await findUserByEmail(email);
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

  return { user, token };
}
