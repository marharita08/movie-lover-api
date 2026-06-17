import { NextFunction, Request, Response } from 'express';
import passport from 'passport';

export function injectUserMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  })(req, res, next);
}
