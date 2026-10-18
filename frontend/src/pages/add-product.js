import { initializePageShell } from '../components/common.js';

initializePageShell();

document.querySelector('#product-url-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
});
