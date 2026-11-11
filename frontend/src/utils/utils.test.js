import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseRetryAfterSeconds } from '../api/client.js';
import { formatCurrency, getFreshnessBadge } from './format.js';
import { getSafeNextPath, parseTargetPrice } from './helpers.js';

test('target prices accept digits with separators and reject other input', () => {
  assert.equal(parseTargetPrice('14000000'), '14000000');
  assert.equal(parseTargetPrice(' 14,000,000 '), '14000000');
  assert.equal(parseTargetPrice('14000000.5'), '14000000.5');

  for (const value of ['', 'abc', '-1', '1.234', '1e6', '14.000.000']) {
    assert.equal(parseTargetPrice(value), null, value);
  }
});

test('sign-in only returns to same-site paths', () => {
  assert.equal(getSafeNextPath('?next=%2Fproducts%2F3'), '/products/3');
  assert.equal(getSafeNextPath('?next=%2Fproducts%2Fadd%3Fx%3D1'), '/products/add?x=1');

  for (const search of [
    '',
    '?next=https%3A%2F%2Fevil.example',
    '?next=%2F%2Fevil.example',
    '?next=%2F%5Cevil.example',
    '?next=%2F',
  ]) {
    assert.equal(getSafeNextPath(search), '/watchlist', search);
  }
});

test('freshness badges match the watchlist and detail wording', () => {
  assert.deepEqual(getFreshnessBadge('STALE'), { label: 'Stale data', modifier: 'badge--warning' });
  assert.deepEqual(getFreshnessBadge('UNAVAILABLE'), { label: 'Unavailable', modifier: 'badge--neutral' });
  assert.deepEqual(getFreshnessBadge('CURRENT'), { label: 'Current', modifier: '' });
});

test('a lockout countdown only starts from a usable Retry-After header', () => {
  assert.equal(parseRetryAfterSeconds('298'), 298);
  assert.equal(parseRetryAfterSeconds(' 60 '), 60);

  // Missing when CORS hides the header, and an HTTP-date form is not a countdown.
  for (const value of [null, undefined, '', '0', '-5', '12.5', 'Wed, 21 Oct 2026 07:28:00 GMT']) {
    assert.equal(parseRetryAfterSeconds(value), null, String(value));
  }
});

test('VND amounts are shown without minor units', () => {
  assert.equal(formatCurrency('34990000.00', 'VND', 'en-US'), '34,990,000 VND');
  assert.equal(formatCurrency(null, 'VND', 'en-US'), 'Price unavailable');
});

test('price axis ticks are round values that cover the whole range', async () => {
  const { getPriceAxisTicks } = await import('./helpers.js');

  assert.deepEqual(getPriceAxisTicks(20890000, 23990000), [20000000, 22000000, 24000000]);
  assert.deepEqual(getPriceAxisTicks(18200000, 18500000), [18200000, 18300000, 18400000, 18500000]);
  assert.deepEqual(getPriceAxisTicks(7800000, 8500000), [7500000, 8000000, 8500000]);
  assert.deepEqual(getPriceAxisTicks(34990000, 34990000), [34990000]);
});

test('target price example stays below the current price', async () => {
  const { getTargetPriceExample } = await import('./helpers.js');

  assert.equal(getTargetPriceExample('7950000.00'), '7100000');
  assert.equal(getTargetPriceExample('20890000.00'), '18800000');
  assert.equal(getTargetPriceExample(null), null);
});

test('API base URL uses VITE_API_BASE_URL or public origin and falls back to localhost locally', async () => {
  const { resolveApiBaseUrl } = await import('../api/client.js');

  assert.equal(
    resolveApiBaseUrl({
      envBaseUrl: 'https://pricelens-api.onrender.com/api/',
      location: { hostname: 'pricelens.vercel.app', origin: 'https://pricelens.vercel.app' },
    }),
    'https://pricelens-api.onrender.com/api',
  );
  assert.equal(
    resolveApiBaseUrl({
      envBaseUrl: '',
      location: { hostname: 'pricelens.onrender.com', origin: 'https://pricelens.onrender.com' },
    }),
    'https://pricelens.onrender.com/api',
  );
  assert.equal(
    resolveApiBaseUrl({
      envBaseUrl: 'http://localhost:3000/api',
      location: { hostname: 'pricelens.onrender.com', origin: 'https://pricelens.onrender.com' },
    }),
    'https://pricelens.onrender.com/api',
  );
  assert.equal(
    resolveApiBaseUrl({
      envBaseUrl: '',
      location: { hostname: 'localhost', origin: 'http://localhost:4173' },
    }),
    'http://localhost:3000/api',
  );
});
