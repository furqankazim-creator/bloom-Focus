import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { HttpError, requireAuth, signToken } from '../auth.js';
import { User } from '../models/User.js';

export const authRouter = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/signup', async (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }
  if (await User.exists({ email: email.toLowerCase().trim() })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  // Role is never taken from the request: new accounts are always parents.
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    displayName: typeof displayName === 'string' ? displayName.trim().slice(0, 100) : '',
  });
  res.status(201).json({ token: signToken(user), profile: user.toProfile() });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  res.json({ token: signToken(user), profile: user.toProfile() });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ profile: req.user.toProfile() });
});
