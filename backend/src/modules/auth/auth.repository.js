import { query } from '../../db/pool.js';

export async function findUserByEmail(email) {
  const result = await query(
    `SELECT
       user_id,
       email,
       display_name,
       password_hash,
       account_status
     FROM users
     WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function insertUser(
  { email, passwordHash, displayName },
  executeQuery = query,
) {
  const result = await executeQuery(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING user_id, email, display_name`,
    [email, passwordHash, displayName],
  );

  return result.rows[0];
}

export async function insertSession(
  { userId, tokenHash, durationSeconds },
  executeQuery = query,
) {
  await executeQuery(
    `DELETE FROM user_sessions
     WHERE user_id = $1
       AND expires_at <= CURRENT_TIMESTAMP`,
    [userId],
  );
  await executeQuery(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + make_interval(secs => $3))`,
    [userId, tokenHash, durationSeconds],
  );
}

export async function findActiveUserBySessionTokenHash(tokenHash) {
  const result = await query(
    `SELECT
       u.user_id,
       u.email,
       u.display_name
     FROM user_sessions AS s
     JOIN users AS u ON u.user_id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.account_status = 'ACTIVE'`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function deleteSessionByTokenHash(tokenHash) {
  await query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
}
