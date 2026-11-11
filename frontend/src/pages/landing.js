import { initializePageShell } from '../components/common.js';
import {
  getCurrentSession,
  register,
  signIn,
} from '../auth/session.js';
import { toErrorState } from '../utils/errors.js';
import { getSafeNextPath } from '../utils/helpers.js';

initializePageShell();

const MIN_PASSWORD_LENGTH = 8;
const SERVER_MESSAGE_CODES = new Set([
  'INVALID_REQUEST',
  'EMAIL_ALREADY_REGISTERED',
  'TOO_MANY_REQUESTS',
]);
const nextPath = getSafeNextPath(window.location.search);
const openSignInButton = document.querySelector('#open-signin');
const openRegisterButton = document.querySelector('#open-register');

function field(inputId) {
  return {
    input: document.querySelector(`#${inputId}`),
    feedback: document.querySelector(`#${inputId}-feedback`),
  };
}

const signInView = {
  dialog: document.querySelector('#signin-dialog'),
  form: document.querySelector('#signin-form'),
  status: document.querySelector('#signin-status'),
  submitButton: document.querySelector('#signin-submit'),
  idleLabel: 'Sign in',
  pendingLabel: 'Signing in…',
  lockedSeconds: 0,
  lockoutTimer: null,
  fields: {
    email: field('email'),
    password: field('password'),
  },
};

const registerView = {
  dialog: document.querySelector('#register-dialog'),
  form: document.querySelector('#register-form'),
  status: document.querySelector('#register-status'),
  submitButton: document.querySelector('#register-submit'),
  idleLabel: 'Create account',
  pendingLabel: 'Creating account…',
  lockedSeconds: 0,
  lockoutTimer: null,
  fields: {
    displayName: field('register-name'),
    email: field('register-email'),
    password: field('register-password'),
  },
};

let isSubmitting = false;
let returnFocusTo = openSignInButton;

function setFieldError({ input, feedback }, message = '') {
  if (!input || !feedback) {
    return;
  }

  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  feedback.textContent = message;
}

function setStatus(view, message = '', kind = '') {
  view.status.className = `status${kind ? ` status--${kind}` : ''}`;
  view.status.textContent = message;
}

function resetFeedback(view) {
  Object.values(view.fields).forEach((entry) => setFieldError(entry));
  setStatus(view);
}

function collectErrors(view, checks) {
  let firstInvalidField = null;

  resetFeedback(view);
  checks.forEach(([entry, message]) => {
    if (message) {
      setFieldError(entry, message);
      firstInvalidField ??= entry.input;
    }
  });
  firstInvalidField?.focus();

  return firstInvalidField === null;
}

function emailError({ input }) {
  if (!input.value.trim()) {
    return 'Enter your email address.';
  }

  return input.validity.typeMismatch ? 'Enter a valid email address.' : '';
}

function validateSignIn() {
  const { email, password } = signInView.fields;
  const isValid = collectErrors(signInView, [
    [email, emailError(email)],
    [password, password.input.value ? '' : 'Enter your password.'],
  ]);

  return isValid
    ? { email: email.input.value.trim(), password: password.input.value }
    : null;
}

function validateRegistration() {
  const { displayName, email, password } = registerView.fields;
  const isValid = collectErrors(registerView, [
    [displayName, displayName.input.value.trim() ? '' : 'Enter your name.'],
    [email, emailError(email)],
    [
      password,
      password.input.value.length >= MIN_PASSWORD_LENGTH
        ? ''
        : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    ],
  ]);

  return isValid
    ? {
        display_name: displayName.input.value.trim(),
        email: email.input.value.trim(),
        password: password.input.value,
      }
    : null;
}

function setSubmitting(view, isPending) {
  isSubmitting = isPending;
  view.form.setAttribute('aria-busy', String(isPending));
  view.submitButton.disabled = isPending || view.lockedSeconds > 0;
  view.submitButton.textContent = isPending ? view.pendingLabel : view.idleLabel;
}

