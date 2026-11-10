'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const asyncHandler = require('../utils/asyncHandler');
const schemas = require('../validators/schemas');
const authService = require('../services/auth.service');

/** POST /api/auth/register — creates a STUDENT account in PENDING status. */
router.post('/register', registerLimiter, validate({ body: schemas.register }), asyncHandler(async (req, res) => {
  const user = await authService.register(req.valid.body);
  res.status(201).json({
    message: 'Registration received. Your account will be usable once an administrator activates it.',
    user,
  });
}));

/** POST /api/auth/login — returns a JWT only for ACTIVE accounts. */
router.post('/login', loginLimiter, validate({ body: schemas.login }), asyncHandler(async (req, res) => {
  res.json(await authService.login(req.valid.body));
}));

/** GET /api/auth/me — current profile. */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: await authService.getMe(req.user.id) });
}));

module.exports = router;
