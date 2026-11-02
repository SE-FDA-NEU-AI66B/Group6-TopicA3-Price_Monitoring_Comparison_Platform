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
