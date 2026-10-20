import { ApiError, apiClient } from '../api/client.js';

export async function getCurrentSession() {
  const response = await apiClient.get('/auth/session');
  return response?.data ?? null;
}

export async function signIn(credentials) {
  const response = await apiClient.post('/auth/login', credentials);
  return response?.data ?? null;
}

export async function signOut() {
  return apiClient.post('/auth/logout');
}

export function isAuthenticationError(error) {
  return error instanceof ApiError && error.status === 401;
}

export function isAuthenticationRequiredError(error) {
  return isAuthenticationError(error) && error.code === 'AUTHENTICATION_REQUIRED';
}
