import { API_BASE_URL } from '../config.js';

const GENERIC_CLIENT_DETAIL = 'PriceLens could not complete the request. Please try again.';

export class ApiError extends Error {
  constructor({
    status = 0,
    code = 'CLIENT_ERROR',
    detail = GENERIC_CLIENT_DETAIL,
    fieldErrors = null,
  } = {}) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

function endpointUrl(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw new ApiError();
  }

  return `${API_BASE_URL}/${endpoint.replace(/^\/+/, '')}`;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      detail: GENERIC_CLIENT_DETAIL,
    });
  }
}

export async function apiRequest(endpoint, {
  method = 'GET',
  body,
  headers = {},
} = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json, application/problem+json');

  const requestOptions = {
    method,
    credentials: 'include',
    headers: requestHeaders,
  };

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestOptions.body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(endpointUrl(endpoint), requestOptions);
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      detail: GENERIC_CLIENT_DETAIL,
    });
  }

  if (response.status === 204) {
    return null;
  }

  if (response.ok) {
    return parseJson(response);
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.toLowerCase().includes('application/problem+json')) {
    const problem = await parseJson(response);

    throw new ApiError({
      status: response.status,
      code: typeof problem.code === 'string' ? problem.code : 'CLIENT_ERROR',
      detail: typeof problem.detail === 'string'
        ? problem.detail
        : GENERIC_CLIENT_DETAIL,
      fieldErrors: problem.field_errors ?? problem.errors ?? null,
    });
  }

  throw new ApiError({
    status: response.status,
    code: 'INVALID_RESPONSE',
    detail: GENERIC_CLIENT_DETAIL,
  });
}
