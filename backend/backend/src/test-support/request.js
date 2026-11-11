import { SESSION_COOKIE_NAME } from '../middleware/authenticate.js';

export async function requestJson(baseUrl, path, options = {}) {
  const {
    method = 'GET',
    headers: suppliedHeaders = {},
    cookie,
    json,
    body: suppliedBody,
  } = options;

  if (json !== undefined && suppliedBody !== undefined) {
    throw new TypeError('requestJson accepts either json or body, not both.');
  }

  const headers = new Headers(suppliedHeaders);

  if (cookie) {
    headers.set('cookie', cookie);
  }

  let body = suppliedBody;

  if (json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }

  const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`);
  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  let responseBody = null;

  if (text !== '') {
    try {
      responseBody = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Expected a JSON response from ${method} ${url.pathname}, received ${response.headers.get('content-type') ?? 'no content type'}.`,
        { cause: error },
      );
    }
  }

  return {
    response,
    status: response.status,
    headers: response.headers,
    body: responseBody,
    text,
  };
}

export async function loginAs(baseUrl, credentials) {
  const result = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST',
    json: credentials,
  });

  if (result.status !== 200) {
    throw new Error(
      `Real login failed with ${result.status}${result.body?.code ? ` ${result.body.code}` : ''}.`,
    );
  }

  const cookie = sessionCookieFrom(result.response);

  if (!cookie) {
    throw new Error(`Login response did not set ${SESSION_COOKIE_NAME}.`);
  }

  return Object.freeze({
    baseUrl,
    cookie,
    user: result.body?.data,
  });
}

export function authenticatedRequest(session, path, options = {}) {
  if (!session?.baseUrl || !session?.cookie) {
    throw new TypeError('authenticatedRequest requires a session returned by loginAs.');
  }

  if (options.cookie !== undefined) {
    throw new TypeError('authenticatedRequest gets its cookie from the login session.');
  }

  return requestJson(session.baseUrl, path, {
    ...options,
    cookie: session.cookie,
  });
}

function sessionCookieFrom(response) {
  const setCookieValues = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  for (const setCookie of setCookieValues) {
    const match = setCookie.match(
      new RegExp(`(?:^|,\\s*)(${SESSION_COOKIE_NAME}=[^;]*)`),
    );

    if (match) {
      return match[1];
    }
  }

  return null;
}
