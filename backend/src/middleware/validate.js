'use strict';

const AppError = require('../utils/AppError');

/**
 * validate({ body, query, params }) — parses each part with its zod schema and
 * replaces it with the parsed (typed, normalized) value. Results land on req.valid.
 */
module.exports = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      return next(AppError.badRequest('VALIDATION_ERROR', 'Invalid request', result.error.flatten()));
    }
    req.valid[part] = result.data;
  }
  next();
};
