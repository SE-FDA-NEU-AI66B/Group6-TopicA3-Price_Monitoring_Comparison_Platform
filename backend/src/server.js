import { app } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';

const server = app.listen(config.apiPort, () => {
  console.log(`PriceLens API listening on port ${config.apiPort}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}; shutting down PriceLens API`);

  server.close(async (serverError) => {
    try {
      await closePool();
    } catch (poolError) {
      console.error('Failed to close PostgreSQL pool', {
        name: poolError.name,
        code: poolError.code,
        message: poolError.message,
      });
      process.exitCode = 1;
    }

    if (serverError) {
      console.error('Failed to close HTTP server', {
        name: serverError.name,
        code: serverError.code,
        message: serverError.message,
      });
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

server.on('error', async (error) => {
  shuttingDown = true;
  console.error('HTTP server failed', {
    name: error.name,
    code: error.code,
    message: error.message,
  });
  process.exitCode = 1;

  try {
    await closePool();
  } catch (poolError) {
    console.error('Failed to close PostgreSQL pool', {
      name: poolError.name,
      code: poolError.code,
      message: poolError.message,
    });
  }
});
