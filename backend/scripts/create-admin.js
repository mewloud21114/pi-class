'use strict';

/**
 * Bootstrap an administrator (admins cannot self-register through the API).
 * Usage: ADMIN_PHONE=22612345 ADMIN_PASSWORD='...' npm run create-admin
 */
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { pool } = require('../src/db/pool');
const { normalizeMauritanianPhone } = require('../src/utils/phone');

(async () => {
  const phone = normalizeMauritanianPhone(process.env.ADMIN_PHONE || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!phone) throw new Error('ADMIN_PHONE must be a valid Mauritanian number');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO users (phone, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')
     ON CONFLICT (phone) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', status = 'ACTIVE',
           token_version = users.token_version + 1
     RETURNING id, phone`,
    [phone, hash, process.env.ADMIN_NAME || 'Administrator'],
  );
  console.log(`Admin ready: ${rows[0].phone} (${rows[0].id})`);
  await pool.end();
})().catch(async (err) => {
  console.error(err.message);
  await pool.end();
  process.exit(1);
});
