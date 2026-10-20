import { config } from '../../config.js';
import { closePool } from '../../db/pool.js';
import { createJsonlEmailAdapter } from './development-email.adapter.js';
import { deliverPendingNotifications } from './notification-delivery.processor.js';

async function main() {
  if (config.nodeEnv === 'production') {
    throw new Error('The JSONL development email transport is disabled in production.');
  }

  if (config.email.transport !== 'jsonl') {
    throw new Error('EMAIL_TRANSPORT must be jsonl for the development delivery command.');
  }

  const options = parseArguments(process.argv.slice(2));
  const emailAdapter = createJsonlEmailAdapter({
    outboxPath: config.email.outboxPath,
    failNotificationIds: options.failNotificationIds,
  });
  const result = await deliverPendingNotifications({
    emailAdapter,
    limit: options.limit,
  });

  console.log(JSON.stringify({
    outboxPath: emailAdapter.outboxPath,
    ...result,
  }, null, 2));
}

function parseArguments(argumentsList) {
  let limit = 10;
  const failNotificationIds = [];

  for (const argument of argumentsList) {
    if (argument.startsWith('--limit=')) {
      limit = Number(argument.slice('--limit='.length));
      continue;
    }

    if (argument.startsWith('--fail-notification-id=')) {
      const value = argument.slice('--fail-notification-id='.length);

      if (!/^[1-9]\d*$/.test(value)) {
        throw new Error('--fail-notification-id requires a positive integer.');
      }

      failNotificationIds.push(value);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('--limit must be an integer between 1 and 100.');
  }

  return { limit, failNotificationIds };
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
