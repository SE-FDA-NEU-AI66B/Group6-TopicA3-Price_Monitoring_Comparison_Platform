const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || LOCAL_API_BASE_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const hasJsonBody = body !== undefined && !(body instanceof FormData);

  if (hasJsonBody && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`, {
      ...requestOptions,
      credentials: 'include',
      headers: requestHeaders,
      body: hasJsonBody ? JSON.stringify(body) : body,
    });
  } catch (cause) {
    throw new ApiError('Unable to reach the PriceLens API.', { details: cause });
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(payload?.error?.message || `Request failed with status ${response.status}.`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return payload;
}

export const apiClient = {
  get(path, options) {
    return apiRequest(path, { ...options, method: 'GET' });
  },
  post(path, body, options) {
    return apiRequest(path, { ...options, method: 'POST', body });
  },
  delete(path, options) {
    return apiRequest(path, { ...options, method: 'DELETE' });
  },
};
