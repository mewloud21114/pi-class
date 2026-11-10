'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const schemas = require('../validators/schemas');
const adminService = require('../services/admin.service');

router.use(authenticate, requireRole('ADMIN'));

/** GET /api/admin/users/pending?level=6C&page=1&pageSize=20 */
router.get('/users/pending', validate({ query: schemas.pendingUsersQuery }), asyncHandler(async (req, res) => {
  res.json(await adminService.listPendingUsers(req.valid.query));
}));

const statusRoute = (newStatus) => [
  validate({ params: schemas.uuidParam, body: schemas.statusChangeBody }),
  asyncHandler(async (req, res) => {
    const result = await adminService.changeStatus({
      userId: req.valid.params.id,
      newStatus,
      adminId: req.user.id,
      reason: req.valid.body.reason,
    });
    req.log.info({ targetUserId: req.valid.params.id, newStatus, adminId: req.user.id }, 'Account status changed');
    res.json(result);
  }),
];

/** PATCH /api/admin/users/:id/activate — idempotent. */
router.patch('/users/:id/activate', ...statusRoute('ACTIVE'));
/** PATCH /api/admin/users/:id/suspend — revokes existing tokens. */
router.patch('/users/:id/suspend', ...statusRoute('SUSPENDED'));
/** PATCH /api/admin/users/:id/reject */
router.patch('/users/:id/reject', ...statusRoute('REJECTED'));

/** Courses, exercises, exams and file uploads. */
router.use(require('./adminContent.routes'));

module.exports = router;
