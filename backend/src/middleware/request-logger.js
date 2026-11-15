const SENSITIVE_KEY_PATTERN =
  /^(?:password|password_hash|pass|secret|token|access_token|refresh_token|session|session_id|cookie|set-cookie|authorization|database_url|connectionstring|email|client_ip|ip)$/i;

const CONNECTION_URI_PATTERN =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi;

const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const KEY_VALUE_SECRET_PATTERN =
  /\b(password|passwd|pwd|secret|token|cookie|authorization|api[_-]?key)\s*([:=])\s*([^\s,&;]+)/gi;

export function sanitizeLogPath(rawUrlOrPath) {
  if (typeof rawUrlOrPath !== 'string' || rawUrlOrPath.length === 0) {
    return '/';
  }

  const queryIndex = rawUrlOrPath.indexOf('?');
  const pathOnly = queryIndex >= 0 ? rawUrlOrPath.slice(0, queryIndex) : rawUrlOrPath;
  return pathOnly || '/';
}

export function sanitizeLogText(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(CONNECTION_URI_PATTERN, '[REDACTED_DATABASE_URI]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(KEY_VALUE_SECRET_PATTERN, '$1$2[REDACTED]');
}

export function redactSensitiveFields(input, seen = new WeakSet()) {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return sanitizeLogText(input);
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (seen.has(input)) {
    return '[Circular]';
  }
  seen.add(input);

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveFields(item, seen));
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSensitiveFields(value, seen);
    }
  }

  return output;
}

export function createOperationalMonitor() {
  const state = {
    totalRequests: 0,
    clientErrors: 0,
    serverErrors: 0,
    unexpectedErrors: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    maxDurationMs: 0,
  };

  return {
    recordRequest({ statusCode, durationMs }) {
      const numericDuration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
      state.totalRequests += 1;
      state.totalDurationMs += numericDuration;
      state.lastDurationMs = Number(numericDuration.toFixed(2));
      if (numericDuration > state.maxDurationMs) {
        state.maxDurationMs = Number(numericDuration.toFixed(2));
      }

      if (statusCode >= 500) {
        state.serverErrors += 1;
      } else if (statusCode >= 400) {
        state.clientErrors += 1;
      }
    },

    recordUnexpectedError() {
      state.unexpectedErrors += 1;
    },

    snapshot() {
      const errorCount = state.clientErrors + state.serverErrors;
      const errorRate = state.totalRequests > 0
        ? Number((errorCount / state.totalRequests).toFixed(4))
        : 0;
      const serverErrorRate = state.totalRequests > 0
        ? Number((state.serverErrors / state.totalRequests).toFixed(4))
        : 0;
      const avgDurationMs = state.totalRequests > 0
        ? Number((state.totalDurationMs / state.totalRequests).toFixed(2))
        : 0;

      return {
        total_requests: state.totalRequests,
        client_errors: state.clientErrors,
        server_errors: state.serverErrors,
        unexpected_errors: state.unexpectedErrors,
        error_rate: errorRate,
        server_error_rate: serverErrorRate,
        last_duration_ms: state.lastDurationMs,
        avg_duration_ms: avgDurationMs,
        max_duration_ms: state.maxDurationMs,
      };
    },

    reset() {
      state.totalRequests = 0;
      state.clientErrors = 0;
      state.serverErrors = 0;
      state.unexpectedErrors = 0;
      state.totalDurationMs = 0;
      state.lastDurationMs = 0;
      state.maxDurationMs = 0;
    },
  };
}

export const operationalMonitor = createOperationalMonitor();

export function createRequestLogger({
  monitor = operationalMonitor,
  logger = console,
  slowThresholdMs = 1000,
  nowFn = () => performance.now(),
} = {}) {
  return function requestLoggerMiddleware(request, response, next) {
    const startTime = nowFn();

    response.on('finish', () => {
      const elapsedMs = Number(Math.max(0, nowFn() - startTime).toFixed(2));
      const statusCode = response.statusCode ?? 200;

      monitor.recordRequest({
        statusCode,
        durationMs: elapsedMs,
      });

      const entry = {
        method: request.method,
        path: sanitizeLogPath(request.originalUrl ?? request.url),
        status: statusCode,
        duration_ms: elapsedMs,
      };

      if (statusCode >= 500) {
        logger.error('HTTP 5xx server error response', entry);
      } else if (elapsedMs >= slowThresholdMs) {
        logger.warn('Slow HTTP response detected', entry);
      }
    });

    next();
  };
}
