import { ApiError } from '../api/client.js';

export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function isApiError(error) {
  return error instanceof ApiError;
}

export function getErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  const safeFallback = typeof fallback === 'string' && fallback.trim()
    ? fallback
    : DEFAULT_ERROR_MESSAGE;

  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return safeFallback;
}

export function getErrorCode(error) {
  if (!isApiError(error) || typeof error.code !== 'string' || !error.code.trim()) {
    return null;
  }

  return error.code;
}

export function toErrorState(error, fallback = DEFAULT_ERROR_MESSAGE) {
  return {
    message: getErrorMessage(error, fallback),
    code: getErrorCode(error),
    status: isApiError(error) ? error.status : null,
    details: isApiError(error) ? error.details : null,
    isNetworkError: isApiError(error) && error.isNetworkError,
  };
}
