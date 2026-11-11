import {
  appendFile,
  mkdir,
  readFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { EmailDeliveryError } from './email-adapter.js';

export function createJsonlEmailAdapter({
  outboxPath,
  failNotificationIds = [],
}) {
  const resolvedOutboxPath = resolve(outboxPath);
  const failures = new Set(failNotificationIds.map(String));
  let queue = Promise.resolve();

  return Object.freeze({
    outboxPath: resolvedOutboxPath,
    sendEmail(message) {
      const operation = queue.then(() => deliverToJsonlOutbox({
        message,
        outboxPath: resolvedOutboxPath,
        failures,
      }));
      queue = operation.catch(() => undefined);
      return operation;
    },
  });
}

export function createMemoryEmailAdapter({
  failNotificationIds = [],
  delayMilliseconds = 0,
} = {}) {
  const failures = new Set(failNotificationIds.map(String));
  const attempts = [];
  const messages = [];
  const acceptedByNotification = new Map();

  return {
    attempts,
    messages,
    async sendEmail(message) {
      attempts.push(Object.freeze({ ...message }));

      if (delayMilliseconds > 0) {
        await new Promise((resolveDelay) => {
          setTimeout(resolveDelay, delayMilliseconds);
        });
      }

      const notificationId = String(message.notificationId);
      const existing = acceptedByNotification.get(notificationId);

      if (existing) {
        return { ...existing, deduplicated: true };
      }

      if (failures.has(notificationId)) {
        throw new EmailDeliveryError('Deterministic development adapter failure.');
      }

      const outcome = Object.freeze({
        accepted: true,
        providerMessageId: `memory:${notificationId}`,
        deduplicated: false,
      });
      acceptedByNotification.set(notificationId, outcome);
      messages.push(Object.freeze({ ...message }));
      return outcome;
    },
  };
}

async function deliverToJsonlOutbox({ message, outboxPath, failures }) {
  const notificationId = String(message.notificationId);
  const evidence = await readOutbox(outboxPath);
  const existing = evidence.find((entry) => (
    entry.notification_id === notificationId
    && entry.status === 'ACCEPTED'
  ));

  if (existing) {
    return {
      accepted: true,
      providerMessageId: existing.provider_message_id,
      deduplicated: true,
    };
  }

  await mkdir(dirname(outboxPath), { recursive: true });

  if (failures.has(notificationId)) {
    await appendEvidence(outboxPath, {
      notification_id: notificationId,
      status: 'REJECTED',
      to: message.to,
      subject: message.subject,
      requested_at: message.requestedAt,
      failure_reason: 'Deterministic development adapter failure.',
    });
    throw new EmailDeliveryError('Deterministic development adapter failure.');
  }

  const providerMessageId = `jsonl:${notificationId}`;
  await appendEvidence(outboxPath, {
    notification_id: notificationId,
    status: 'ACCEPTED',
    provider_message_id: providerMessageId,
    to: message.to,
    subject: message.subject,
    text: message.text,
    requested_at: message.requestedAt,
  });

  return {
    accepted: true,
    providerMessageId,
    deduplicated: false,
  };
}

async function readOutbox(outboxPath) {
  let content;

  try {
    content = await readFile(outboxPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    throw new EmailDeliveryError('Development outbox could not be read.');
  }

  try {
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    throw new EmailDeliveryError('Development outbox is not valid JSONL.');
  }
}

async function appendEvidence(outboxPath, evidence) {
  try {
    await appendFile(outboxPath, `${JSON.stringify(evidence)}\n`, 'utf8');
  } catch {
    throw new EmailDeliveryError('Development outbox could not be written.');
  }
}
