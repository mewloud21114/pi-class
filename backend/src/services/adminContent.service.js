'use strict';

const db = require('../db/pool');
const AppError = require('../utils/AppError');
const { assertObjectExists } = require('./storage.service');

// ---------------------------------------------------------------------------
// Resource definitions: API field -> column, plus how to read one row back.
// ---------------------------------------------------------------------------
const RESOURCES = {
  course: {
    table: 'courses',
    notFound: 'COURSE_NOT_FOUND',
    columns: {
      levelId: 'level_id', subject: 'subject', chapter: 'chapter', title: 'title', description: 'description',
      videoProvider: 'video_provider', videoRef: 'video_ref', durationSeconds: 'duration_seconds',
      thumbnailUrl: 'thumbnail_url', sortOrder: 'sort_order', isPublished: 'is_published',
    },
    orderBy: 't.subject, t.sort_order, t.created_at',
  },
  exercise: {
    table: 'exercises',
    notFound: 'EXERCISE_NOT_FOUND',
    columns: {
      levelId: 'level_id', courseId: 'course_id', subject: 'subject', chapter: 'chapter', title: 'title',
      difficulty: 'difficulty', pdfKey: 'pdf_key', correctionPdfKey: 'correction_pdf_key', sortOrder: 'sort_order', isPublished: 'is_published',
    },
    orderBy: 't.subject, t.sort_order, t.created_at',
    // Solutions are aggregated so a single query returns the full exercise.
    extraSelect: `,
      COALESCE((SELECT json_agg(json_build_object(
                  'step', s.step_number, 'type', s.solution_type, 'body', s.body,
                  'videoProvider', s.video_provider, 'videoRef', s.video_ref) ORDER BY s.step_number)
                FROM exercise_solutions s WHERE s.exercise_id = t.id), '[]') AS solutions`,
  },
  exam: {
    table: 'exams',
    notFound: 'EXAM_NOT_FOUND',
    columns: {
      levelId: 'level_id', examType: 'exam_type', session: 'session', year: 'year', subject: 'subject',
      title: 'title', paperPdfKey: 'paper_pdf_key', correctionPdfKey: 'correction_pdf_key', isPublished: 'is_published',
    },
    orderBy: 't.year DESC, t.exam_type, t.session, t.subject',
  },
};

const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** Admin view: every column (storage keys included), camelCased, with the level code. */
function toAdminView(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'level_code' || k === 'total') continue;
    out[snakeToCamel(k)] = v;
  }
  out.level = { id: row.level_id, code: row.level_code };
  delete out.levelId;
  return out;
}

function selectSql(res, { withTotal = false } = {}) {
  return `SELECT t.*, l.code AS level_code ${withTotal ? ', COUNT(*) OVER() AS total' : ''} ${res.extraSelect || ''}
            FROM ${res.table} t JOIN education_levels l ON l.id = t.level_id`;
}

