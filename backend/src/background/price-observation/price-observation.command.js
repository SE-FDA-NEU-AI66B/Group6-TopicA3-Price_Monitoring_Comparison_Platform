import { closePool } from '../../db/pool.js';
import { processPriceObservation } from './price-observation.processor.js';
import { findOfferByNormalizedUrl } from './price-observation.repository.js';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const offer = await findOfferByNormalizedUrl(options.normalizedUrl);

  if (!offer) {
    throw new Error('Exactly one retailer offer must match --url.');
  }

  const result = await processPriceObservation({
    retailerOfferId: offer.retailer_offer_id,
    acquisitionStatus: 'SUCCEEDED',
    priceAmount: options.priceAmount,
    currencyCode: options.currencyCode,
    availabilityStatus: options.availabilityStatus,
    observedAt: options.observedAt === 'now'
      ? new Date().toISOString()
      : options.observedAt,
  });

  console.log(JSON.stringify({
    normalizedUrl: offer.normalized_url,
    ...result,
  }, null, 2));
}

function parseArguments(argumentsList) {
  const values = new Map();

  for (const argument of argumentsList) {
    const separator = argument.indexOf('=');

    if (!argument.startsWith('--') || separator < 3) {
      throw new Error(`Invalid argument: ${argument}`);
    }

    const name = argument.slice(2, separator);
    const value = argument.slice(separator + 1);

    if (values.has(name)) {
      throw new Error(`Duplicate argument: --${name}`);
    }

    values.set(name, value);
  }

  const allowedNames = new Set([
    'url',
    'amount',
    'currency',
    'availability',
    'observed-at',
  ]);

  for (const name of values.keys()) {
    if (!allowedNames.has(name)) {
      throw new Error(`Unknown argument: --${name}`);
    }
  }

  const requiredNames = ['url', 'amount', 'observed-at'];

  for (const name of requiredNames) {
    if (!values.get(name)) {
      throw new Error(`Missing required argument: --${name}`);
    }
  }

  return {
    normalizedUrl: values.get('url'),
    priceAmount: values.get('amount'),
    currencyCode: values.get('currency') || 'VND',
    availabilityStatus: values.get('availability') || 'IN_STOCK',
    observedAt: values.get('observed-at'),
  };
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
