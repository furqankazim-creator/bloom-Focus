import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/bloom-focus',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  // Comma-separated list of allowed browser origins; native apps don't send an Origin header.
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
};
