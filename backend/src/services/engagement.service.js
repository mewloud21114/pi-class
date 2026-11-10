'use strict';

const db = require('../db/pool');
const AppError = require('../utils/AppError');

/**
 * Students can only interact with published courses of their own level; admins with any course.
 * Returns the course row so callers don't query it twice.
 */
async function loadAccessibleCourse(user, courseId) {
  const { rows } = await db.query('SELECT id, level_id, is_published FROM courses WHERE id = $1', [courseId]);
  const course = rows[0];
  const visible = course && (user.role === 'ADMIN' || (course.is_published && course.level_id === user.levelId));
  if (!visible) throw AppError.notFound('COURSE_NOT_FOUND', 'Content not found');
  return course;
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------
async function likeCount(courseId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM course_likes WHERE course_id = $1', [courseId]);
  return rows[0].n;
}

async function setLike(user, courseId, liked) {
  await loadAccessibleCourse(user, courseId);
  if (liked) {
    await db.query('INSERT INTO course_likes (course_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, user.id]);
  } else {
    await db.query('DELETE FROM course_likes WHERE course_id = $1 AND user_id = $2', [courseId, user.id]);
  }
  return { liked, likeCount: await likeCount(courseId) };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** Other students never see a full phone number: "+222 36 •• •• 56". */
function maskPhone(phone) {
  const d = phone.replace(/^\+222/, '');
  return `+222 ${d.slice(0, 2)} •• •• ${d.slice(-2)}`;
}

function toComment(row, viewer) {
  const isAdminAuthor = row.author_role === 'ADMIN';
  const name = isAdminAuthor ? 'π-class' : row.author_name || maskPhone(row.author_phone);
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      name,
      isAdmin: isAdminAuthor,
      isMe: row.user_id === viewer.id,
      ...(viewer.role === 'ADMIN' && { phone: row.author_phone, level: row.author_level }),
    },
    canDelete: viewer.role === 'ADMIN' || row.user_id === viewer.id,
  };
}

/** Newest first, cursor-paginated on created_at. */
async function listComments(user, courseId, { before, limit }) {
  await loadAccessibleCourse(user, courseId);
  const { rows } = await db.query(
    `SELECT c.id, c.body, c.created_at, c.user_id,
            u.full_name AS author_name, u.phone AS author_phone, u.role AS author_role, l.code AS author_level
       FROM course_comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN education_levels l ON l.id = u.level_id
      WHERE c.course_id = $1 AND c.deleted_at IS NULL AND ($2::timestamptz IS NULL OR c.created_at < $2)
      ORDER BY c.created_at DESC
      LIMIT $3`,
    [courseId, before ?? null, limit + 1],
  );
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => toComment(r, user)),
    nextCursor: rows.length > limit ? page[page.length - 1].created_at : null,
  };
}

async function addComment(user, courseId, body) {
  await loadAccessibleCourse(user, courseId);
  const { rows } = await db.query(
    `WITH c AS (
       INSERT INTO course_comments (course_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at, user_id
     )
     SELECT c.*, u.full_name AS author_name, u.phone AS author_phone, u.role AS author_role, l.code AS author_level
       FROM c JOIN users u ON u.id = c.user_id LEFT JOIN education_levels l ON l.id = u.level_id`,
    [courseId, user.id, body],
  );
  return toComment(rows[0], user);
}

async function deleteComment(user, commentId) {
  const { rows } = await db.query(
    'SELECT c.user_id, c.course_id FROM course_comments c WHERE c.id = $1 AND c.deleted_at IS NULL',
    [commentId],
  );
  const comment = rows[0];
  if (!comment) throw AppError.notFound('COMMENT_NOT_FOUND', 'Comment not found');
  if (user.role !== 'ADMIN' && comment.user_id !== user.id) throw AppError.forbidden();
  await db.query('UPDATE course_comments SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [commentId, user.id]);
}

// ---------------------------------------------------------------------------
// Viewing sessions
// ---------------------------------------------------------------------------

/** Opens a viewing session for a student; admins previewing a course are not counted. */
async function startView(user, courseId) {
  if (user.role !== 'STUDENT') return null;
  const { rows } = await db.query(
    'INSERT INTO course_views (course_id, user_id) VALUES ($1, $2) RETURNING id',
    [courseId, user.id],
  );
  return rows[0].id;
}

/** Progress heartbeat from the player. Only ever moves the furthest position forward. */
async function recordProgress(user, viewId, { positionSeconds, durationSeconds }) {
  const position = durationSeconds ? Math.min(positionSeconds, durationSeconds) : positionSeconds;
  const { rowCount } = await db.query(
    `UPDATE course_views
        SET max_position_seconds = GREATEST(max_position_seconds, $3),
            duration_seconds     = COALESCE($4, duration_seconds),
            last_seen_at         = now()
      WHERE id = $1 AND user_id = $2`,
    [viewId, user.id, Math.floor(position), durationSeconds ? Math.round(durationSeconds) : null],
  );
  if (!rowCount) throw AppError.notFound('VIEW_NOT_FOUND', 'Viewing session not found');
}

module.exports = { setLike, listComments, addComment, deleteComment, startView, recordProgress };
