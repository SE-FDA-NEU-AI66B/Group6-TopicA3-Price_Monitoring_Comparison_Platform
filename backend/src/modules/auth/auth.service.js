import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { query, withTransaction } from '../../db/pool.js';
import { invalidCredentials } from '../../shared/problems.js';
import {
  deleteSessionByTokenHash,
  findActiveUserBySessionTokenHash,
  findUserByEmail,
  insertSession,
  insertUser,
} from './auth.repository.js';

export const SESSION_DURATION_SECONDS = 24 * 60 * 60;

const PASSWORD_HASH_COST = 12;
// Compared when no account matches, so unknown emails take as long as wrong passwords.
const UNKNOWN_ACCOUNT_PASSWORD_HASH = '$2b$12$VWGcBV3orCzh6GHMqDgmCO7pJ1VgC19cv0zBekDrMJULaLkF4BK2y';

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function startSession(userId, executeQuery = query) {
  const token = randomBytes(32).toString('base64url');

  await insertSession({
    userId,
    tokenHash: hashSessionToken(token),
    durationSeconds: SESSION_DURATION_SECONDS,
  }, executeQuery);

  return token;
}

// Unknown account, wrong password and non-active account all produce the same error.
export async function login({ email, password }) {
  const user = await findUserByEmail(email);
  const passwordMatches = await bcrypt.compare(
    password,
    user?.password_hash ?? UNKNOWN_ACCOUNT_PASSWORD_HASH,
  );

  if (!user || !passwordMatches || user.account_status !== 'ACTIVE') {
    throw invalidCredentials();
  }

  return { user, token: await startSession(user.user_id) };
}

export async function register({ email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_COST);

  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const user = await insertUser({ email, passwordHash, displayName }, executeQuery);

    return { user, token: await startSession(user.user_id, executeQuery) };
  });
}

export async function findSessionUser(token) {
  return findActiveUserBySessionTokenHash(hashSessionToken(token));
}

export async function logout(token) {
  if (token) {
    await deleteSessionByTokenHash(hashSessionToken(token));
  }
}
