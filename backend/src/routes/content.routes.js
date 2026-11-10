'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const schemas = require('../validators/schemas');
const content = require('../services/content.service');
const engagement = require('../services/engagement.service');
const { commentLimiter } = require('../middleware/rateLimit');

// Every content route requires an ACTIVE account (enforced inside authenticate).
router.use(authenticate);

// Signed URLs are per-user and short-lived: never let a proxy cache them.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

/** GET /api/content/level/:levelId — courses, exercises and exams for a level (id or code). */
router.get('/level/:levelId', validate({ params: schemas.levelParam }), asyncHandler(async (req, res) => {
  res.json(await content.getLevelContent(req.user, req.valid.params.levelId));
}));

/** POST /api/content/courses/:id/playback — short-lived signed video URL. */
router.post('/courses/:id/playback', validate({ params: schemas.uuidParam }), asyncHandler(async (req, res) => {
  res.json(await content.getCoursePlayback(req.user, req.valid.params.id));
}));

/** GET /api/content/exercises/:id/pdf?file=paper|correction — signed URL for the sheet or its correction. */
router.get('/exercises/:id/pdf', validate({ params: schemas.uuidParam, query: schemas.examFileQuery }), asyncHandler(async (req, res) => {
  res.json(await content.getExercisePdf(req.user, req.valid.params.id, req.valid.query.file));
}));

/** POST /api/content/exercises/:id/solutions/:step/playback — signed URL for a video solution step. */
router.post('/exercises/:id/solutions/:step/playback', validate({ params: schemas.solutionStepParams }), asyncHandler(async (req, res) => {
  const { id, step } = req.valid.params;
  res.json(await content.getSolutionVideo(req.user, id, step));
}));

/** GET /api/content/exams/:id/file?file=paper|correction — signed URL for an exam PDF. */
router.get('/exams/:id/file', validate({ params: schemas.uuidParam, query: schemas.examFileQuery }), asyncHandler(async (req, res) => {
  res.json(await content.getExamFile(req.user, req.valid.params.id, req.valid.query.file));
}));

// ---------------------------------------------------------------------------
// Likes, comments and viewing progress (courses)
// ---------------------------------------------------------------------------
const courseId = validate({ params: schemas.uuidParam });

/** PUT / DELETE /api/content/courses/:id/like — idempotent. */
router.put('/courses/:id/like', courseId, asyncHandler(async (req, res) => {
  res.json(await engagement.setLike(req.user, req.valid.params.id, true));
}));
router.delete('/courses/:id/like', courseId, asyncHandler(async (req, res) => {
  res.json(await engagement.setLike(req.user, req.valid.params.id, false));
}));

/** GET /api/content/courses/:id/comments?before=<createdAt>&limit=20 — newest first. */
router.get('/courses/:id/comments', validate({ params: schemas.uuidParam, query: schemas.commentsQuery }), asyncHandler(async (req, res) => {
  res.json(await engagement.listComments(req.user, req.valid.params.id, req.valid.query));
}));

/** POST /api/content/courses/:id/comments { body } */
router.post('/courses/:id/comments', commentLimiter, validate({ params: schemas.uuidParam, body: schemas.commentBody }), asyncHandler(async (req, res) => {
  res.status(201).json(await engagement.addComment(req.user, req.valid.params.id, req.valid.body.body));
}));

/** DELETE /api/content/comments/:id — the author or an admin. */
router.delete('/comments/:id', validate({ params: schemas.uuidParam }), asyncHandler(async (req, res) => {
  await engagement.deleteComment(req.user, req.valid.params.id);
  res.status(204).end();
}));

/** PATCH /api/content/views/:id { positionSeconds, durationSeconds? } — player heartbeat. */
router.patch('/views/:id', validate({ params: schemas.uuidParam, body: schemas.viewProgress }), asyncHandler(async (req, res) => {
  await engagement.recordProgress(req.user, req.valid.params.id, req.valid.body);
  res.status(204).end();
}));

module.exports = router;
