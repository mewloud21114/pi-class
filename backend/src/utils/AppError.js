'use strict';

/** Operational error carrying an HTTP status and a stable machine-readable code for the mobile app. */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code, message, details) { return new AppError(400, code, message, details); }
  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required') { return new AppError(401, code, message); }
  static forbidden(code = 'FORBIDDEN', message = 'Access denied') { return new AppError(403, code, message); }
  static notFound(code = 'NOT_FOUND', message = 'Resource not found') { return new AppError(404, code, message); }
  static conflict(code, message) { return new AppError(409, code, message); }
}

module.exports = AppError;
