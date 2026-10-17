import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function pageRouteMiddleware(request, response, next) {
  const url = new URL(request.url, 'http://localhost');
  const normalizedPath = url.pathname.length > 1
    ? url.pathname.replace(/\/+$/, '')
    : url.pathname;
  const routes = new Map([
    ['/watchlist', '/watchlist/'],
    ['/products/add', '/products/add/'],
  ]);

  if (routes.has(normalizedPath)) {
    request.url = `${routes.get(normalizedPath)}${url.search}`;
  } else if (/^\/products\/[^/]+\/compare$/.test(normalizedPath)) {
    request.url = `/products/compare.html${url.search}`;
  } else if (/^\/products\/[^/]+$/.test(normalizedPath)) {
    request.url = `/products/product.html${url.search}`;
  }

  next();
}

export default defineConfig({
  plugins: [
    {
      name: 'pricelens-page-routes',
      configureServer(server) {
        server.middlewares.use(pageRouteMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(pageRouteMiddleware);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(projectRoot, 'index.html'),
        watchlist: resolve(projectRoot, 'watchlist/index.html'),
        addProduct: resolve(projectRoot, 'products/add/index.html'),
        productDetail: resolve(projectRoot, 'products/product.html'),
        productCompare: resolve(projectRoot, 'products/compare.html'),
      },
    },
  },
});
