import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { getWatchlistItemForUser } from '../watchlist/watchlist.service.js';
import { getOfferComparisonForUser } from './offer-comparison.service.js';
import {
  createPriceAlertForUser,
  listPriceAlertsForUser,
  updatePriceAlertStatusForUser,
} from './price-alert.service.js';
import {
  parseCreatePriceAlertBody,
  parsePriceAlertId,
  parseUpdatePriceAlertBody,
} from './price-alert.validation.js';
import { getPriceHistoryForUser } from './price-history.service.js';
import { exportPriceHistoryForUser } from './price-history-export.service.js';
import {
  createTrackedProductForUser,
  deleteTrackedProductForUser,
} from './tracked-product.service.js';
import {
  parseCreateTrackedProductBody,
  parseTrackedProductId,
} from './tracked-product.validation.js';

const router = Router();

router.get('/:tracked_product_id/alerts', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const data = await listPriceAlertsForUser(
      trackedProductId,
      request.user.user_id,
    );

    response.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:tracked_product_id/alerts', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const { targetPrice } = parseCreatePriceAlertBody(request.body);
    const data = await createPriceAlertForUser(
      trackedProductId,
      request.user.user_id,
      targetPrice,
    );

    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:tracked_product_id/alerts/:price_alert_id', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const priceAlertId = parsePriceAlertId(request.params.price_alert_id);
    const { status } = parseUpdatePriceAlertBody(request.body);
    const data = await updatePriceAlertStatusForUser(
      { trackedProductId, priceAlertId, status },
      request.user.user_id,
    );

    response.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:tracked_product_id/offers', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const data = await getOfferComparisonForUser(
      trackedProductId,
      request.user.user_id,
    );

    response.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:tracked_product_id/price-history/export', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const { filename, csv } = await exportPriceHistoryForUser(
      trackedProductId,
      request.user.user_id,
    );

    response
      .status(200)
      .type('text/csv; charset=utf-8')
      .attachment(filename)
      .send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/:tracked_product_id/price-history', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const data = await getPriceHistoryForUser(
      trackedProductId,
      request.user.user_id,
    );

    response.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:tracked_product_id', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    const data = await getWatchlistItemForUser(
      trackedProductId,
      request.user.user_id,
    );

    response.json({ data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:tracked_product_id', authenticate, async (
  request,
  response,
  next,
) => {
  try {
    const trackedProductId = parseTrackedProductId(
      request.params.tracked_product_id,
    );
    await deleteTrackedProductForUser(trackedProductId, request.user.user_id);

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (request, response, next) => {
  try {
    const { retailerOfferId } = parseCreateTrackedProductBody(request.body);
    const data = await createTrackedProductForUser(
      retailerOfferId,
      request.user.user_id,
    );

    response
      .location(`/api/tracked-products/${data.tracked_product_id}`)
      .status(201)
      .json({ data });
  } catch (error) {
    next(error);
  }
});

export { router as trackedProductRouter };
