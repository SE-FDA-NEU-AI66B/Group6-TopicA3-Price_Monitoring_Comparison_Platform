import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  createJsonlEmailAdapter,
  createMemoryEmailAdapter,
} from './development-email.adapter.js';

test('JSONL adapter records inspectable evidence and deduplicates by notification ID', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pricelens-email-'));
  const outboxPath = join(temporaryDirectory, 'outbox.jsonl');

  try {
    const adapter = createJsonlEmailAdapter({ outboxPath });
    const message = {
      notificationId: '41',
      to: 'snapshot@example.test',
      subject: 'Price Drop Alert: Laptop ABC',
      text: 'Deterministic body',
      requestedAt: new Date().toISOString(),
    };
    const first = await adapter.sendEmail(message);
    const retry = await adapter.sendEmail(message);
    const evidence = parseJsonl(await readFile(outboxPath, 'utf8'));

    assert.deepEqual(first, {
      accepted: true,
      providerMessageId: 'jsonl:41',
      deduplicated: false,
    });
    assert.deepEqual(retry, {
      accepted: true,
      providerMessageId: 'jsonl:41',
      deduplicated: true,
    });
    assert.equal(evidence.length, 1);
    assert.deepEqual(evidence[0], {
      notification_id: '41',
      status: 'ACCEPTED',
      provider_message_id: 'jsonl:41',
      to: 'snapshot@example.test',
      subject: 'Price Drop Alert: Laptop ABC',
      text: 'Deterministic body',
      requested_at: message.requestedAt,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('development adapters expose deterministic failure without real email', async () => {
  const adapter = createMemoryEmailAdapter({
    failNotificationIds: ['51'],
  });

  await assert.rejects(
    () => adapter.sendEmail({
      notificationId: '51',
      to: 'snapshot@example.test',
      subject: 'Price Drop Alert: Laptop ABC',
      text: 'Body',
      requestedAt: new Date().toISOString(),
    }),
    /Deterministic development adapter failure/,
  );
  assert.equal(adapter.attempts.length, 1);
  assert.equal(adapter.messages.length, 0);
});

function parseJsonl(content) {
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