async function fetchOne(res, id, client = db) {
  const { rows } = await client.query(`${selectSql(res)} WHERE t.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound(res.notFound, 'Content not found');
  return rows[0];
}

/** Picks the provided (non-undefined) fields and maps them to columns. Column names come from RESOURCES only. */
function toColumns(res, data) {
  return Object.entries(res.columns)
    .filter(([field]) => data[field] !== undefined)
    .map(([field, column]) => [column, data[field]]);
}

async function insertRow(client, res, data) {
  const cols = toColumns(res, data);
  cols.push(['created_by', data.createdBy]);
  const { rows } = await client.query(
    `INSERT INTO ${res.table} (${cols.map(([c]) => c).join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id`,
    cols.map(([, v]) => v),
  );
  return rows[0].id;
}

async function updateRow(client, res, id, data) {
  const cols = toColumns(res, data);
  if (!cols.length) return;
  await client.query(
    `UPDATE ${res.table} SET ${cols.map(([c], i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...cols.map(([, v]) => v)],
  );
}

async function resolveLevelId(client, levelCode) {
  const { rows } = await client.query('SELECT id FROM education_levels WHERE code = $1 AND is_active', [levelCode]);
  if (!rows[0]) throw AppError.badRequest('INVALID_LEVEL', 'Unknown or inactive education level');
  return rows[0].id;
}

/** Maps DB constraint violations to client errors instead of 500s. */
function mapDbError(err) {
  if (err.code === '23505') return AppError.conflict('DUPLICATE_CONTENT', 'An item with the same level, type, session, year and subject already exists');
  if (err.code === '23503') return AppError.badRequest('INVALID_REFERENCE', 'A referenced record does not exist');
  return err;
}

const withTx = async (fn) => {
  try {
    return await db.withTransaction(fn);
  } catch (err) {
    throw mapDbError(err);
  }
};

// ---------------------------------------------------------------------------
// Generic list / get / delete
// ---------------------------------------------------------------------------
async function list(kind, { level, subject, published, year, page, pageSize }) {
  const res = RESOURCES[kind];
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (level) add('l.code = ?', level);
  if (subject) add('t.subject = ?', subject);
  if (published !== undefined) add('t.is_published = ?', published);
  if (year !== undefined && kind === 'exam') add('t.year = ?', year);
  params.push(pageSize, (page - 1) * pageSize);

  const { rows } = await db.query(
    `${selectSql(res, { withTotal: true })}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.sort_order, ${res.orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    items: rows.map(toAdminView),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function get(kind, id) {
  return toAdminView(await fetchOne(RESOURCES[kind], id));
}

async function remove(kind, id) {
  const res = RESOURCES[kind];
  const { rowCount } = await db.query(`DELETE FROM ${res.table} WHERE id = $1`, [id]);
  if (!rowCount) throw AppError.notFound(res.notFound, 'Content not found');
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
async function checkCourseVideo(provider, ref) {
  // Only objects in our own bucket can be verified; other providers hold their own video ids.
  if (provider === 'S3') await assertObjectExists(ref, 'videoRef');
}

async function createCourse(adminId, data) {
  await checkCourseVideo(data.videoProvider, data.videoRef);
  return withTx(async (client) => {
    const levelId = await resolveLevelId(client, data.levelCode);
    const id = await insertRow(client, RESOURCES.course, { ...data, levelId, createdBy: adminId });
    return toAdminView(await fetchOne(RESOURCES.course, id, client));
  });
}

async function updateCourse(id, data) {
  return withTx(async (client) => {
    const current = await fetchOne(RESOURCES.course, id, client);
    if (data.videoRef !== undefined || data.videoProvider !== undefined) {
      await checkCourseVideo(data.videoProvider ?? current.video_provider, data.videoRef ?? current.video_ref);
    }
    const levelId = data.levelCode ? await resolveLevelId(client, data.levelCode) : undefined;

    // Exercises attached to this course must stay on the same level.
    if (levelId !== undefined && levelId !== current.level_id) {
      const { rows } = await client.query('SELECT 1 FROM exercises WHERE course_id = $1 LIMIT 1', [id]);
      if (rows[0]) throw AppError.conflict('LEVEL_CHANGE_BLOCKED', 'Detach or move this course\'s exercises before changing its level');
    }

    await updateRow(client, RESOURCES.course, id, { ...data, levelId });
    return toAdminView(await fetchOne(RESOURCES.course, id, client));
  });
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------
async function checkSolutionVideos(solutions = []) {
  await Promise.all(solutions.map((s, i) =>
    s.type === 'VIDEO' && s.videoProvider === 'S3' ? assertObjectExists(s.videoRef, `solutions[${i}].videoRef`) : null));
}

async function assertCourseOnLevel(client, courseId, levelId) {
  if (!courseId) return;
  const { rows } = await client.query('SELECT level_id FROM courses WHERE id = $1', [courseId]);
  if (!rows[0]) throw AppError.badRequest('COURSE_NOT_FOUND', 'Linked course does not exist');
  if (rows[0].level_id !== levelId) throw AppError.badRequest('COURSE_LEVEL_MISMATCH', 'Linked course belongs to another level');
}

async function replaceSolutions(client, exerciseId, solutions) {
  await client.query('DELETE FROM exercise_solutions WHERE exercise_id = $1', [exerciseId]);
  for (const [i, s] of solutions.entries()) {
    await client.query(
      `INSERT INTO exercise_solutions (exercise_id, step_number, solution_type, body, video_provider, video_ref)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [exerciseId, i + 1, s.type, s.body ?? null, s.videoProvider ?? null, s.videoRef ?? null],
    );
  }
}

async function createExercise(adminId, data) {
  await Promise.all([
    assertObjectExists(data.pdfKey, 'pdfKey'),
    data.correctionPdfKey ? assertObjectExists(data.correctionPdfKey, 'correctionPdfKey') : null,
    checkSolutionVideos(data.solutions),
  ]);
  return withTx(async (client) => {
    const levelId = await resolveLevelId(client, data.levelCode);
    await assertCourseOnLevel(client, data.courseId, levelId);
    const id = await insertRow(client, RESOURCES.exercise, { ...data, levelId, createdBy: adminId });
    if (data.solutions) await replaceSolutions(client, id, data.solutions);
    return toAdminView(await fetchOne(RESOURCES.exercise, id, client));
  });
}

async function updateExercise(id, data) {
  await Promise.all([
    data.pdfKey ? assertObjectExists(data.pdfKey, 'pdfKey') : null,
    data.correctionPdfKey ? assertObjectExists(data.correctionPdfKey, 'correctionPdfKey') : null,
    checkSolutionVideos(data.solutions),
  ]);
  return withTx(async (client) => {
    const current = await fetchOne(RESOURCES.exercise, id, client);
    const levelId = data.levelCode ? await resolveLevelId(client, data.levelCode) : current.level_id;
    // Re-check the link whenever either side of it changes.
    if (data.levelCode || data.courseId) {
      await assertCourseOnLevel(client, data.courseId !== undefined ? data.courseId : current.course_id, levelId);
    }
    await updateRow(client, RESOURCES.exercise, id, { ...data, levelId });
    if (data.solutions) await replaceSolutions(client, id, data.solutions);
    return toAdminView(await fetchOne(RESOURCES.exercise, id, client));
  });
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
async function checkExamFiles(data) {
  await Promise.all([
    data.paperPdfKey ? assertObjectExists(data.paperPdfKey, 'paperPdfKey') : null,
    data.correctionPdfKey ? assertObjectExists(data.correctionPdfKey, 'correctionPdfKey') : null,
  ]);
}

async function createExam(adminId, data) {
  await checkExamFiles(data);
  return withTx(async (client) => {
    const levelId = await resolveLevelId(client, data.levelCode);
    const id = await insertRow(client, RESOURCES.exam, { ...data, levelId, createdBy: adminId });
    return toAdminView(await fetchOne(RESOURCES.exam, id, client));
  });
}

async function updateExam(id, data) {
  await checkExamFiles(data);
  return withTx(async (client) => {
    await fetchOne(RESOURCES.exam, id, client);
    const levelId = data.levelCode ? await resolveLevelId(client, data.levelCode) : undefined;
    await updateRow(client, RESOURCES.exam, id, { ...data, levelId });
    return toAdminView(await fetchOne(RESOURCES.exam, id, client));
  });
}

module.exports = {
  list, get, remove,
  createCourse, updateCourse,
  createExercise, updateExercise,
  createExam, updateExam,
};
