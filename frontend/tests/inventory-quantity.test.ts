import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatInventoryQuantity,
  inventoryQuantityInputProps,
} from '../src/utils/inventoryQuantity.ts';

test('inventory quantities remove padding and use Vietnamese decimal and grouping separators', () => {
  for (const [value, expected] of [
    ['155.00', '155'],
    ['10.00', '10'],
    ['0.00', '0'],
    ['10.50', '10,5'],
    ['1500.25', '1.500,25'],
    ['0.01', '0,01'],
    ['999999999999.99', '999.999.999.999,99'],
  ])
    assert.equal(formatInventoryQuantity(value), expected);
});

test('stock movement quantities preserve negative amounts and normalize negative zero', () => {
  assert.equal(formatInventoryQuantity('-1500.25'), '-1.500,25');
  assert.equal(formatInventoryQuantity(-0), '0');
  assert.equal(formatInventoryQuantity('-0.00'), '0');
  assert.equal(formatInventoryQuantity(0.3 - 0.1), '0,2');
});

test('missing or invalid stock values remain distinguishable from zero', () => {
  for (const value of [
    null,
    undefined,
    '',
    '  ',
    'invalid',
    Number.NaN,
    Infinity,
  ])
    assert.equal(formatInventoryQuantity(value), '—');
  assert.equal(formatInventoryQuantity(0), '0');
});

test('quantity inputs keep unfinished editing text and format completed values', () => {
  const { formatter, decimalSeparator } = inventoryQuantityInputProps;
  assert.equal(decimalSeparator, ',');
  for (const input of ['', '10,', '10,50', '10.5'])
    assert.equal(formatter(10.5, { userTyping: true, input }), input);
  assert.equal(formatter(155, { userTyping: false, input: '155.00' }), '155');
  assert.equal(formatter(1500.25, { userTyping: false, input: '' }), '1500,25');
  assert.equal(formatter(undefined, { userTyping: false, input: '' }), '');
  assert.equal(formatter(10.5, { userTyping: false, input: '' }), '10,5');
});
