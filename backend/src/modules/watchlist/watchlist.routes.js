import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { getWatchlistForUser } from './watchlist.service.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try {
    const data = await getWatchlistForUser(request.user.user_id);

    response.status(200).json({ data, meta: { count: data.length } });
  } catch (error) {
    next(error);
  }
});

export { router as watchlistRouter };
