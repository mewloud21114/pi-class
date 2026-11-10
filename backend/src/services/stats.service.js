'use strict';

const db = require('../db/pool');
const AppError = require('../utils/AppError');

const COMPLETION_THRESHOLD = 0.9;   // a viewer "completed" a course after watching 90% of it

/*
 * Per-course aggregates. A viewer's progress is the furthest point they reached
 * across all their sessions, divided by the video duration (reported by the
 * player, falling back to the duration entered by the admin).
 */
const COURSE_STATS_SQL = `
  WITH per_viewer AS (
    SELECT v.course_id, v.user_id,
           COUNT(*)                    AS views,
           MAX(v.max_position_seconds) AS pos,
           MAX(v.duration_seconds)     AS dur,
           MAX(v.last_seen_at)         AS last_seen
      FROM course_views v
     GROUP BY v.course_id, v.user_id
  ),
  progress AS (
    SELECT pv.*, LEAST(1, pv.pos::numeric / NULLIF(COALESCE(pv.dur, c.duration_seconds), 0)) AS ratio
      FROM per_viewer pv JOIN courses c ON c.id = pv.course_id
  ),
  agg AS (
    SELECT course_id,
           SUM(views)::int                                        AS views,
           COUNT(*)::int                                          AS viewers,
           ROUND(AVG(ratio) * 100)::int                           AS avg_progress_pct,
           (COUNT(*) FILTER (WHERE ratio >= ${COMPLETION_THRESHOLD}))::int AS completions,
           MAX(last_seen)                                         AS last_view_at
      FROM progress GROUP BY course_id
  )
  SELECT c.id, c.title, c.chapter, c.is_published, l.code AS level_code,
         COALESCE(a.views, 0)       AS views,
         COALESCE(a.viewers, 0)     AS viewers,
         a.avg_progress_pct,
         COALESCE(a.completions, 0) AS completions,
         a.last_view_at,
         (SELECT COUNT(*)::int FROM course_likes k WHERE k.course_id = c.id) AS likes,
         (SELECT COUNT(*)::int FROM course_comments m WHERE m.course_id = c.id AND m.deleted_at IS NULL) AS comments
    FROM courses c
    JOIN education_levels l ON l.id = c.level_id
    LEFT JOIN agg a ON a.course_id = c.id`;

function toCourseStats(r) {
  return {
    id: r.id,
    title: r.title,
    chapter: r.chapter,
    isPublished: r.is_published,
    level: r.level_code,
    views: r.views,
    viewers: r.viewers,
    avgProgressPct: r.avg_progress_pct,
    completions: r.completions,
    likes: r.likes,
    comments: r.comments,
    lastViewAt: r.last_view_at,
  };
}

async function overview({ level }) {
  const params = level ? [level] : [];
  const [courses, totals] = await Promise.all([
    db.query(`${COURSE_STATS_SQL} ${level ? 'WHERE l.code = $1' : ''} ORDER BY views DESC, l.sort_order, c.title`, params),
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT' AND status = 'ACTIVE')  AS active_students,
        (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT' AND status = 'PENDING') AS pending_students,
        (SELECT COUNT(*)::int FROM course_views WHERE started_at > now() - interval '7 days') AS views_7d,
        (SELECT COUNT(DISTINCT user_id)::int FROM course_views WHERE started_at > now() - interval '7 days') AS viewers_7d,
        (SELECT COUNT(*)::int FROM course_likes)  AS likes,
        (SELECT COUNT(*)::int FROM course_comments WHERE deleted_at IS NULL) AS comments`),
  ]);
  const t = totals.rows[0];
  return {
    totals: {
      activeStudents: t.active_students,
      pendingStudents: t.pending_students,
      views7d: t.views_7d,
      viewers7d: t.viewers_7d,
      likes: t.likes,
      comments: t.comments,
    },
    courses: courses.rows.map(toCourseStats),
  };
}

async function courseDetail(courseId) {
  const { rows } = await db.query(`${COURSE_STATS_SQL} WHERE c.id = $1`, [courseId]);
  if (!rows[0]) throw AppError.notFound('COURSE_NOT_FOUND', 'Content not found');

  const [daily, viewers] = await Promise.all([
    // Last 14 days, including days without views.
    db.query(
      `SELECT d::date AS day, COUNT(v.id)::int AS views
         FROM generate_series(current_date - 13, current_date, interval '1 day') d
         LEFT JOIN course_views v ON v.course_id = $1 AND v.started_at::date = d::date
        GROUP BY d ORDER BY d`,
      [courseId],
    ),
    db.query(
      `SELECT u.id, u.full_name, u.phone, l.code AS level_code,
              COUNT(*)::int AS views,
              MAX(v.last_seen_at) AS last_seen,
              ROUND(LEAST(1, MAX(v.max_position_seconds)::numeric
                    / NULLIF(COALESCE(MAX(v.duration_seconds), c.duration_seconds), 0)) * 100)::int AS progress_pct,
              (EXISTS (SELECT 1 FROM course_likes k WHERE k.course_id = $1 AND k.user_id = u.id)) AS liked
         FROM course_views v
         JOIN users u ON u.id = v.user_id
         JOIN courses c ON c.id = v.course_id
         LEFT JOIN education_levels l ON l.id = u.level_id
        WHERE v.course_id = $1
        GROUP BY u.id, l.code, c.duration_seconds
        ORDER BY last_seen DESC
        LIMIT 200`,
      [courseId],
    ),
  ]);

  return {
    course: toCourseStats(rows[0]),
    daily: daily.rows.map((d) => ({ day: d.day, views: d.views })),
    viewers: viewers.rows.map((v) => ({
      id: v.id,
      name: v.full_name,
      phone: v.phone,
      level: v.level_code,
      views: v.views,
      progressPct: v.progress_pct,
      liked: v.liked,
      lastSeenAt: v.last_seen,
    })),
  };
}

module.exports = { overview, courseDetail };
