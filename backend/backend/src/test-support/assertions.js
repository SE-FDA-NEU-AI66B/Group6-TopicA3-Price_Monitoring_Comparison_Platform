import assert from 'node:assert/strict';

export function assertProblemResponse(result, expected = {}) {
  assert.ok(result?.response instanceof Response, 'Expected a real fetch Response.');
  assert.ok(result.body && typeof result.body === 'object', 'Expected a problem body.');
  assert.match(
    result.response.headers.get('content-type') ?? '',
    /^application\/problem\+json(?:;|$)/,
  );
  assert.equal(result.body.status, result.response.status);
  assert.equal(typeof result.body.type, 'string');
  assert.equal(typeof result.body.title, 'string');
  assert.equal(typeof result.body.status, 'number');
  assert.equal(typeof result.body.code, 'string');
  assert.equal(typeof result.body.detail, 'string');

  for (const field of ['type', 'title', 'status', 'code', 'detail']) {
    if (Object.hasOwn(expected, field)) {
      assert.deepEqual(result.body[field], expected[field]);
    }
  }

  if (Object.hasOwn(expected, 'errors')) {
    assert.deepEqual(result.body.errors, expected.errors);
  }

  if (result.body.errors !== undefined) {
    assert.ok(Array.isArray(result.body.errors));
    for (const error of result.body.errors) {
      assert.equal(typeof error?.field, 'string');
      assert.equal(typeof error?.reason, 'string');
    }
  }

  return result.body;
}

export function assertProblemCode(result, code, expected = {}) {
  return assertProblemResponse(result, { ...expected, code });
}
