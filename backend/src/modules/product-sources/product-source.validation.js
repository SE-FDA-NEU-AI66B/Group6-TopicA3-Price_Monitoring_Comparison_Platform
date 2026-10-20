import { invalidProductUrl } from '../../shared/problems.js';
import {
  requireObject,
  requireString,
  requireUrl,
} from '../../shared/validation.js';

export function parseResolveProductSourceBody(value) {
  const body = requireObject(value);
  const submittedUrl = requireString(body, 'url');

  try {
    return { url: requireUrl({ url: submittedUrl }, 'url') };
  } catch (error) {
    if (error?.code === 'INVALID_REQUEST') {
      throw invalidProductUrl([
        { field: 'url', reason: 'unsupported_or_invalid' },
      ]);
    }

    throw error;
  }
}
