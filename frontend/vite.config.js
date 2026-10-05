import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function watchlistRouteMiddleware(request, response, next) {
  const url = new URL(request.url, 'http://localhost');

  if (url.pathname === '/watchlist') {
    request.url = `/watchlist/${url.search}`;
  }

  next();
}

export default defineConfig({
  envDir: resolve(projectRoot, '..'),
  plugins: [
    {
      name: 'pricelens-watchlist-route',
      configureServer(server) {
        server.middlewares.use(watchlistRouteMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(watchlistRouteMiddleware);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(projectRoot, 'index.html'),
        watchlist: resolve(projectRoot, 'watchlist/index.html'),
      },
    },
  },
});
