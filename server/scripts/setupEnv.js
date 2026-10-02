import { randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(serverDir, '.env');
const examplePath = join(serverDir, '.env.example');

try {
  await access(envPath);
  console.error('server/.env already exists. It was not changed.');
  process.exitCode = 1;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;

  const template = await readFile(examplePath, 'utf8');
  if (!/^JWT_SECRET=$/m.test(template)) {
    throw new Error('Expected a blank JWT_SECRET entry in server/.env.example');
  }

  const env = template.replace(/^JWT_SECRET=$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`);
  await writeFile(envPath, env, { flag: 'wx', mode: 0o600 });
  console.log('Created server/.env with a private random JWT secret.');
  console.log('Check MONGODB_URI and start MongoDB before running npm start.');
}