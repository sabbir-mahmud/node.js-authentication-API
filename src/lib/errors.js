export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;   // message is written for the client
        Error.captureStackTrace(this, this.constructor);
    }
}
export class BadRequestError extends AppError { constructor(m = "Bad Request") { super(m, 400); } }
export class UnauthorizedError extends AppError { constructor(m = "Unauthorized access") { super(m, 401); } }
export class ForbiddenError extends AppError { constructor(m = "Forbidden") { super(m, 403); } }
export class NotFoundError extends AppError { constructor(m = "Resource not found") { super(m, 404); } }
export class ConflictError extends AppError { constructor(m = "Conflict") { super(m, 409); } }
export class ValidationError extends AppError { constructor(m = "Validation Error", errors = []) { super(m, 422); this.errors = errors; } }
export class ServiceUnavailableError extends AppError { constructor(m = "Service temporarily unavailable") { super(m, 503); } }

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
