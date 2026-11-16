import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ledgerCategories, ledgerPeriod, ledgerYear } from '../src/app/ledgerViews.ts'
import { createLargeLedger, createLedger } from './fixtures.ts'

test('월 화면에 기존 집계·최근 거래·카테고리 비율·소비 지표를 전달한다', () => {
  const view = ledgerPeriod(createLedger(), new Date(2026, 0, 1))
  assert.deepEqual(view.totals, { income: 1000, expense: 601, balance: 399 })
  assert.deepEqual(view.recent.map((row) => row.id), ['d', 'b', 'c'])
  assert.equal(view.rows.length, 4)
  assert.deepEqual(view.spending, [
    { id: 'food', name: '식비', amount: 401, share: 401 / 601 },
    { id: 'cafe', name: 'Cafe', amount: 200, share: 200 / 601 },
  ])
  assert.deepEqual(view.metrics, { count: 3, days: 2, dailyAverage: 301 })
})

test('연간 합계와 12개월 차트에서 전후 연도의 거래를 제외한다', () => {
  const ledger = createLedger()
  const year = ledgerPeriod(ledger, new Date(2026, 11, 1), 'year')
  assert.deepEqual(year.totals, { income: 1000, expense: 671, balance: 329 })
  assert.equal(year.activeMonths, 3)
  assert.equal(year.monthlyAverage, 224)
  const months = ledgerYear(ledger, 2026)
  assert.equal(months.length, 12)
  assert.deepEqual(months[0], { month: 1, count: 4, income: 1000, expense: 601, balance: 399 })
  assert.equal(months[1].expense, 50)
  assert.equal(months[10].expense, 20)
  assert.deepEqual(months[11], { month: 12, count: 0, income: 0, expense: 0, balance: 0 })
  assert.equal(ledgerPeriod(ledger, new Date(2025, 11, 1)).totals.income, 99)
  assert.equal(ledgerPeriod(ledger, new Date(2027, 0, 1)).totals.expense, 700)
})

test('정상 빈 거래와 카테고리만 있는 Ledger의 합계·소비 지표는 0이다', () => {
  for (const categories of [[], createLedger().categories]) {
    const ledger = { version: 1 as const, categories, transactions: [] }
    for (const period of ['month', 'year'] as const) {
      const view = ledgerPeriod(ledger, new Date(2026, 0, 1), period)
      assert.deepEqual(view.totals, { income: 0, expense: 0, balance: 0 })
      assert.deepEqual(view.spending, [])
      assert.deepEqual(view.recent, [])
      assert.deepEqual(view.metrics, { count: 0, days: 0, dailyAverage: 0 })
      assert.equal(view.activeMonths, 0)
      assert.equal(view.monthlyAverage, 0)
    }
    assert.ok(ledgerYear(ledger, 2026).every((month) => month.expense === 0 && month.income === 0))
    assert.ok(ledgerCategories(ledger).every((category) => category.usageCount === 0))
  }
})

test('카테고리 사용 건수는 선택한 월이 아닌 전체 거래를 기준으로 하며 원본을 변경하지 않는다', () => {
  const ledger = createLedger()
  const before = structuredClone(ledger)
  assert.deepEqual(ledgerCategories(ledger).map(({ id, usageCount }) => ({ id, usageCount })), [
    { id: 'food', usageCount: 5 }, { id: 'cafe', usageCount: 1 }, { id: 'transport', usageCount: 0 }, { id: 'salary', usageCount: 2 },
  ])
  ledgerPeriod(ledger, new Date(2026, 0, 1))
  ledgerYear(ledger, 2026)
  assert.deepEqual(ledger, before)
})

test('기록된 월 평균은 수입만 있는 월도 포함하고 큰 정수도 정확히 반올림한다', () => {
  const ledger = createLargeLedger(Number.MAX_SAFE_INTEGER - 6)
  ledger.transactions[1].date = '2026-02-01'
  ledger.transactions[2].date = '2026-03-01'
  const view = ledgerPeriod(ledger, new Date(2026, 0, 1), 'year')
  assert.equal(view.activeMonths, 3)
  assert.equal(view.monthlyAverage, Number((BigInt(Number.MAX_SAFE_INTEGER - 6) + 1n) / 3n))
  const salaryOnlyMonth = createLedger()
  salaryOnlyMonth.transactions = [salaryOnlyMonth.transactions[0], { ...salaryOnlyMonth.transactions[1], date: '2026-02-01' }]
  const result = ledgerPeriod(salaryOnlyMonth, new Date(2026, 0, 1), 'year')
  assert.equal(result.activeMonths, 2)
  assert.equal(result.monthlyAverage, 51)
})
