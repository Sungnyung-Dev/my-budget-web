import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateKey, dateParts, daysInMonth, isValidDate, pad, shiftMonth, todayKey, weekday } from '../src/domain/dates.ts'
import { dateLabel, formatMoney, signedMoney } from '../src/domain/formatters.ts'

test('날짜 키와 부분 값은 YYYY-MM-DD를 사용하고 오늘은 현지 날짜로 계산한다', () => {
  assert.equal(pad(1), '01')
  assert.equal(dateKey(2026, 1, 2), '2026-01-02')
  assert.deepEqual(dateParts('2026-12-31'), { year: 2026, month: 12, day: 31 })
  assert.equal(todayKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01')
  assert.equal(todayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31')
  assert.equal(weekday('2024-02-29'), '목')
})

for (const [year, month, expected] of [[2024, 2, 29], [2026, 2, 28], [1900, 2, 28], [2000, 2, 29], [2100, 2, 28], [2026, 4, 30], [2026, 12, 31]]) {
  test(`${year}년 ${month}월의 일 수는 ${expected}일`, () => assert.equal(daysInMonth(year, month), expected))
}

for (const date of ['1900-01-01', '2024-02-29', '2000-02-29', '9999-12-31']) {
  test(`유효한 날짜 ${date}`, () => assert.equal(isValidDate(date), true))
}

for (const date of ['', '2026-2-01', '2026-02-1', '2026-02-29', '1900-02-29', '2100-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32', '1899-12-31', '10000-01-01', '2026-01-01T00:00:00Z', ' 2026-01-01']) {
  test(`잘못된 날짜 ${JSON.stringify(date)}`, () => assert.equal(isValidDate(date), false))
}

for (const [date, offset, expected] of [
  ['2026-01-31', 1, '2026-02-28'], ['2024-01-31', 1, '2024-02-29'],
  ['2026-12-31', 1, '2027-01-31'], ['2026-01-31', -1, '2025-12-31'],
  ['2024-03-31', -1, '2024-02-29'], ['2026-01-31', 14, '2027-03-31'],
  ['2026-04-30', 0, '2026-04-30'],
] as const) {
  test(`${date}에서 ${offset}개월 이동 → ${expected}`, () => assert.equal(shiftMonth(date, offset), expected))
}

test('날짜와 금액의 화면 포맷팅은 숫자 집계와 분리한다', () => {
  assert.equal(formatMoney(-1234567), '1,234,567')
  assert.equal(signedMoney(-1234), '−1,234')
  assert.equal(signedMoney(1234), '+1,234')
  assert.equal(signedMoney(0), '0')
  assert.equal(dateLabel('2024-02-29'), '2024년 2월 29일 목요일')
})
