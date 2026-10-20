import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from './problems.js';
import {
  optionalString,
  parseIdentifier,
  requireDecimalString,
  requireEnum,
  requireObject,
  requireString,
  requireUrl,
} from './validation.js';

function assertInvalidRequest(operation, field, reason) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'INVALID_REQUEST');
    assert.deepEqual(error.errors, [{ field, reason }]);
    return true;
  });
}

test('request object and required string validation report field-level reasons', () => {
  assertInvalidRequest(() => requireObject(undefined), 'body', 'required');
  assertInvalidRequest(() => requireObject([]), 'body', 'expected_object');
  assertInvalidRequest(() => requireString({}, 'email'), 'email', 'required');
  assertInvalidRequest(
    () => requireString({ email: 42 }, 'email'),
    'email',
    'expected_string',
  );
  assertInvalidRequest(
    () => requireString({ email: '   ' }, 'email'),
    'email',
    'blank',
  );
  assert.equal(requireString({ email: ' User@Example.com ' }, 'email'), 'User@Example.com');
  assert.equal(optionalString({}, 'label'), undefined);
});

test('identifier validation is string-based and PostgreSQL BIGINT-safe', () => {
  assert.equal(parseIdentifier('123', 'tracked_product_id'), '123');
  assert.equal(parseIdentifier('01', 'tracked_product_id'), '01');
  assert.equal(
    parseIdentifier('9223372036854775807', 'tracked_product_id'),
    '9223372036854775807',
  );

  for (const value of ['0', '000', '-1', 'abc', '12.5', '', '9223372036854775808', null]) {
    assertInvalidRequest(
      () => parseIdentifier(value, 'tracked_product_id'),
      'tracked_product_id',
      'invalid_identifier',
    );
  }
});

test('enum, decimal and URL helpers validate syntax without applying business rules', () => {
  assert.equal(
    requireEnum({ status: 'ACTIVE' }, 'status', ['ACTIVE', 'INACTIVE']),
    'ACTIVE',
  );
  assertInvalidRequest(
    () => requireEnum({ status: 'OTHER' }, 'status', ['ACTIVE', 'INACTIVE']),
    'status',
    'unsupported_value',
  );

  assert.equal(requireDecimalString({ target_price: '-1.25' }, 'target_price'), '-1.25');
  assertInvalidRequest(
    () => requireDecimalString({ target_price: '1.234' }, 'target_price'),
    'target_price',
    'invalid_decimal',
  );

  assert.equal(
    requireUrl({ url: 'https://shop.example/product/123' }, 'url'),
    'https://shop.example/product/123',
  );
  assertInvalidRequest(
    () => requireUrl({ url: 'not-a-url' }, 'url'),
    'url',
    'invalid_url',
  );
});
