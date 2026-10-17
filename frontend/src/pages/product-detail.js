import { initializePageShell, renderRouteError } from '../components/common.js';
import { getProductIdFromPathname, setTextContent } from '../utils/helpers.js';

initializePageShell();

const productId = getProductIdFromPathname(window.location.pathname);

if (productId) {
  setTextContent('[data-product-id]', productId);
  document.querySelector('[data-compare-link]')?.setAttribute(
    'href',
    `/products/${encodeURIComponent(productId)}/compare`,
  );
} else {
  renderRouteError('This product route does not contain a valid product ID.');
}

document.querySelector('#alert-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
});
