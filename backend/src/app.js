import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { authRouter } from './auth/auth.routes.js';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { watchlistRouter } from './watchlist/watchlist.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/watchlist', watchlistRouter);

app.use(errorHandler);
