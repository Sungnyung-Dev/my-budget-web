export type TransactionType = 'expense' | 'income'
export type CategorySymbol = 'food' | 'coffee' | 'transport' | 'shopping'
  | 'living' | 'home' | 'income' | 'other'

export interface Category {
  id: string
  name: string
  type: TransactionType
  symbol: CategorySymbol
}

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  amount: number
  categoryId: string
  memo: string
}

export type TransactionInput = Omit<Transaction, 'id'>

export interface LedgerData {
  version: 1
  transactions: Transaction[]
  categories: Category[]
}

export interface Totals {
  income: number
  expense: number
  balance: number
}
