import { withTransaction } from '../../db/pool.js';
import {
  activeAlertLimitReached,
  authenticationRequired,
  currentPriceUnavailable,
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
  insertPriceAlert,
  isPositiveTargetPrice,
  isTargetPriceBelowCurrent,
  lockUserForAlertCreation,
} from './price-alert.repository.js';
import { findOwnedTrackedProduct } from './tracked-product.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

export const MAX_ACTIVE_ALERTS = 20;

export async function createPriceAlertForUser(
  trackedProductId,
  authenticatedUserId,
  targetPrice,
) {
  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const trackedProduct = await requireOwnedTrackedProduct(
      trackedProductId,
      authenticatedUserId,
      (id, userId) => findOwnedTrackedProduct(id, userId, executeQuery),
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

    const alert = await insertPriceAlert({
      trackedProductId,
      targetPrice,
      currencyCode: currentPrice.currency_code,
      priceObservationId: currentPrice.price_observation_id,
    }, executeQuery);

    return assemblePriceAlert({ alert, currentPrice });
  });
}

export function assemblePriceAlert({ alert, currentPrice }) {
  return {
    price_alert_id: String(alert.price_alert_id),
    tracked_product_id: String(alert.tracked_product_id),
    target_price: alert.target_price,
    currency_code: alert.currency_code,
    status: alert.status,
    current_price: currentPrice.price_amount,
    created_at: isoTimestamp(alert.created_at),
  };
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
