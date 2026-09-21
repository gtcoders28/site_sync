/**
 * Unified, centralized APIError class
 */
export class APIError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details: any;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, errorCode: string = 'ERROR', details: any = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details: any = null, errorCode = 'BAD_REQUEST'): APIError {
    return new APIError(400, message, errorCode, details);
  }

  static unauthorized(message = 'Unauthorized', errorCode = 'UNAUTHORIZED'): APIError {
    return new APIError(401, message, errorCode);
  }

  static forbidden(message = 'Forbidden', errorCode = 'FORBIDDEN'): APIError {
    return new APIError(403, message, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND'): APIError {
    return new APIError(404, message, errorCode);
  }

  static conflict(message = 'Conflict', errorCode = 'CONFLICT', details: any = null): APIError {
    return new APIError(409, message, errorCode, details);
  }

  static unprocessable(message = 'Unprocessable Entity', details: any = null, errorCode = 'UNPROCESSABLE_ENTITY'): APIError {
    return new APIError(422, message, errorCode, details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later', errorCode = 'TOO_MANY_REQUESTS'): APIError {
    return new APIError(429, message, errorCode);
  }

  static internal(message = 'Internal Server Error', errorCode = 'INTERNAL_SERVER_ERROR'): APIError {
    return new APIError(500, message, errorCode);
  }
}

export default APIError;
