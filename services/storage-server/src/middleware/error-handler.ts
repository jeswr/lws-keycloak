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

  if (err.name === 'TokenValidationError') {
    return res.status((err as any).statusCode || 401).json({
      error: (err as any).code || 'INVALID_TOKEN',
      message: err.message,
    });
  }

  if (err.name === 'AuthorizationError') {
    return res.status((err as any).statusCode || 403).json({
      error: (err as any).code || 'FORBIDDEN',
      message: err.message,
    });
  }

  if (err instanceof StorageError) {
    return res.status((err as any).statusCode || 500).json({
      error: (err as any).code || 'STORAGE_ERROR',
      message: err.message,
    });
  }

  // Default error
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
