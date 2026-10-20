import { apiRequest } from '../api/client.js';

let currentUser = null;

export async function login(email, password) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  currentUser = response.data;
  return currentUser;
}

export async function getSession() {
  const response = await apiRequest('/auth/session');
  currentUser = response.data;
  return currentUser;
}

export async function logout() {
  await apiRequest('/auth/logout', { method: 'POST' });
  currentUser = null;
}
