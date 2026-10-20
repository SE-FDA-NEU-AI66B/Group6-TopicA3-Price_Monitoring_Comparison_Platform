import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productSourceRouter } from './modules/product-sources/product-source.routes.js';
import { trackedProductRouter } from './modules/tracked-products/tracked-product.routes.js';
import { watchlistRouter } from './modules/watchlist/watchlist.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/product-sources', productSourceRouter);
app.use('/api/tracked-products', trackedProductRouter);

app.use(errorHandler);
