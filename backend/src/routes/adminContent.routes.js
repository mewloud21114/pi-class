'use strict';

/**
 * Admin content management. Mounted under /api/admin, behind authenticate + requireRole('ADMIN').
 *
 * Upload flow:
 *   1. POST /uploads { kind, contentType, sizeBytes }   -> { objectKey, upload: { url, method, headers } }
 *   2. Client PUTs the file straight to storage with exactly those headers.
 *   3. POST /courses | /exercises | /exams referencing objectKey (the API checks the object exists).
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const schemas = require('../validators/schemas');
const storage = require('../services/storage.service');
const content = require('../services/adminContent.service');
const stats = require('../services/stats.service');

router.post('/uploads', validate({ body: schemas.uploadRequest }), asyncHandler(async (req, res) => {
  res.status(201).json(await storage.createUploadUrl(req.valid.body));
}));

/** Registers GET/POST on /<path> and GET/PATCH/DELETE on /<path>/:id for one content type. */
function crud(path, kind, schema, create, update) {
  const idParam = validate({ params: schemas.uuidParam });

  router.get(`/${path}`, validate({ query: schemas.contentListQuery }), asyncHandler(async (req, res) => {
    res.json(await content.list(kind, req.valid.query));
  }));

  router.post(`/${path}`, validate({ body: schema.create }), asyncHandler(async (req, res) => {
    const item = await create(req.user.id, req.valid.body);
    req.log.info({ kind, id: item.id, adminId: req.user.id }, 'Content created');
    res.status(201).json(item);
  }));

  router.get(`/${path}/:id`, idParam, asyncHandler(async (req, res) => {
    res.json(await content.get(kind, req.valid.params.id));
  }));

  router.patch(`/${path}/:id`, idParam, validate({ body: schema.update }), asyncHandler(async (req, res) => {
    const item = await update(req.valid.params.id, req.valid.body);
    req.log.info({ kind, id: item.id, adminId: req.user.id }, 'Content updated');
    res.json(item);
  }));

  router.delete(`/${path}/:id`, idParam, asyncHandler(async (req, res) => {
    await content.remove(kind, req.valid.params.id);
    req.log.info({ kind, id: req.valid.params.id, adminId: req.user.id }, 'Content deleted');
    res.status(204).end();
  }));
}

/** GET /api/admin/stats/courses?level=6C — totals + per-course engagement. */
router.get('/stats/courses', validate({ query: schemas.statsQuery }), asyncHandler(async (req, res) => {
  res.json(await stats.overview(req.valid.query));
}));

/** GET /api/admin/stats/courses/:id — one course: daily views (14 days) and its viewers. */
router.get('/stats/courses/:id', validate({ params: schemas.uuidParam }), asyncHandler(async (req, res) => {
  res.json(await stats.courseDetail(req.valid.params.id));
}));

crud('courses', 'course', schemas.course, content.createCourse, content.updateCourse);
crud('exercises', 'exercise', schemas.exercise, content.createExercise, content.updateExercise);
crud('exams', 'exam', schemas.exam, content.createExam, content.updateExam);

module.exports = router;
