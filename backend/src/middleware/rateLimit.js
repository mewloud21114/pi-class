'use strict';

const { rateLimit } = require('express-rate-limit');

const json = (code) => (_req, res) =>
  res.status(429).json({ error: { code, message: 'Too many requests, please try again later' } });

// Brute-force protection on credentials endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: json('TOO_MANY_LOGIN_ATTEMPTS'),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json('TOO_MANY_REGISTRATIONS'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json('RATE_LIMITED'),
});

// Per account, not per IP: a whole school may share one connection.
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: json('TOO_MANY_COMMENTS'),
});

module.exports = { loginLimiter, registerLimiter, apiLimiter, commentLimiter };
