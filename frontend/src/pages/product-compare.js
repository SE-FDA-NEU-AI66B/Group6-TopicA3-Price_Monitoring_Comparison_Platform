import { initializePageShell, renderRouteError } from '../components/common.js';
import { getProductIdFromPathname, setTextContent } from '../utils/helpers.js';

initializePageShell();

const productId = getProductIdFromPathname(window.location.pathname);

if (productId) {
  setTextContent('[data-product-id]', productId);
  document.querySelector('[data-product-link]')?.setAttribute(
    'href',
    `/products/${encodeURIComponent(productId)}`,
  );
} else {
  renderRouteError('This comparison route does not contain a valid product ID.');
}
