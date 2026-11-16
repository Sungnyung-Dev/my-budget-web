import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_AMOUNT } from '../src/domain/ledger.ts'
import { categorySpending, forDay, forMonth, forYear, getTotals, recentTransactions, spendingMetrics, yearlyMonths } from '../src/domain/selectors.ts'
import { validateLedger } from '../src/domain/validateLedger.ts'
import { createLargeLedger, createLedger } from './fixtures.ts'

test('정상 빈 거래의 합계·평균은 0이고 연간 데이터는 12개월이다', () => {
  const ledger = createLedger()
  assert.deepEqual(getTotals([]), { income: 0, expense: 0, balance: 0 })
  assert.deepEqual(spendingMetrics([]), { count: 0, days: 0, dailyAverage: 0 })
  assert.deepEqual(categorySpending([], ledger.categories), [])
  assert.deepEqual(forDay([], '2026-01-01'), [])
  assert.deepEqual(recentTransactions([]), [])
  assert.deepEqual(forMonth([], '2026-01-01'), [])
  assert.deepEqual(forYear([], 2026), [])
  assert.deepEqual(yearlyMonths([], 2026), Array.from({ length: 12 }, (_, index) => ({
    month: index + 1, count: 0, income: 0, expense: 0, balance: 0,
  })))
})

test('월과 연도를 구분해 수입·지출·차액을 정수로 집계한다', () => {
  const { transactions } = createLedger()
  const january = forMonth(transactions, '2026-01-31')
  assert.deepEqual(january.map((row) => row.id), ['a', 'b', 'c', 'd'])
  assert.deepEqual(getTotals(january), { income: 1000, expense: 601, balance: 399 })
  assert.deepEqual(getTotals(forYear(transactions, 2026)), { income: 1000, expense: 671, balance: 329 })
  assert.deepEqual(getTotals(forMonth(transactions, '2025-12-01')), { income: 99, expense: 0, balance: 99 })
  assert.deepEqual(getTotals(forMonth(transactions, '2027-01-01')), { income: 0, expense: 700, balance: -700 })
})

test('선택일 조회와 최신순 정렬은 같은 날의 입력 배열 역순을 유지한다', () => {
  const { transactions } = createLedger()
  assert.deepEqual(forDay(transactions, '2026-01-01').map((row) => row.id), ['c', 'a'])
  assert.deepEqual(forDay(transactions, '2026-01-04'), [])
  assert.deepEqual(recentTransactions(transactions).map((row) => row.id), ['g', 'h', 'e', 'd', 'b', 'c', 'a', 'f'])
})

test('윤년 2월 말일과 다음 달 첫날의 거래를 구분한다', () => {
  const { transactions } = createLedger()
  const rows = [
    { ...transactions[0], id: 'leap', date: '2024-02-29' },
    { ...transactions[1], id: 'march', date: '2024-03-01' },
  ]
  assert.equal(forMonth(rows, '2024-02-01').length, 1)
  assert.equal(forDay(rows, '2024-02-29')[0].id, 'leap')
  assert.equal(yearlyMonths(rows, 2024)[1].expense, 101)
  assert.equal(yearlyMonths(rows, 2024)[2].income, 1000)
})

test('카테고리 지출 합계·비율은 수입과 사용하지 않은 카테고리를 제외한다', () => {
  const ledger = createLedger()
  const groups = categorySpending(forMonth(ledger.transactions, '2026-01-01'), ledger.categories)
  assert.deepEqual(groups.map(({ category, amount }) => ({ id: category.id, amount })), [
    { id: 'food', amount: 401 }, { id: 'cafe', amount: 200 },
  ])
  assert.equal(groups[0].ratio, 401 / 601)
  assert.equal(groups[1].ratio, 200 / 601)
  assert(Math.abs(groups.reduce((total, group) => total + group.ratio, 0) - 1) < Number.EPSILON)
  assert.equal(groups.reduce((total, group) => total + group.amount, 0), 601)
})

test('지출액이 같은 카테고리는 기존 카테고리 순서를 유지한다', () => {
  const { categories, transactions } = createLedger()
  const rows = [{ ...transactions[0], amount: 100 }, { ...transactions[2], amount: 100 }]
  assert.deepEqual(categorySpending(rows, categories).map((item) => item.category.id), ['food', 'cafe'])
})

test('월간 소비 지표는 지출 건수·서로 다른 지출일·원 단위 반올림 평균이다', () => {
  const rows = forMonth(createLedger().transactions, '2026-01-01')
  assert.deepEqual(spendingMetrics(rows), { count: 3, days: 2, dailyAverage: 301 })
  assert.deepEqual(spendingMetrics(rows.filter((row) => row.type === 'income')), { count: 0, days: 0, dailyAverage: 0 })
})

test('연간 차트 값은 1~12월 순서이고 빈 달은 숫자 0을 반환한다', () => {
  const { transactions } = createLedger()
  const months = yearlyMonths(transactions, 2026)
  const expected = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1, count: 0, income: 0, expense: 0, balance: 0,
  }))
  expected[0] = { month: 1, count: 4, income: 1000, expense: 601, balance: 399 }
  expected[1] = { month: 2, count: 1, income: 0, expense: 50, balance: -50 }
  expected[10] = { month: 11, count: 1, income: 0, expense: 20, balance: -20 }
  assert.deepEqual(months, expected)
  assert.equal(months.reduce((total, month) => total + month.count, 0), 6)
  assert.equal(months.reduce((total, month) => total + month.expense, 0), 671)
})

test('집계와 정렬은 원본 거래·카테고리·배열을 변경하지 않는다', () => {
  const ledger = createLedger()
  const before = JSON.stringify(ledger)
  for (const value of [...ledger.transactions, ...ledger.categories]) Object.freeze(value)
  Object.freeze(ledger.transactions)
  Object.freeze(ledger.categories)
  getTotals(ledger.transactions)
  forMonth(ledger.transactions, '2026-01-01')
  forYear(ledger.transactions, 2026)
  forDay(ledger.transactions, '2026-01-01')
  recentTransactions(ledger.transactions)
  categorySpending(ledger.transactions, ledger.categories)
  spendingMetrics(ledger.transactions)
  yearlyMonths(ledger.transactions, 2026)
  assert.equal(JSON.stringify(ledger), before)
})

test('큰 금액도 정수 합계와 평균을 유지하고 합계 오버플로를 거부한다', () => {
  const ledger = createLargeLedger(Number.MAX_SAFE_INTEGER)
  validateLedger(ledger)
  assert.deepEqual(getTotals(ledger.transactions), { income: 0, expense: Number.MAX_SAFE_INTEGER, balance: -Number.MAX_SAFE_INTEGER })
  assert.equal(spendingMetrics(ledger.transactions).dailyAverage, 3002399751580330)
  assert.throws(() => getTotals([...ledger.transactions, { ...ledger.transactions[0], id: 'overflow', amount: 1 }]), /정수/)
  assert.equal(getTotals([{ ...ledger.transactions[0], amount: MAX_AMOUNT }]).expense, MAX_AMOUNT)
})
