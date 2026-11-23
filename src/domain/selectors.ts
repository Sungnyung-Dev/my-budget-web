import { sumAmounts } from './ledger.ts'
import type { Category, Totals, Transaction } from './types.ts'

export function orderedCategories<T extends Category>(categories: readonly T[]): T[] {
  return [...categories].sort((a, b) => a.type === b.type ? a.sortOrder - b.sortOrder : a.type === 'expense' ? -1 : 1)
}

export function getTotals(rows: readonly Transaction[]): Totals {
  const income = sumAmounts(rows.filter((row) => row.type === 'income').map((row) => row.amount))
  const expense = sumAmounts(rows.filter((row) => row.type === 'expense').map((row) => row.amount))
  return { income, expense, balance: income - expense }
}

export const forMonth = (rows: readonly Transaction[], date: string) =>
  rows.filter((row) => row.date.slice(0, 7) === date.slice(0, 7))

export const forYear = (rows: readonly Transaction[], year: number) =>
  rows.filter((row) => row.date.startsWith(`${year}-`))

export function recentTransactions(rows: readonly Transaction[]) {
  // iOS와 같이 같은 날짜에서는 원본 배열의 뒤쪽 거래를 먼저 표시합니다.
  return [...rows].reverse().sort((a, b) => b.date.localeCompare(a.date))
}

export const forDay = (rows: readonly Transaction[], date: string) =>
  recentTransactions(rows.filter((row) => row.date === date))

export function categorySpending(rows: readonly Transaction[], categories: readonly Category[]) {
  const expenses = rows.filter((row) => row.type === 'expense')
  const total = getTotals(expenses).expense
  return categories.filter((category) => category.type === 'expense')
    .map((category) => {
      const amount = sumAmounts(expenses.filter((row) => row.categoryId === category.id).map((row) => row.amount))
      return { category, amount, ratio: total ? amount / total : 0 }
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function spendingMetrics(rows: readonly Transaction[]) {
  const expenses = rows.filter((row) => row.type === 'expense')
  const days = new Set(expenses.map((row) => row.date)).size
  const total = getTotals(expenses).expense
  // 큰 정수의 나눗셈에서 반올림 오차가 생기지 않도록 정수로 계산합니다.
  const dailyAverage = days ? Number((BigInt(total) + BigInt(Math.floor(days / 2))) / BigInt(days)) : 0
  return { count: expenses.length, days, dailyAverage }
}

export function yearlyMonths(rows: readonly Transaction[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const transactions = forMonth(rows, `${year}-${String(index + 1).padStart(2, '0')}`)
    return { month: index + 1, count: transactions.length, ...getTotals(transactions) }
  })
}
