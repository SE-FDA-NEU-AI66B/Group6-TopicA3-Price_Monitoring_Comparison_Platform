import { withTransaction } from '../../db/pool.js';
import {
  activeAlertLimitReached,
  authenticationRequired,
  currentPriceUnavailable,
  priceAlertNotFound,
  targetPriceNotBelowCurrent,
  targetPriceNotPositive,
} from '../../shared/problems.js';
import {
  findCurrentPrice,
  findPriceHistoryCurrency,
  lockProductVariantForPriceEvaluation,
} from './price-history.repository.js';
import {
  countActiveAlertsForUser,
  findPriceAlertsForTrackedProduct,
  insertPriceAlert,
  isPositiveTargetPrice,
  isTargetPriceBelowCurrent,
  lockPriceAlert,
  lockUserForAlertCreation,
  updatePriceAlertStatus,
} from './price-alert.repository.js';
import { findOwnedTrackedProduct } from './tracked-product.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

export const MAX_ACTIVE_ALERTS = 20;

function requireOwnedTrackedProductIn(executeQuery, trackedProductId, authenticatedUserId) {
  return requireOwnedTrackedProduct(
    trackedProductId,
    authenticatedUserId,
    (id, userId) => findOwnedTrackedProduct(id, userId, executeQuery),
  );
}

async function requireActiveAlertCapacity(authenticatedUserId, executeQuery) {
  const lockedUser = await lockUserForAlertCreation(
    authenticatedUserId,
    executeQuery,
  );

  if (!lockedUser) {
    throw authenticationRequired();
  }

  const activeAlertCount = await countActiveAlertsForUser(
    authenticatedUserId,
    executeQuery,
  );

  if (activeAlertCount >= MAX_ACTIVE_ALERTS) {
    throw activeAlertLimitReached();
  }
}

export async function createPriceAlertForUser(
  trackedProductId,
  authenticatedUserId,
  targetPrice,
) {
  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const trackedProduct = await requireOwnedTrackedProductIn(
      executeQuery,
      trackedProductId,
      authenticatedUserId,
    );

    if (!await isPositiveTargetPrice(targetPrice, executeQuery)) {
      throw targetPriceNotPositive([
        { field: 'target_price', reason: 'must_be_positive' },
      ]);
    }

    await lockProductVariantForPriceEvaluation(
      trackedProduct.product_variant_id,
      executeQuery,
    );

    const currencyCode = await findPriceHistoryCurrency(
      trackedProduct.retailer_offer_id,
      executeQuery,
    );
    const currentPrice = currencyCode === null
      ? null
      : await findCurrentPrice({
          productVariantId: trackedProduct.product_variant_id,
          currencyCode,
        }, executeQuery);

    if (!currentPrice) {
      throw currentPriceUnavailable();
    }

    if (!await isTargetPriceBelowCurrent({
      targetPrice,
      currentPrice: currentPrice.price_amount,
    }, executeQuery)) {
      throw targetPriceNotBelowCurrent([
        { field: 'target_price', reason: 'must_be_below_current_price' },
      ]);
    }

    await requireActiveAlertCapacity(authenticatedUserId, executeQuery);

    const alert = await insertPriceAlert({
      trackedProductId,
      targetPrice,
      currencyCode: currentPrice.currency_code,
      priceObservationId: currentPrice.price_observation_id,
    }, executeQuery);

    return assemblePriceAlert({ alert, currentPrice });
  });
}

export async function listPriceAlertsForUser(trackedProductId, authenticatedUserId) {
  await requireOwnedTrackedProduct(trackedProductId, authenticatedUserId);
  const alerts = await findPriceAlertsForTrackedProduct(trackedProductId);

  return alerts.map(mapPriceAlert);
}

export async function updatePriceAlertStatusForUser(
  { trackedProductId, priceAlertId, status },
  authenticatedUserId,
) {
  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const trackedProduct = await requireOwnedTrackedProductIn(
      executeQuery,
      trackedProductId,
      authenticatedUserId,
    );

    await lockProductVariantForPriceEvaluation(
      trackedProduct.product_variant_id,
      executeQuery,
    );

    const alert = await lockPriceAlert({ trackedProductId, priceAlertId }, executeQuery);

    if (!alert) {
      throw priceAlertNotFound();
    }

    if (alert.status === status) {
      return mapPriceAlert(alert);
    }

    let thresholdState = alert.last_threshold_state;

    if (status === 'ACTIVE') {
      await requireActiveAlertCapacity(authenticatedUserId, executeQuery);

      const currentPrice = await findCurrentPrice({
        productVariantId: trackedProduct.product_variant_id,
        currencyCode: alert.currency_code,
      }, executeQuery);

      if (currentPrice) {
        thresholdState = await isTargetPriceBelowCurrent({
          targetPrice: alert.target_price,
          currentPrice: currentPrice.price_amount,
        }, executeQuery)
          ? 'ABOVE_TARGET'
          : 'AT_OR_BELOW_TARGET';
      }
    }

    return mapPriceAlert(await updatePriceAlertStatus({
      priceAlertId,
      status,
      thresholdState,
    }, executeQuery));
  });
}

function mapPriceAlert(alert) {
  return {
    price_alert_id: String(alert.price_alert_id),
    tracked_product_id: String(alert.tracked_product_id),
    target_price: alert.target_price,
    currency_code: alert.currency_code,
    status: alert.status,
    created_at: isoTimestamp(alert.created_at),
  };
}

export function assemblePriceAlert({ alert, currentPrice }) {
  return {
    ...mapPriceAlert(alert),
    current_price: currentPrice.price_amount,
  };
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
