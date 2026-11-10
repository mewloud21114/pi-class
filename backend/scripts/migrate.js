'use strict';

/**
 * Brings the database up to date; safe to run on every start.
 *  - empty database  -> db/schema.sql (already includes every migration) + seed, migrations marked as applied
 *  - existing one    -> applies db/migrations/*.sql not yet recorded in schema_migrations, in name order
 * An advisory lock keeps two starting containers from migrating at the same time.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'db');
const LOCK_ID = 7_314_159;

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

    const files = fs.readdirSync(path.join(DB_DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS exists`);

    if (!rows[0].exists) {
      console.log('migrate: empty database, creating schema');
      await client.query(fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'));
      for (const f of files) await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
    } else {
      const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
      for (const f of files.filter((name) => !done.has(name))) {
        console.log(`migrate: applying ${f}`);
        await client.query(fs.readFileSync(path.join(DB_DIR, 'migrations', f), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      }
    }

    // Reference data (education levels); idempotent.
    await client.query(fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8'));
    console.log('migrate: database is up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
})().catch((err) => {
  console.error('migrate: failed —', err.message);
  process.exit(1);
});
