process.env.AUTH_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  hashSyncCode,
  isValidSyncCode,
  isValidUsername,
  normalizeUsername,
  signToken,
  verifySyncCode
} = require('../lib/auth');

test('normalizes and validates sync usernames', () => {
  assert.equal(normalizeUsername('  Arpit-Plans  '), 'arpit-plans');
  assert.equal(isValidUsername('arpit_plans'), true);
  assert.equal(isValidUsername('Arpit'), false);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('name with spaces'), false);
});

test('hashes sync codes without storing the original value', () => {
  const hash = hashSyncCode('correct horse battery staple');
  assert.match(hash, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(hash.includes('correct horse'), false);
  assert.equal(verifySyncCode('correct horse battery staple', hash), true);
  assert.equal(verifySyncCode('incorrect code', hash), false);
  assert.equal(isValidSyncCode('123456'), true);
  assert.equal(isValidSyncCode('short'), false);
});

test('creates a signed, opaque account token', () => {
  const token = signToken('arpit-plans');
  assert.equal(token.split('.').length, 2);
  assert.equal(token.includes('arpit-plans'), false);
});
