import { initializePageShell } from '../components/common.js';

initializePageShell();

const dialog = document.querySelector('#signin-dialog');
const openButton = document.querySelector('#open-signin');
const closeButton = document.querySelector('#close-signin');
const signInForm = document.querySelector('#signin-form');

openButton?.addEventListener('click', () => {
  dialog?.showModal();
  document.querySelector('#email')?.focus();
});

closeButton?.addEventListener('click', () => dialog?.close());

dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

dialog?.addEventListener('close', () => openButton?.focus());

signInForm?.addEventListener('submit', (event) => {
  event.preventDefault();
});
