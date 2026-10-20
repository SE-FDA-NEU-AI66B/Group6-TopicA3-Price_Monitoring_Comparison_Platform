import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { resolveProductSource } from './product-source.service.js';
import { parseResolveProductSourceBody } from './product-source.validation.js';

const router = Router();

router.post('/resolve', authenticate, async (request, response, next) => {
  try {
    const { url } = parseResolveProductSourceBody(request.body);
    const data = await resolveProductSource(url);
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

export { router as productSourceRouter };
