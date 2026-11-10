'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const env = require('./config/env');
const logger = require('./utils/logger');
const db = require('./db/pool');
const { apiLimiter } = require('./middleware/rateLimit');
const { mediaOrigins } = require('./utils/mediaSigner');
const { storageOrigins } = require('./utils/s3');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind one reverse proxy / load balancer — needed for correct client IPs in rate limiting

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  // One short line per request instead of every header.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
    res: (res) => ({ status: res.statusCode }),
  },
}));
// Content-Security-Policy for the website: scripts only from this server; videos, PDFs and
// uploads also from the CDN / object storage the signed URLs point to.
const mediaSrc = mediaOrigins();
const uploadSrc = storageOrigins();
const isProd = env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],          // react-native-web injects <style> tags
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'", 'blob:', ...mediaSrc],
      connectSrc: ["'self'", ...new Set([...mediaSrc, ...uploadSrc])],
      // Only force https when the site is actually served over https.
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  strictTransportSecurity: isProd,
}));
app.use(cors({
  // Native mobile clients send no Origin header; browsers must be on the allow-list.
  origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
// Admin payloads carry step-by-step solution text; everything else stays small.
// (The second parser is skipped when the first one already parsed the body.)
app.use('/api/admin', express.json({ limit: '512kb' }));
app.use(express.json({ limit: '20kb' }));

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/content', require('./routes/content.routes'));

// The website (single-page app): hashed assets cached for a year, index.html never cached,
// and every non-API GET falls back to index.html so client-side routes survive a reload.
const webIndex = path.join(env.WEB_DIST_DIR, 'index.html');
if (fs.existsSync(webIndex)) {
  app.use(express.static(env.WEB_DIST_DIR, { index: false, maxAge: '1y', immutable: true }));
  app.get(/^\/(?!api(\/|$)|health$).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile(webIndex);
  });
  logger.info({ dir: env.WEB_DIST_DIR }, 'Serving the website');
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