function formatCountdown(totalSeconds) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// The server rejects every attempt until its window closes, so hold the form
// shut for the same period instead of inviting another refused submission.
function startLockout(view, seconds) {
  clearInterval(view.lockoutTimer);
  view.lockedSeconds = seconds;

  const tick = () => {
    if (view.lockedSeconds <= 0) {
      clearInterval(view.lockoutTimer);
      view.lockoutTimer = null;
      setStatus(view, 'You can try again now.');
      setSubmitting(view, false);
      return;
    }

    setStatus(
      view,
      `Too many attempts. Try again in ${formatCountdown(view.lockedSeconds)}.`,
      'error',
    );
    view.lockedSeconds -= 1;
  };

  tick();
  view.lockoutTimer = setInterval(tick, 1000);
  setSubmitting(view, false);
}

function getAuthErrorMessage(error) {
  const errorState = toErrorState(error);

  if (errorState.code === 'INVALID_CREDENTIALS') {
    return 'Invalid email or password.';
  }

  if (SERVER_MESSAGE_CODES.has(errorState.code)) {
    return errorState.message;
  }

  if (errorState.isNetworkError) {
    return 'PriceLens could not reach the account service. Please try again.';
  }

  return 'PriceLens could not complete the request. Please try again.';
}

function openView(view, trigger) {
  [signInView, registerView]
    .filter((other) => other !== view && other.dialog.open)
    .forEach((other) => other.dialog.close());

  returnFocusTo = trigger ?? returnFocusTo;
  resetFeedback(view);
  view.dialog.showModal();
  Object.values(view.fields)[0].input.focus();
}

async function handleSubmit(view, validate, submitRequest) {
  if (isSubmitting || view.lockedSeconds > 0) {
    return;
  }

  const details = validate();

  if (!details) {
    return;
  }

  let didAuthenticate = false;
  setSubmitting(view, true);
  setStatus(view, view.pendingLabel);

  try {
    await submitRequest(details);
    didAuthenticate = true;
    window.location.assign(nextPath);
  } catch (error) {
    const errorState = toErrorState(error);

    if (view === signInView) {
      view.fields.password.input.value = '';
    }

    if (errorState.code === 'TOO_MANY_REQUESTS' && errorState.retryAfterSeconds) {
      startLockout(view, errorState.retryAfterSeconds);
    } else {
      setStatus(view, getAuthErrorMessage(error), 'error');
    }
  } finally {
    if (!didAuthenticate) {
      setSubmitting(view, false);
    }
  }
}

async function restoreExistingSession() {
  try {
    if (await getCurrentSession()) {
      window.location.assign(nextPath);
      return;
    }
  } catch {
    // A restoration failure must not prevent a guest from using the sign-in form.
  }

  if (new URLSearchParams(window.location.search).has('next')) {
    openView(signInView, openSignInButton);
    setStatus(signInView, 'Sign in to continue.');
  }
}

[signInView, registerView].forEach((view) => {
  view.dialog.addEventListener('click', (event) => {
    if (event.target === view.dialog) {
      view.dialog.close();
    }
  });

  view.dialog.addEventListener('close', () => {
    view.fields.password.input.value = '';

    if (![signInView, registerView].some((other) => other.dialog.open)) {
      returnFocusTo?.focus();
    }
  });
});

openSignInButton?.addEventListener('click', () => openView(signInView, openSignInButton));
openRegisterButton?.addEventListener('click', () => openView(registerView, openRegisterButton));
document.querySelector('#switch-to-register')?.addEventListener('click', () => openView(registerView));
document.querySelector('#switch-to-signin')?.addEventListener('click', () => openView(signInView));
document.querySelector('#close-signin')?.addEventListener('click', () => signInView.dialog.close());
document.querySelector('#close-register')?.addEventListener('click', () => registerView.dialog.close());

signInView.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void handleSubmit(signInView, validateSignIn, signIn);
});

registerView.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void handleSubmit(registerView, validateRegistration, register);
});

void restoreExistingSession();
