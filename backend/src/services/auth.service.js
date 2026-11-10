'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../db/pool');
const AppError = require('../utils/AppError');

// Compared against when the phone is unknown so that response time doesn't reveal which numbers are registered.
const DUMMY_HASH = bcrypt.hashSync('pi-class-timing-equalizer', env.BCRYPT_ROUNDS);

const STATUS_ERRORS = {
  PENDING: ['ACCOUNT_PENDING', 'Your account is awaiting administrator approval'],
  SUSPENDED: ['ACCOUNT_SUSPENDED', 'Your account has been suspended'],
  REJECTED: ['ACCOUNT_REJECTED', 'Your registration was rejected'],
};

function toPublicUser(u) {
  return {
    id: u.id,
    phone: u.phone,
    fullName: u.full_name,
    role: u.role,
    status: u.status,
    isActive: u.is_active,
    level: u.level_code ? { id: u.level_id, code: u.level_code } : null,
    createdAt: u.created_at,
  };
}

function signToken(user) {
  return jwt.sign(
    { role: user.role, lvl: user.level_id, tv: user.token_version },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: user.id,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

async function register({ phone, password, levelCode, fullName }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  try {
    // Role and status are forced server-side — never taken from the request body.
    const { rows } = await db.query(
      `INSERT INTO users (phone, password_hash, full_name, role, status, level_id)
       SELECT $1, $2, $3, 'STUDENT', 'PENDING', l.id
         FROM education_levels l
        WHERE l.code = $4 AND l.is_active
       RETURNING id, phone, full_name, role, status, is_active, level_id, created_at,
                 (SELECT code FROM education_levels WHERE id = level_id) AS level_code`,
      [phone, passwordHash, fullName ?? null, levelCode],
    );
    if (!rows[0]) throw AppError.badRequest('INVALID_LEVEL', 'Unknown or inactive education level');
    return toPublicUser(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw AppError.conflict('PHONE_ALREADY_REGISTERED', 'This phone number is already registered');
    throw err;
  }
}

async function login({ phone, password }) {
  const { rows } = await db.query(
    `SELECT u.*, l.code AS level_code
       FROM users u LEFT JOIN education_levels l ON l.id = u.level_id
      WHERE u.phone = $1`,
    [phone],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid phone number or password');

  // Status is only revealed once the password has been proven.
  if (!user.is_active) {
    const [code, message] = STATUS_ERRORS[user.status] ?? ['ACCOUNT_INACTIVE', 'Account is not active'];
    throw AppError.forbidden(code, message);
  }

  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  return { token: signToken(user), tokenType: 'Bearer', expiresIn: env.JWT_EXPIRES_IN, user: toPublicUser(user) };
}

async function getMe(userId) {
  const { rows } = await db.query(
    `SELECT u.*, l.code AS level_code
       FROM users u LEFT JOIN education_levels l ON l.id = u.level_id
      WHERE u.id = $1`,
    [userId],
  );
  if (!rows[0]) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
  return toPublicUser(rows[0]);
}

module.exports = { register, login, getMe, toPublicUser };
