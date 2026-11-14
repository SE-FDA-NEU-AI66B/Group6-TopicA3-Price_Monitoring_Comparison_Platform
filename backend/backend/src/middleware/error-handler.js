import { config } from '../config.js';
import {
  HttpError,
  internalServerError,
  invalidRequest,
} from '../shared/problems.js';

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  let problem = error;

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    problem = invalidRequest(
      'The request body must contain valid JSON.',
      [{ field: 'body', reason: 'invalid_json' }],
    );
  }

  if (!(problem instanceof HttpError)) {
    logUnexpectedError(error, request);
    problem = internalServerError(error);
  } else if (problem.code === 'INTERNAL_SERVER_ERROR' && problem.cause) {
    logUnexpectedError(problem.cause, request);
  }

  const body = {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    code: problem.code,
    detail: problem.detail,
  };

  if (problem.errors?.length) {
    body.errors = problem.errors;
  }

  response
    .status(problem.status)
    .type('application/problem+json')
    .json(body);
}

function configForLog() {
  return config.nodeEnv !== 'production';
}

function logUnexpectedError(error, request) {
  console.error('Unexpected request failure', {
    method: request.method,
    path: request.originalUrl,
    name: error.name,
    code: error.code,
    message: error.message,
    stack: configForLog() ? error.stack : undefined,
  });
}
