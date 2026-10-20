import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

function requireString(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(name, fallback) {
  const rawValue = process.env[name]?.trim() || fallback;
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return value;
}

const nodeEnv = requireString('NODE_ENV');

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test or production');
}

export const config = Object.freeze({
  database: Object.freeze({
    host: requireString('DB_HOST'),
    port: parsePort('DB_PORT'),
    name: requireString('DB_NAME'),
    user: requireString('DB_USER'),
    password: requireString('DB_PASSWORD'),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }),
  apiPort: parsePort('API_PORT', '3000'),
  frontendOrigin: requireString('FRONTEND_ORIGIN'),
  jwtSecret: requireString('JWT_SECRET'),
  nodeEnv,
});
