import {
  requireDecimalString,
  requireObject,
} from '../../shared/validation.js';

export function parseCreatePriceAlertBody(value) {
  const body = requireObject(value);

  return {
    targetPrice: requireDecimalString(body, 'target_price'),
  };
}
