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

export async function findActiveUserById(userId) {
  const result = await query(
    `SELECT
       user_id,
       email,
       display_name
     FROM users
     WHERE user_id = $1
       AND account_status = 'ACTIVE'`,
    [userId],
  );

  return result.rows[0] ?? null;
}
