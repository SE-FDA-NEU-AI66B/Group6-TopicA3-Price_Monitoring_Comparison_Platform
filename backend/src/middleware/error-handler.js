export class HttpError extends Error {
  constructor(status, code, title, detail) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.title = title;
  }
}

export function invalidRequest(detail = 'The request is invalid.') {
  return new HttpError(400, 'INVALID_REQUEST', 'Invalid request', detail);
}

export function invalidCredentials() {
  return new HttpError(
    401,
    'INVALID_CREDENTIALS',
    'Invalid credentials',
    'The supplied email or password is invalid.',
  );
}

export function authenticationRequired() {
  return new HttpError(
    401,
    'AUTHENTICATION_REQUIRED',
    'Authentication required',
    'A valid authenticated session is required.',
  );
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  let problem = error;

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    problem = invalidRequest('The request body must contain valid JSON.');
  }

  if (!(problem instanceof HttpError)) {
    console.error('Unexpected request failure', {
      method: request.method,
      path: request.originalUrl,
      name: error.name,
      code: error.code,
      message: error.message,
      stack: configForLog() ? error.stack : undefined,
    });

    problem = new HttpError(
      500,
      'INTERNAL_SERVER_ERROR',
      'Internal server error',
      'An unexpected error occurred.',
    );
  }

  response
    .status(problem.status)
    .type('application/problem+json')
    .json({
      type: `https://pricelens.local/problems/${problem.code.toLowerCase().replaceAll('_', '-')}`,
      title: problem.title,
      status: problem.status,
      code: problem.code,
      detail: problem.message,
    });
}

function configForLog() {
  return process.env.NODE_ENV !== 'production';
}
