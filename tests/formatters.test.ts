import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatMoney, formatNumber, signedMoney } from '../src/domain/formatters.ts'

for (const [value, number, magnitude, signed] of [
  [0, '0', '0', '0'],
  [-0, '0', '0', '0'],
  [1, '1', '1', '+1'],
  [1000, '1,000', '1,000', '+1,000'],
  [10000, '10,000', '10,000', '+10,000'],
  [1000000, '1,000,000', '1,000,000', '+1,000,000'],
  [-10000, '-10,000', '10,000', '−10,000'],
  [Number.MAX_SAFE_INTEGER, '9,007,199,254,740,991', '9,007,199,254,740,991', '+9,007,199,254,740,991'],
] as const) {
  test(`표시 계약: ${Object.is(value, -0) ? '-0' : value} → ${number}`, () => {
    assert.equal(formatNumber(value), number)
    assert.equal(formatMoney(value), magnitude)
    assert.equal(signedMoney(value), signed)
  })
}
