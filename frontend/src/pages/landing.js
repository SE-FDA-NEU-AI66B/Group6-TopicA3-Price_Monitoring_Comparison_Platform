import { initializePageShell } from '../components/common.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  signIn,
} from '../auth/session.js';
import { toErrorState } from '../utils/errors.js';

initializePageShell();

const dialog = document.querySelector('#signin-dialog');
const openButton = document.querySelector('#open-signin');
const closeButton = document.querySelector('#close-signin');
const signInForm = document.querySelector('#signin-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const emailFeedback = document.querySelector('#email-feedback');
const passwordFeedback = document.querySelector('#password-feedback');
const signInStatus = document.querySelector('#signin-status');
const submitButton = document.querySelector('#signin-submit');
let isSubmitting = false;

function setFieldError(input, feedback, message = '') {
  if (!input || !feedback) {
    return;
  }

  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  feedback.textContent = message;
}

function resetFeedback() {
  setFieldError(emailInput, emailFeedback);
  setFieldError(passwordInput, passwordFeedback);

  if (signInStatus) {
    signInStatus.className = 'status';
    signInStatus.textContent = '';
  }
}

function validateCredentials() {
  const email = emailInput?.value.trim() ?? '';
  const password = passwordInput?.value ?? '';
  let firstInvalidField = null;

  resetFeedback();

  if (!email) {
    setFieldError(emailInput, emailFeedback, 'Enter your email address.');
    firstInvalidField = emailInput;
  } else if (emailInput?.validity.typeMismatch) {
    setFieldError(emailInput, emailFeedback, 'Enter a valid email address.');
    firstInvalidField = emailInput;
  }

  if (!password) {
    setFieldError(passwordInput, passwordFeedback, 'Enter your password.');
    firstInvalidField ??= passwordInput;
  }

  if (firstInvalidField) {
    firstInvalidField.focus();
    return null;
  }

  return { email, password };
}

function setSubmitting(isPending) {
  isSubmitting = isPending;
  signInForm?.setAttribute('aria-busy', String(isPending));

  if (submitButton) {
    submitButton.disabled = isPending;
    submitButton.textContent = isPending ? 'Signing in…' : 'Sign in';
  }
}

function getLoginErrorMessage(error) {
  const errorState = toErrorState(error);

  if (errorState.code === 'INVALID_CREDENTIALS') {
    return 'Invalid email or password.';
  }

  if (errorState.code === 'INVALID_REQUEST') {
    return errorState.message;
  }

  if (errorState.isNetworkError) {
    return 'PriceLens could not reach the sign-in service. Please try again.';
  }

  return 'PriceLens could not sign you in. Please try again.';
}

async function restoreExistingSession() {
  try {
    const user = await getCurrentSession();

    if (user) {
      window.location.assign('/watchlist');
    }
  } catch (error) {
    if (!isAuthenticationRequiredError(error)) {
      // A restoration failure must not prevent a guest from using the sign-in form.
    }
  }
}

openButton?.addEventListener('click', () => {
  resetFeedback();
  dialog?.showModal();
  emailInput?.focus();
});

closeButton?.addEventListener('click', () => dialog?.close());

dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

dialog?.addEventListener('close', () => {
  if (passwordInput) {
    passwordInput.value = '';
  }

  openButton?.focus();
});

signInForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const credentials = validateCredentials();

  if (!credentials) {
    return;
  }

  let didAuthenticate = false;
  setSubmitting(true);

  if (signInStatus) {
    signInStatus.textContent = 'Signing in…';
  }

  try {
    await signIn(credentials);
    didAuthenticate = true;

    if (passwordInput) {
      passwordInput.value = '';
    }

    window.location.assign('/watchlist');
  } catch (error) {
    if (signInStatus) {
      signInStatus.className = 'status status--error';
      signInStatus.textContent = getLoginErrorMessage(error);
    }
  } finally {
    if (!didAuthenticate) {
      setSubmitting(false);
    }
  }
});

void restoreExistingSession();
