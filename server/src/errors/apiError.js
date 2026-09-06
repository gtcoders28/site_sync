/**
 * Unified, centralized APIError class
 */
class APIError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {string} [errorCode='ERROR'] - Machine-readable error code
   * @param {any} [details=null] - Additional error details or validation errors
   */
  constructor(statusCode, message, errorCode = 'ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = null, errorCode = 'BAD_REQUEST') {
    return new APIError(400, message, errorCode, details);
  }

  static unauthorized(message = 'Unauthorized', errorCode = 'UNAUTHORIZED') {
    return new APIError(401, message, errorCode);
  }

  static forbidden(message = 'Forbidden', errorCode = 'FORBIDDEN') {
    return new APIError(403, message, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new APIError(404, message, errorCode);
  }

  static conflict(message = 'Conflict', errorCode = 'CONFLICT', details = null) {
    return new APIError(409, message, errorCode, details);
  }

  static unprocessable(message = 'Unprocessable Entity', details = null, errorCode = 'UNPROCESSABLE_ENTITY') {
    return new APIError(422, message, errorCode, details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later', errorCode = 'TOO_MANY_REQUESTS') {
    return new APIError(429, message, errorCode);
  }

  static internal(message = 'Internal Server Error', errorCode = 'INTERNAL_SERVER_ERROR') {
    return new APIError(500, message, errorCode);
  }
}

module.exports = {
  APIError,
};
