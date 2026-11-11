import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

function requireString(name, env = process.env) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(name, fallback, env = process.env) {
  const rawValue = env[name]?.trim() || fallback;
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return value;
}

function parseSslOption(env = process.env, connectionUrl = null) {
  const rawSsl = env.DB_SSL?.trim().toLowerCase();

  if (rawSsl === 'true' || rawSsl === '1' || rawSsl === 'require') {
    return Object.freeze({ rejectUnauthorized: false });
  }

  if (rawSsl === 'false' || rawSsl === '0' || rawSsl === 'disable') {
    return false;
  }

  const sslMode = connectionUrl?.searchParams.get('sslmode')?.trim().toLowerCase();

  if (sslMode && sslMode !== 'disable') {
    return Object.freeze({ rejectUnauthorized: false });
  }

  return false;
}

function parseDatabaseConfig(env = process.env, nodeEnv = 'development') {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl && nodeEnv !== 'test') {
    let parsedUrl;

    try {
      parsedUrl = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
    }

    const dbName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));

    if (!dbName) {
      throw new Error('DATABASE_URL must include a database name in its path');
    }

    const rawPort = parsedUrl.port || '5432';
    const port = Number(rawPort);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('DATABASE_URL port must be an integer between 1 and 65535');
    }

    return Object.freeze({
      host: parsedUrl.hostname,
      port,
      name: env.DB_NAME?.trim() || dbName,
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      ssl: parseSslOption(env, parsedUrl),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return Object.freeze({
    host: requireString('DB_HOST', env),
    port: parsePort('DB_PORT', undefined, env),
    name: requireString('DB_NAME', env),
    user: requireString('DB_USER', env),
    password: requireString('DB_PASSWORD', env),
    ssl: parseSslOption(env),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

function parseFrontendOrigins(env = process.env, nodeEnv = 'development') {
  const rawOrigin = env.FRONTEND_ORIGIN?.trim();

  if (!rawOrigin) {
    if (nodeEnv === 'production') {
      return Object.freeze(['*']);
    }

    throw new Error('Missing required environment variable: FRONTEND_ORIGIN');
  }

  const origins = rawOrigin
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return Object.freeze(origins);
}

function parseCookieSameSite(env = process.env) {
  const rawSameSite = env.COOKIE_SAME_SITE?.trim().toLowerCase() || 'lax';

  if (!['lax', 'strict', 'none'].includes(rawSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict or none');
  }

  return rawSameSite;
}

function resolveServerPort(env = process.env) {
  if (env.API_PORT?.trim()) {
    return parsePort('API_PORT', '3000', env);
  }

  return parsePort('PORT', '3000', env);
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const frontendOrigins = parseFrontendOrigins(env, nodeEnv);

  return Object.freeze({
    database: parseDatabaseConfig(env, nodeEnv),
    apiPort: resolveServerPort(env),
    frontendOrigin: frontendOrigins[0],
    frontendOrigins,
    cookieSameSite: parseCookieSameSite(env),
    email: Object.freeze({
      transport: env.EMAIL_TRANSPORT?.trim() || 'jsonl',
      outboxPath: env.EMAIL_OUTBOX_PATH?.trim()
        || '.local/pricelens-email-outbox.jsonl',
    }),
    nodeEnv,
  });
}

export const config = loadConfig(process.env);
