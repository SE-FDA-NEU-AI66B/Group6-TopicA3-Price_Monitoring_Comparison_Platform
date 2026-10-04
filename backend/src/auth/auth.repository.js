import { pool } from '../db/pool.js';

const PUBLIC_USER_COLUMNS = `
  user_id,
  email,
  display_name
`;

export async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT
       ${PUBLIC_USER_COLUMNS},
       password_hash,
       account_status
     FROM users
     WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findActiveUserById(userId) {
  const result = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS}
     FROM users
     WHERE user_id = $1
       AND account_status = 'ACTIVE'`,
    [userId],
  );

  return result.rows[0] ?? null;
}
