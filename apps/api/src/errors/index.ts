import { AppError } from "./AppError.js";

export class BadRequestError extends AppError {
   constructor(message = "Bad request.", errors?: unknown) {
      super(message, 400, errors);
   }
}

export class UnauthorizedError extends AppError {
   constructor(message = "Authentication required.") {
      super(message, 401);
   }
}

export class ForbiddenError extends AppError {
   constructor(message = "You are not allowed to perform this action.") {
      super(message, 403);
   }
}

export class NotFoundError extends AppError {
   constructor(message = "Resource not found.") {
      super(message, 404);
   }
}

export class ConflictError extends AppError {
   constructor(message = "Resource conflict.") {
      super(message, 409);
   }
}