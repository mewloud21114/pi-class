'use strict';

const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { pool } = require('./db/pool');

const server = app.listen(env.PORT, () => logger.info(`π-class API listening on port ${env.PORT}`));

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
