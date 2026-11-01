import {
  parseIdentifier,
  requireDecimalString,
  requireEnum,
  requireObject,
} from '../../shared/validation.js';

export function parseCreatePriceAlertBody(value) {
  const body = requireObject(value);

  return {
    targetPrice: requireDecimalString(body, 'target_price'),
  };
}

export function parseUpdatePriceAlertBody(value) {
  const body = requireObject(value);

  return {
    status: requireEnum(body, 'status', ['ACTIVE', 'INACTIVE']),
  };
}

export function parsePriceAlertId(value) {
  return parseIdentifier(value, 'price_alert_id');
}
