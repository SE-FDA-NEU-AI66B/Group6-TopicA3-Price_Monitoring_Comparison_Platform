const LOCAL_API_BASE_URL = 'http://localhost:3000/api';
const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || LOCAL_API_BASE_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, {
    status = null,
    code = null,
    details = null,
    title = null,
    type = null,
    cause,
    isNetworkError = false,
  } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.title = title;
    this.type = type;
    this.isNetworkError = isNetworkError;
  }
}

function joinApiPath(path) {
  const normalizedPath = String(path ?? '').trim().replace(/^\/+/, '');
  return normalizedPath ? `${API_BASE_URL}/${normalizedPath}` : API_BASE_URL;
}

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isJsonContentType(contentType) {
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

async function parseResponse(response) {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text) {
    return null;
  }

  if (!isJsonContentType(contentType)) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ApiError('The PriceLens API returned an invalid response.', {
      status: response.status,
      cause,
    });
  }
}

function createHttpError(response, payload) {
  const problem = payload && typeof payload === 'object' ? payload : {};
  const legacyError = problem.error && typeof problem.error === 'object'
    ? problem.error
    : {};

  return new ApiError(
    problem.detail
      || legacyError.message
      || problem.title
      || `Request failed with status ${response.status}.`,
    {
      status: response.status,
      code: problem.code || legacyError.code || null,
      details: problem.errors ?? problem.details ?? legacyError.details ?? null,
      title: problem.title || legacyError.title || null,
      type: problem.type || legacyError.type || null,
    },
  );
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const hasBody = body !== undefined;
  const hasJsonBody = hasBody && !isFormData(body);

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json, application/problem+json');
  }

  if (hasJsonBody && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response;

  try {
    const fetchOptions = {
      ...requestOptions,
      credentials: 'include',
      headers: requestHeaders,
    };

    if (hasBody) {
      fetchOptions.body = hasJsonBody ? JSON.stringify(body) : body;
    }

    response = await fetch(joinApiPath(path), fetchOptions);
  } catch (cause) {
    throw new ApiError('Unable to reach the PriceLens API.', {
      cause,
      isNetworkError: true,
    });
  }

  let payload;

  try {
    payload = await parseResponse(response);
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    throw new ApiError('Unable to read the PriceLens API response.', {
      status: response.status,
      cause,
      isNetworkError: true,
    });
  }

  if (!response.ok) {
    throw createHttpError(response, payload);
  }

  return payload;
}

/**
 * Shared HTTP boundary for page modules. Pass paths relative to API_BASE_URL,
 * for example apiClient.get('/watchlist') or apiClient.post('/auth/login', body).
 */
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
