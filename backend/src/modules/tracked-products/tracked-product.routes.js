import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { createTrackedProductForUser } from './tracked-product.service.js';
import { parseCreateTrackedProductBody } from './tracked-product.validation.js';

const router = Router();

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
