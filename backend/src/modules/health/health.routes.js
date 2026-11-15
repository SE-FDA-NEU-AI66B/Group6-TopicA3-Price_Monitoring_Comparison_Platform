import { Router } from 'express';

import { query } from '../../db/pool.js';

export async function checkSystemHealth({
  queryFn = query,
  nowFn = () => new Date(),
} = {}) {
  const timestamp = nowFn().toISOString();

  try {
    const result = await queryFn('SELECT 1 AS healthy');
    const isDatabaseHealthy = Number(result?.rows?.[0]?.healthy) === 1;

    if (!isDatabaseHealthy) {
      return {
        statusCode: 503,
        body: {
          status: 'unhealthy',
          service: 'pricelens-backend',
          checks: {
            application: 'up',
            database: 'down',
          },
          timestamp,
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        service: 'pricelens-backend',
        checks: {
          application: 'up',
          database: 'up',
        },
        timestamp,
      },
    };
  } catch {
    return {
      statusCode: 503,
      body: {
        status: 'unhealthy',
        service: 'pricelens-backend',
        checks: {
          application: 'up',
          database: 'down',
        },
        timestamp,
      },
    };
  }
}

export function createHealthHandler(options = {}) {
  return async function handleHealthCheck(_request, response) {
    const result = await checkSystemHealth(options);

    response
      .set('Cache-Control', 'no-store')
      .status(result.statusCode)
      .json(result.body);
  };
}

export function createHealthRouter(options = {}) {
  const router = Router();
  router.get('/', createHealthHandler(options));
  return router;
}

export const healthRouter = createHealthRouter();
