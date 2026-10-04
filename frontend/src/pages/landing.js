import { ApiError } from '../api/client.js';
import { getSession, login } from '../auth/session.js';

const form = document.querySelector('#sign-in-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const submitButton = document.querySelector('#sign-in-submit');
const pendingIndicator = document.querySelector('#sign-in-pending');
const formStatus = document.querySelector('#form-status');
const emailFeedback = document.querySelector('#email-feedback');
const passwordFeedback = document.querySelector('#password-feedback');

function navigateToWatchlist() {
  window.location.assign('/watchlist');
}

function setPending(isPending) {
  form.setAttribute('aria-busy', String(isPending));
  submitButton.disabled = isPending;
  pendingIndicator.hidden = !isPending;
}

function clearFeedback() {
  formStatus.textContent = '';
  formStatus.className = 'form-status';
  emailFeedback.textContent = '';
  passwordFeedback.textContent = '';
  emailInput.removeAttribute('aria-invalid');
  passwordInput.removeAttribute('aria-invalid');
}

function fieldMessages(fieldErrors, fieldName) {
  if (!fieldErrors) {
    return [];
  }

  if (Array.isArray(fieldErrors)) {
    return fieldErrors
      .filter((entry) => entry?.field === fieldName)
      .map((entry) => entry.message)
      .filter((message) => typeof message === 'string');
  }

  const value = fieldErrors[fieldName];

  if (Array.isArray(value)) {
    return value.filter((message) => typeof message === 'string');
  }

  return typeof value === 'string' ? [value] : [];
}

function showInvalidRequest(error) {
  const emailMessages = fieldMessages(error.fieldErrors, 'email');
  const passwordMessages = fieldMessages(error.fieldErrors, 'password');

  if (emailMessages.length) {
    emailFeedback.textContent = emailMessages[0];
    emailInput.setAttribute('aria-invalid', 'true');
  }

  if (passwordMessages.length) {
    passwordFeedback.textContent = passwordMessages[0];
    passwordInput.setAttribute('aria-invalid', 'true');
  }

  formStatus.textContent = emailMessages.length || passwordMessages.length
    ? 'Please correct the highlighted fields.'
    : error.detail;
  formStatus.className = 'form-status form-status--error';
}

async function restoreSession() {
  setPending(true);
  formStatus.textContent = 'Checking your session…';

  try {
    await getSession();
    navigateToWatchlist();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTHENTICATION_REQUIRED') {
      clearFeedback();
    } else {
      formStatus.textContent = 'We could not check your session. You can still sign in.';
      formStatus.className = 'form-status form-status--notice';
    }
  } finally {
    setPending(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (submitButton.disabled) {
    return;
  }

  clearFeedback();
  setPending(true);

  try {
    await login(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = '';
    navigateToWatchlist();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_REQUEST') {
      showInvalidRequest(error);
    } else if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
      formStatus.textContent = 'Invalid email or password';
      formStatus.className = 'form-status form-status--error';
    } else {
      formStatus.textContent = 'Sign-in is unavailable right now. Please try again.';
      formStatus.className = 'form-status form-status--error';
    }
  } finally {
    setPending(false);
  }
});

restoreSession();
