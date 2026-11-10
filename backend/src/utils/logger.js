'use strict';

const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Never let credentials or tokens reach the logs.
  redact: ['req.headers.authorization', 'req.body.password', '*.password', '*.password_hash'],
});
