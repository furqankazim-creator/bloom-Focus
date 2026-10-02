import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { User } from './models/User.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Resolves a bearer token to the current user document, or throws 401. */
export async function userFromToken(token) {
  if (!token) throw new HttpError(401, 'Sign in required');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Session expired. Sign in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Account not found');
  return user;
}

export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.user = await userFromToken(token);
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (req.user.role !== role) throw new HttpError(403, `Only a ${role} account can do this`);
    next();
  };
}
