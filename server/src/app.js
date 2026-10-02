import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import multer from 'multer';
import { MAX_FILE_BYTES, serveFile } from './attachments.js';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { childrenRouter } from './routes/children.js';
import { invitesRouter } from './routes/invites.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), authRouter);
  app.use('/children', childrenRouter);
  app.get('/files/:id', serveFile);
  app.use('/invites', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), invitesRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ error: 'Invalid data' });
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({
        error: tooBig ? `Each file must be under ${MAX_FILE_BYTES / 1024 / 1024} MB` : 'Too many or invalid attachments',
      });
    }
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });
  return app;
}
