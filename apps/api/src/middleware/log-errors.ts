import { type Request, type Response, type NextFunction } from 'express';

export function logErrors(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err.stack);
  next(err);
}