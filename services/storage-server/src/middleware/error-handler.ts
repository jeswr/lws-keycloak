import { Request, Response, NextFunction } from 'express';
import { TokenValidationError } from '../validators/token-validator.js';
import { AuthorizationError } from '../validators/authorization-enforcer.js';

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof TokenValidationError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  if (err instanceof StorageError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  // Default error
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
