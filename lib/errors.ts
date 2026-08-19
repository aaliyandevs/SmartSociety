import { ZodError } from 'zod';

/**
 * Errors thrown deliberately by the domain layer. Anything *not* an AppError is
 * treated as a bug and never leaked to the client (SRS §25 — no raw stack
 * traces reach users).
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    options: { code?: string; status?: number; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? 'APP_ERROR';
    this.status = options.status ?? 400;
    this.fieldErrors = options.fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must log in to continue.') {
    super(message, { code: 'UNAUTHORIZED', status: 401 });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, { code: 'FORBIDDEN', status: 403 });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested record could not be found.') {
    super(message, { code: 'NOT_FOUND', status: 404 });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, { code: 'CONFLICT', status: 409 });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many attempts. Please wait a moment and try again.') {
    super(message, { code: 'RATE_LIMITED', status: 429 });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: Record<string, string[]>, message = 'Please correct the highlighted fields.') {
    super(message, { code: 'VALIDATION', status: 422, fieldErrors });
    this.name = 'ValidationError';
  }
}

export function fromZodError(error: ZodError): ValidationError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new ValidationError(fieldErrors);
}

/** Next.js signals redirects and notFound() by throwing; those must bubble up. */
export function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND');
}
