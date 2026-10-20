import { parseIdentifier } from '../../shared/validation.js';
import {
  EmailDeliveryError,
  requireEmailAdapter,
} from './email-adapter.js';
import {
  findPendingNotificationIds,
  markNotificationFailed,
  markNotificationSent,
  withPendingNotificationClaim,
} from './notification-delivery.repository.js';

const FIVE_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;

export async function deliverPendingNotification(
  notificationId,
  { emailAdapter } = {},
) {
  const parsedNotificationId = parseIdentifier(notificationId, 'notificationId');
  const adapter = requireEmailAdapter(emailAdapter);
  const claim = await withPendingNotificationClaim(
    parsedNotificationId,
    async (notification, executeQuery) => {
      const requestedAt = new Date().toISOString();
      let adapterOutcome;

      try {
        adapterOutcome = await adapter.sendEmail({
          notificationId: notification.notification_id,
          to: notification.recipient_email,
          subject: notification.subject,
          text: createDeliveryText(notification),
          requestedAt,
        });
        requireAcceptedOutcome(adapterOutcome);
      } catch (error) {
        const failureReason = safeFailureReason(error);
        const failed = await markNotificationFailed({
          notificationId: notification.notification_id,
          failureReason,
        }, executeQuery);

        if (!failed) {
          return stateChangedResult(notification.notification_id);
        }

        return Object.freeze({
          status: 'FAILED',
          notificationId: failed.notification_id,
          failureReason: failed.failure_reason,
        });
      }

      const sent = await markNotificationSent({
        notificationId: notification.notification_id,
        providerMessageId: adapterOutcome.providerMessageId,
      }, executeQuery);

      if (!sent) {
        return stateChangedResult(notification.notification_id);
      }

      const deliveryLatencyMilliseconds = new Date(sent.sent_at).getTime()
        - new Date(sent.qualified_at).getTime();

      return Object.freeze({
        status: 'SENT',
        notificationId: sent.notification_id,
        providerMessageId: sent.provider_message_id,
        sentAt: new Date(sent.sent_at).toISOString(),
        qualifiedAt: new Date(sent.qualified_at).toISOString(),
        deliveryLatencyMilliseconds,
        withinFiveMinutes: deliveryLatencyMilliseconds >= 0
          && deliveryLatencyMilliseconds <= FIVE_MINUTES_IN_MILLISECONDS,
      });
    },
  );

  if (!claim.claimed) {
    return Object.freeze({
      status: 'CLAIMED_BY_OTHER',
      notificationId: parsedNotificationId,
    });
  }

  return claim.value ?? Object.freeze({
    status: 'NOT_PENDING',
    notificationId: parsedNotificationId,
  });
}

export async function deliverPendingNotifications({
  emailAdapter,
  limit = 10,
} = {}) {
  const adapter = requireEmailAdapter(emailAdapter);
  const parsedLimit = parseLimit(limit);
  const notificationIds = await findPendingNotificationIds({
    limit: parsedLimit,
  });
  const results = [];

  for (const notificationId of notificationIds) {
    results.push(await deliverPendingNotification(notificationId, {
      emailAdapter: adapter,
    }));
  }

  return Object.freeze({
    selectedCount: notificationIds.length,
    results: Object.freeze(results),
  });
}

function createDeliveryText(notification) {
  return [
    `${notification.product_name} reached ${notification.price_amount} ${notification.currency_code}.`,
    `Target price: ${notification.target_price} ${notification.currency_code}.`,
    `Source: ${notification.source_url}`,
  ].join('\n');
}

function requireAcceptedOutcome(outcome) {
  if (
    outcome?.accepted !== true
    || typeof outcome.providerMessageId !== 'string'
    || outcome.providerMessageId.trim() === ''
    || outcome.providerMessageId.length > 255
  ) {
    throw new EmailDeliveryError('Email adapter did not accept the delivery request.');
  }
}

function safeFailureReason(error) {
  if (
    error instanceof EmailDeliveryError
    && typeof error.failureReason === 'string'
    && error.failureReason.trim() !== ''
  ) {
    return error.failureReason;
  }

  return 'Email adapter delivery failed.';
}

function parseLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('limit must be an integer between 1 and 100.');
  }

  return limit;
}

function stateChangedResult(notificationId) {
  return Object.freeze({
    status: 'STATE_CHANGED',
    notificationId,
  });
}
