/**
 * Centralized error handling middleware
 * Catches all errors and returns consistent error responses
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error handler middleware
 * Must be registered after all routes
 */
function errorHandler(err, req, res, _next) {
  // Log error details
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    message: err.message,
    requestId: req.headers['x-request-id'] || 'unknown',
  };

  if (err.isOperational) {
    console.warn('Operational error:', JSON.stringify(logEntry));
  } else {
    console.error('Unexpected error:', JSON.stringify({
      ...logEntry,
      stack: err.stack,
    }));
  }

  // AWS SDK errors
  if (err.name === 'CredentialsProviderError') {
    return res.status(503).json({
      error: 'Service Unavailable',
      code: 'AWS_CREDENTIALS_ERROR',
      message: 'Unable to authenticate with AWS services',
    });
  }

  if (err.name === 'AccessDeniedException') {
    return res.status(503).json({
      error: 'Service Unavailable',
      code: 'AWS_ACCESS_DENIED',
      message: 'Service does not have required permissions',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
    });
  }

  // Operational errors (known errors)
  if (err.isOperational) {
    const response = {
      error: err.message,
      code: err.code,
    };

    if (err.details) {
      response.details = err.details;
    }

    return res.status(err.statusCode).json(response);
  }

  // Unknown errors - don't leak details in production
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  errorHandler,
};
