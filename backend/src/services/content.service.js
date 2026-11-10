'use strict';

const db = require('../db/pool');
const AppError = require('../utils/AppError');
const { signMediaUrl } = require('../utils/mediaSigner');
const engagement = require('./engagement.service');

async function resolveLevel(levelIdOrCode) {
  const isNumeric = /^\d+$/.test(levelIdOrCode);
  const { rows } = await db.query(
    `SELECT id, code, name_fr, name_ar FROM education_levels
      WHERE ${isNumeric ? 'id = $1::smallint' : 'code = upper($1)'} AND is_active`,
    [levelIdOrCode],
  );
  if (!rows[0]) throw AppError.notFound('LEVEL_NOT_FOUND', 'Education level not found');
  return rows[0];
}

/** Students may only read content of their own level; admins may read any level. */
function assertLevelAccess(user, levelId) {
  if (user.role !== 'ADMIN' && user.levelId !== levelId) {
    throw AppError.forbidden('LEVEL_ACCESS_DENIED', 'This content is not available for your level');
  }
}

async function getLevelContent(user, levelIdOrCode) {
  const level = await resolveLevel(levelIdOrCode);
  assertLevelAccess(user, level.id);

  // Secret storage keys (video_ref, pdf_key, ...) are deliberately never selected here.
  const [courses, exercises, exams] = await Promise.all([
    db.query(
      `SELECT c.id, c.subject, c.chapter, c.title, c.description, c.duration_seconds, c.thumbnail_url, c.sort_order,
              (SELECT COUNT(*)::int FROM course_likes k WHERE k.course_id = c.id) AS like_count,
              (SELECT COUNT(*)::int FROM course_comments m WHERE m.course_id = c.id AND m.deleted_at IS NULL) AS comment_count,
              EXISTS (SELECT 1 FROM course_likes k WHERE k.course_id = c.id AND k.user_id = $2) AS liked_by_me
         FROM courses c
        WHERE c.level_id = $1 AND c.is_published
        ORDER BY c.subject, c.sort_order, c.created_at`,
      [level.id, user.id],
    ),
    db.query(
      `SELECT e.id, e.course_id, e.subject, e.chapter, e.title, e.difficulty, e.sort_order,
              e.correction_pdf_key IS NOT NULL AS has_correction,
              COALESCE(json_agg(json_build_object(
                         'step', s.step_number,
                         'type', s.solution_type,
                         'body', s.body,
                         'hasVideo', s.video_ref IS NOT NULL)
                       ORDER BY s.step_number) FILTER (WHERE s.id IS NOT NULL), '[]') AS solutions
         FROM exercises e
         LEFT JOIN exercise_solutions s ON s.exercise_id = e.id
        WHERE e.level_id = $1 AND e.is_published
        GROUP BY e.id
        ORDER BY e.subject, e.sort_order, e.created_at`,
      [level.id],
    ),
    db.query(
      `SELECT id, exam_type, session, year, subject, title,
              correction_pdf_key IS NOT NULL AS has_correction
         FROM exams
        WHERE level_id = $1 AND is_published
        ORDER BY year DESC, exam_type, session, subject`,
      [level.id],
    ),
  ]);

  // Exams grouped by year (newest first) for the archive screen.
  const examsByYear = [];
  for (const e of exams.rows) {
    let bucket = examsByYear[examsByYear.length - 1];
    if (!bucket || bucket.year !== e.year) examsByYear.push((bucket = { year: e.year, exams: [] }));
    bucket.exams.push({
      id: e.id,
      type: e.exam_type,
      session: e.session,
      subject: e.subject,
      title: e.title,
      hasCorrection: e.has_correction,
    });
  }

  return {
    level: { id: level.id, code: level.code, nameFr: level.name_fr, nameAr: level.name_ar },
    courses: courses.rows.map((c) => ({
      id: c.id,
      subject: c.subject,
      chapter: c.chapter,
      title: c.title,
      description: c.description,
      durationSeconds: c.duration_seconds,
      thumbnailUrl: c.thumbnail_url,
      likeCount: c.like_count,
      commentCount: c.comment_count,
      likedByMe: c.liked_by_me,
    })),
    exercises: exercises.rows.map((e) => ({
      id: e.id,
      courseId: e.course_id,
      subject: e.subject,
      chapter: e.chapter,
      title: e.title,
      difficulty: e.difficulty,
      hasCorrection: e.has_correction,
      solutions: e.solutions,
    })),
    exams: examsByYear,
  };
}

async function findPublished(sql, params, notFoundCode) {
  const { rows } = await db.query(sql, params);
  if (!rows[0]) throw AppError.notFound(notFoundCode, 'Content not found');
  return rows[0];
}

async function getCoursePlayback(user, courseId) {
  const c = await findPublished(
    'SELECT level_id, video_ref FROM courses WHERE id = $1 AND is_published',
    [courseId], 'COURSE_NOT_FOUND',
  );
  assertLevelAccess(user, c.level_id);
  // Each playback request opens a viewing session; the player then reports progress against viewId.
  const viewId = await engagement.startView(user, courseId);
  return { ...(await signMediaUrl(c.video_ref, user.id, { kind: 'video' })), viewId };
}

async function getExercisePdf(user, exerciseId, file = 'paper') {
  const e = await findPublished(
    'SELECT level_id, pdf_key, correction_pdf_key FROM exercises WHERE id = $1 AND is_published',
    [exerciseId], 'EXERCISE_NOT_FOUND',
  );
  assertLevelAccess(user, e.level_id);
  const key = file === 'correction' ? e.correction_pdf_key : e.pdf_key;
  if (!key) throw AppError.notFound('CORRECTION_NOT_AVAILABLE', 'No correction available for this exercise');
  return signMediaUrl(key, user.id);
}

async function getSolutionVideo(user, exerciseId, step) {
  const s = await findPublished(
    `SELECT e.level_id, s.video_ref
       FROM exercise_solutions s JOIN exercises e ON e.id = s.exercise_id
      WHERE e.id = $1 AND s.step_number = $2 AND e.is_published AND s.solution_type = 'VIDEO'`,
    [exerciseId, step], 'SOLUTION_NOT_FOUND',
  );
  assertLevelAccess(user, s.level_id);
  return signMediaUrl(s.video_ref, user.id, { kind: 'video' });
}

async function getExamFile(user, examId, file) {
  const e = await findPublished(
    'SELECT level_id, paper_pdf_key, correction_pdf_key FROM exams WHERE id = $1 AND is_published',
    [examId], 'EXAM_NOT_FOUND',
  );
  assertLevelAccess(user, e.level_id);
  const key = file === 'correction' ? e.correction_pdf_key : e.paper_pdf_key;
  if (!key) throw AppError.notFound('CORRECTION_NOT_AVAILABLE', 'No correction available for this exam');
  return signMediaUrl(key, user.id);
}

module.exports = { getLevelContent, getCoursePlayback, getExercisePdf, getSolutionVideo, getExamFile };
