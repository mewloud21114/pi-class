'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the Bearer JWT, then reloads the user so that a suspension or a
 * token_version bump takes effect immediately instead of at token expiry.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch (err) {
    throw AppError.unauthorized(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const { rows } = await db.query(
    'SELECT id, phone, role, status, is_active, level_id, token_version FROM users WHERE id = $1',
    [payload.sub],
  );
  const user = rows[0];
  if (!user || user.token_version !== payload.tv) throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
  if (!user.is_active) throw AppError.forbidden(`ACCOUNT_${user.status}`, 'Account is not active');

  req.user = { id: user.id, role: user.role, levelId: user.level_id, phone: user.phone };
  next();
});

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(AppError.forbidden());

module.exports = { authenticate, requireRole };
