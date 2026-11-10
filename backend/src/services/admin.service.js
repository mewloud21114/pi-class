'use strict';

const db = require('../db/pool');
const AppError = require('../utils/AppError');
const { toPublicUser } = require('./auth.service');

async function listPendingUsers({ level, page, pageSize }) {
  const params = [];
  let where = `u.status = 'PENDING' AND u.role = 'STUDENT'`;
  if (level) {
    params.push(level);
    where += ` AND l.code = $${params.length}`;
  }
  params.push(pageSize, (page - 1) * pageSize);

  const { rows } = await db.query(
    `SELECT u.id, u.phone, u.full_name, u.role, u.status, u.is_active, u.level_id, u.created_at,
            l.code AS level_code, COUNT(*) OVER() AS total
       FROM users u JOIN education_levels l ON l.id = u.level_id
      WHERE ${where}
      ORDER BY u.created_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    items: rows.map(toPublicUser),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/**
 * Moves a student account to `newStatus`, recording an audit entry.
 * Leaving ACTIVE bumps token_version so existing JWTs stop working immediately.
 */
async function changeStatus({ userId, newStatus, adminId, reason }) {
  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    const user = rows[0];
    if (!user || user.role !== 'STUDENT') throw AppError.notFound('USER_NOT_FOUND', 'Student not found');

    if (user.status !== newStatus) {
      await client.query(
        `UPDATE users
            SET status        = $2::account_status,
                activated_at  = CASE WHEN $2::account_status = 'ACTIVE' THEN now() ELSE activated_at END,
                activated_by  = CASE WHEN $2::account_status = 'ACTIVE' THEN $3::uuid ELSE activated_by END,
                token_version = CASE WHEN $2::account_status <> 'ACTIVE' THEN token_version + 1 ELSE token_version END
          WHERE id = $1`,
        [userId, newStatus, adminId],
      );
      await client.query(
        `INSERT INTO account_status_history (user_id, old_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, user.status, newStatus, adminId, reason ?? null],
      );
    }

    const { rows: updated } = await client.query(
      `SELECT u.*, l.code AS level_code
         FROM users u LEFT JOIN education_levels l ON l.id = u.level_id
        WHERE u.id = $1`,
      [userId],
    );
    return { user: toPublicUser(updated[0]), changed: user.status !== newStatus };
  });
}

module.exports = { listPendingUsers, changeStatus };
