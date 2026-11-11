import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productSourceRouter } from './modules/product-sources/product-source.routes.js';
import { trackedProductRouter } from './modules/tracked-products/tracked-product.routes.js';
import { watchlistRouter } from './modules/watchlist/watchlist.routes.js';
import { routeNotFound } from './shared/problems.js';

const frontendDistDirectory = fileURLToPath(
  new URL('../../frontend/dist', import.meta.url),
);
const frontendIndexHtml = fileURLToPath(
  new URL('../../frontend/dist/index.html', import.meta.url),
);

function rewriteFrontendPageRoute(request, response, next) {
  if (
    request.path.startsWith('/api')
    || (request.method !== 'GET' && request.method !== 'HEAD')
  ) {
    next();
    return;
  }

  const normalizedPath = request.path.length > 1
    ? request.path.replace(/\/+$/, '')
    : request.path;
  const search = request.url.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : '';
  const routes = new Map([
    ['/watchlist', '/watchlist/'],
    ['/products/add', '/products/add/'],
  ]);

  if (routes.has(normalizedPath)) {
    request.url = `${routes.get(normalizedPath)}${search}`;
  } else if (/^\/products\/[^/]+\/compare$/.test(normalizedPath)) {
    request.url = `/products/compare.html${search}`;
  } else if (/^\/products\/[^/]+$/.test(normalizedPath)) {
    request.url = `/products/product.html${search}`;
  }

  next();
}

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: config.nodeEnv === 'production',
}));

const allowedOrigins = config.frontendOrigins ?? [config.frontendOrigin];

app.use(cors({
  origin: allowedOrigins.includes('*')
    ? true
    : (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  credentials: true,
  exposedHeaders: ['Retry-After', 'RateLimit', 'RateLimit-Policy'],
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/product-sources', productSourceRouter);
app.use('/api/tracked-products', trackedProductRouter);
app.use('/api', (request, response, next) => next(routeNotFound()));

if (existsSync(frontendIndexHtml)) {
  app.use(rewriteFrontendPageRoute);
  app.use(express.static(frontendDistDirectory));
}

app.use(errorHandler);
