import { MAX_AMOUNT } from '../src/domain/ledger.ts'
import type { LedgerData, TransactionInput } from '../src/domain/types.ts'

export function createLedger(): LedgerData {
  return {
    version: 1,
    categories: [
      { id: 'food', name: '식비', type: 'expense', symbol: 'food' },
      { id: 'cafe', name: 'Cafe', type: 'expense', symbol: 'coffee' },
      { id: 'transport', name: '교통', type: 'expense', symbol: 'transport' },
      { id: 'salary', name: '급여', type: 'income', symbol: 'income' },
    ],
    transactions: [
      { id: 'a', date: '2026-01-01', type: 'expense', amount: 101, categoryId: 'food', memo: '' },
      { id: 'b', date: '2026-01-02', type: 'income', amount: 1000, categoryId: 'salary', memo: '수입' },
      { id: 'c', date: '2026-01-01', type: 'expense', amount: 200, categoryId: 'cafe', memo: '' },
      { id: 'd', date: '2026-01-03', type: 'expense', amount: 300, categoryId: 'food', memo: '' },
      { id: 'e', date: '2026-02-01', type: 'expense', amount: 50, categoryId: 'food', memo: '' },
      { id: 'f', date: '2025-12-31', type: 'income', amount: 99, categoryId: 'salary', memo: '' },
      { id: 'g', date: '2027-01-01', type: 'expense', amount: 700, categoryId: 'food', memo: '' },
      { id: 'h', date: '2026-11-01', type: 'expense', amount: 20, categoryId: 'food', memo: '' },
    ],
  }
}

export function createInput(): TransactionInput {
  return { date: '2026-01-05', type: 'expense', amount: 1234, categoryId: 'food', memo: '  식사  ' }
}

export function createLargeLedger(total: number): LedgerData {
  const ledger = createLedger()
  ledger.transactions = []
  let remaining = total
  while (remaining > 0) {
    const index = ledger.transactions.length
    const amount = Math.min(remaining, MAX_AMOUNT)
    ledger.transactions.push({
      id: `large-${index}`, date: `2026-01-0${index % 3 + 1}`, type: 'expense',
      amount, categoryId: 'food', memo: '',
    })
    remaining -= amount
  }
  return ledger
}
