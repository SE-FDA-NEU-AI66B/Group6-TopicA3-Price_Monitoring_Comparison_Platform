import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { getOfferComparisonForUser } from './offer-comparison.service.js';
import { getPriceHistoryForUser } from './price-history.service.js';
import { createTrackedProductForUser } from './tracked-product.service.js';
import {
  parseCreateTrackedProductBody,
  parseTrackedProductId,
} from './tracked-product.validation.js';

const router = Router();

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
