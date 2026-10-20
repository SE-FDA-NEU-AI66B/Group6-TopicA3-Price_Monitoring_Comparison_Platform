import { withTransaction } from '../../db/pool.js';
import {
  invalidRequest,
  retailerOfferNotFound,
} from '../../shared/problems.js';
import { findCurrentPrice } from '../../modules/tracked-products/price-history.repository.js';
import {
  insertOrFindPriceObservation,
  insertPendingNotification,
  isLatestObservationForOffer,
  isValidPositiveObservationAmount,
  lockActiveAlertsForEvaluation,
  lockOfferVariantContext,
  updateAlertEvaluation,
  updateOfferRefreshMetadata,
} from './price-observation.repository.js';
import { parsePriceObservationResult } from './price-observation.validation.js';

const ABOVE_TARGET = 'ABOVE_TARGET';
const AT_OR_BELOW_TARGET = 'AT_OR_BELOW_TARGET';

export async function processPriceObservation(acquisitionResult) {
  const parsed = parsePriceObservationResult(acquisitionResult);

  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const context = await lockOfferVariantContext(
      parsed.retailerOfferId,
      executeQuery,
    );

    if (!context) {
      throw retailerOfferNotFound();
    }

    if (parsed.acquisitionStatus === 'FAILED') {
      await updateOfferRefreshMetadata({
        retailerOfferId: parsed.retailerOfferId,
        observedAt: parsed.observedAt,
        acquisitionStatus: 'FAILED',
        failureReason: parsed.failureReason,
      }, executeQuery);

      return createResult({
        status: 'FAILED',
        context,
      });
    }

    if (!await isValidPositiveObservationAmount(parsed.priceAmount, executeQuery)) {
      throw invalidRequest(
        'priceAmount must be a positive value within NUMERIC(14,2) range.',
        [{ field: 'priceAmount', reason: 'invalid_amount' }],
      );
    }

    const previousCurrentPrice = await findCurrentPrice({
      productVariantId: context.product_variant_id,
      currencyCode: parsed.currencyCode,
    }, executeQuery);
    const persistence = await insertOrFindPriceObservation({
      retailerOfferId: parsed.retailerOfferId,
      priceAmount: parsed.priceAmount,
      currencyCode: parsed.currencyCode,
      availabilityStatus: parsed.availabilityStatus,
      observedAt: parsed.observedAt,
    }, executeQuery);

    if (!persistence.matchesInput) {
      throw invalidRequest(
        'An observation already exists for this offer and timestamp with different data.',
        [{ field: 'observedAt', reason: 'conflicting_observation' }],
      );
    }

    await updateOfferRefreshMetadata({
      retailerOfferId: parsed.retailerOfferId,
      observedAt: parsed.observedAt,
      acquisitionStatus: 'SUCCEEDED',
    }, executeQuery);

    const newCurrentPrice = await findCurrentPrice({
      productVariantId: context.product_variant_id,
      currencyCode: parsed.currencyCode,
    }, executeQuery);

    if (!persistence.inserted) {
      return createResult({
        status: 'DUPLICATE',
        context,
        observation: persistence.observation,
        previousCurrentPrice,
        newCurrentPrice,
      });
    }

    const isLatest = await isLatestObservationForOffer({
      retailerOfferId: parsed.retailerOfferId,
      priceObservationId: persistence.observation.price_observation_id,
    }, executeQuery);

    if (!isLatest) {
      return createResult({
        status: 'OUT_OF_ORDER',
        context,
        observation: persistence.observation,
        previousCurrentPrice,
        newCurrentPrice,
      });
    }

    const alerts = await lockActiveAlertsForEvaluation({
      productVariantId: context.product_variant_id,
      currencyCode: parsed.currencyCode,
      previousCurrentPrice: previousCurrentPrice?.price_amount ?? null,
      newCurrentPrice: newCurrentPrice?.price_amount ?? null,
    }, executeQuery);
    let notificationCount = 0;

    for (const alert of alerts) {
      const nextState = alert.new_is_at_or_below === null
        ? alert.last_threshold_state
        : alert.new_is_at_or_below
          ? AT_OR_BELOW_TARGET
          : ABOVE_TARGET;
      const isCrossing = alert.last_threshold_state === ABOVE_TARGET
        && alert.previous_is_above === true
        && alert.new_is_at_or_below === true;

      await updateAlertEvaluation({
        priceAlertId: alert.price_alert_id,
        thresholdState: nextState,
        priceObservationId: newCurrentPrice?.price_observation_id
          ?? persistence.observation.price_observation_id,
        evaluatedAt: parsed.observedAt,
      }, executeQuery);

      if (isCrossing) {
        const notification = await insertPendingNotification({
          priceAlertId: alert.price_alert_id,
          priceObservationId: persistence.observation.price_observation_id,
          recipientEmail: alert.recipient_email,
          subject: `Price Drop Alert: ${alert.product_name}`,
          qualifiedAt: parsed.observedAt,
        }, executeQuery);

        if (notification) {
          notificationCount += 1;
        }
      }
    }

    return createResult({
      status: 'PROCESSED',
      context,
      observation: persistence.observation,
      previousCurrentPrice,
      newCurrentPrice,
      evaluatedAlertCount: alerts.length,
      notificationCount,
    });
  });
}

function createResult({
  status,
  context,
  observation = null,
  previousCurrentPrice = null,
  newCurrentPrice = null,
  evaluatedAlertCount = 0,
  notificationCount = 0,
}) {
  return Object.freeze({
    status,
    retailerOfferId: context.retailer_offer_id,
    productVariantId: context.product_variant_id,
    observation: serializeObservation(observation),
    previousCurrentPrice: serializeCurrentPrice(previousCurrentPrice),
    newCurrentPrice: serializeCurrentPrice(newCurrentPrice),
    evaluatedAlertCount,
    notificationCount,
  });
}

function serializeObservation(observation) {
  if (!observation) {
    return null;
  }

  return Object.freeze({
    priceObservationId: observation.price_observation_id,
    priceAmount: observation.price_amount,
    currencyCode: observation.currency_code,
    availabilityStatus: observation.availability_status,
    observedAt: isoTimestamp(observation.observed_at),
  });
}

function serializeCurrentPrice(currentPrice) {
  if (!currentPrice) {
    return null;
  }

  return Object.freeze({
    priceObservationId: currentPrice.price_observation_id,
    priceAmount: currentPrice.price_amount,
    currencyCode: currentPrice.currency_code,
    observedAt: isoTimestamp(currentPrice.observed_at),
  });
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
