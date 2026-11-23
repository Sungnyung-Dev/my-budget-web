import { dateKey } from '../domain/dates.ts'
import { categorySpending, forMonth, forYear, getTotals, orderedCategories, recentTransactions, spendingMetrics, yearlyMonths } from '../domain/selectors.ts'
import type { LedgerData } from '../domain/types.ts'

export function ledgerPeriod(data: LedgerData, date: Date, period: 'month' | 'year' = 'month') {
  const year = date.getFullYear()
  const rows = period === 'month'
    ? forMonth(data.transactions, dateKey(year, date.getMonth() + 1, 1))
    : forYear(data.transactions, year)
  const totals = getTotals(rows)
  const activeMonths = new Set(rows.map((row) => row.date.slice(0, 7))).size
  return {
    rows,
    totals,
    recent: recentTransactions(rows).slice(0, 3),
    spending: categorySpending(rows, data.categories).map(({ category, amount, ratio }) => ({
      id: category.id, name: category.name, amount, share: ratio,
    })),
    metrics: spendingMetrics(rows),
    activeMonths,
    monthlyAverage: activeMonths
      ? Number((BigInt(totals.expense) + BigInt(Math.floor(activeMonths / 2))) / BigInt(activeMonths))
      : 0,
  }
}

export function ledgerYear(data: LedgerData, year: number) {
  return yearlyMonths(data.transactions, year)
}

export function ledgerCategories(data: LedgerData) {
  const counts = new Map<string, number>()
  data.transactions.forEach((row) => counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1))
  return orderedCategories(data.categories).map((category) => ({ ...category, usageCount: counts.get(category.id) ?? 0 }))
}
