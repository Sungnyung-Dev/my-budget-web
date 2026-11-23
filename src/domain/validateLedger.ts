import { isValidDate } from './dates.ts'
import { MAX_AMOUNT, parseAmount, sumAmounts } from './ledger.ts'
import type { Category, CategorySymbol, LedgerData, Transaction, TransactionInput, TransactionType } from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isTransactionType(value: unknown): value is TransactionType {
  return value === 'expense' || value === 'income'
}

export function isCategorySymbol(value: unknown): value is CategorySymbol {
  return typeof value === 'string'
    && ['food', 'coffee', 'transport', 'shopping', 'living', 'home', 'income', 'other'].includes(value)
}

export function validateCategory(value: unknown): Category {
  const category = value as Category
  if (!isRecord(value) || typeof category.id !== 'string' || !category.id
    || !isTransactionType(category.type) || typeof category.name !== 'string'
    || !category.name.trim() || category.name.length > 20 || !isCategorySymbol(category.symbol)
    || !Number.isSafeInteger(category.sortOrder) || category.sortOrder < 0) {
    throw new Error('저장된 카테고리를 확인할 수 없습니다.')
  }
  return category
}

export function validateCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) throw new Error('카테고리 목록 형식을 확인할 수 없습니다.')
  const categories = value.map(validateCategory)
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const category of categories) {
    if (ids.has(category.id)) throw new Error('저장된 카테고리를 확인할 수 없습니다.')
    const key = `${category.type}:${category.name.toLocaleLowerCase()}`
    if (names.has(key)) throw new Error('중복된 카테고리가 있습니다.')
    ids.add(category.id)
    names.add(key)
  }
  return categories
}

export function validateTransaction(value: unknown): Transaction {
  const row = value as Transaction
  if (!isRecord(value) || typeof row.id !== 'string' || !row.id || !isTransactionType(row.type)
    || typeof row.categoryId !== 'string' || !row.categoryId || typeof row.date !== 'string'
    || !isValidDate(row.date) || !Number.isSafeInteger(row.amount) || row.amount < 1
    || row.amount > MAX_AMOUNT || typeof row.memo !== 'string' || row.memo.length > 100) {
    throw new Error('저장된 거래를 확인할 수 없습니다.')
  }
  return row
}

export function validateTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) throw new Error('거래 목록 형식을 확인할 수 없습니다.')
  const transactions = value.map(validateTransaction)
  const ids = new Set<string>()
  for (const row of transactions) {
    if (ids.has(row.id)) throw new Error('저장된 거래를 확인할 수 없습니다.')
    ids.add(row.id)
  }
  try {
    sumAmounts(transactions.map((row) => row.amount))
  } catch {
    throw new Error('저장 금액의 한도를 초과했습니다.')
  }
  return transactions
}

export function validateLedger(value: unknown): LedgerData {
  const data = value as LedgerData
  if (!isRecord(value) || data.version !== 1 || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
    throw new Error('저장 데이터 형식을 확인할 수 없습니다.')
  }
  validateCategories(data.categories)
  validateTransactions(data.transactions)
  // 개별 거래 응답에는 목록이 없으므로 참조 무결성은 전체 Ledger에서 확인합니다.
  for (const row of data.transactions) {
    if (!data.categories.some((category) => category.id === row.categoryId && category.type === row.type)) {
      throw new Error('저장된 거래를 확인할 수 없습니다.')
    }
  }
  return data
}

export function validateTransactionInput(data: LedgerData, input: TransactionInput, id?: string): TransactionInput {
  if (!isRecord(input) || typeof input.amount !== 'number') throw new Error('올바른 거래 입력이 아닙니다.')
  parseAmount(String(input.amount))
  if (typeof input.date !== 'string' || !isValidDate(input.date)) throw new Error('올바른 거래 날짜가 아닙니다.')
  if (!isTransactionType(input.type)
    || !data.categories.some((category) => category.id === input.categoryId && category.type === input.type)) {
    throw new Error('거래 유형에 맞는 카테고리를 선택해 주세요.')
  }
  if (typeof input.memo !== 'string' || input.memo.trim().length > 100) throw new Error('메모는 100자까지 입력할 수 있습니다.')
  if (id !== undefined && !data.transactions.some((row) => row.id === id)) throw new Error('거래를 찾을 수 없습니다.')
  try {
    sumAmounts([...data.transactions.filter((row) => row.id !== id).map((row) => row.amount), input.amount])
  } catch {
    throw new Error('전체 거래 금액의 저장 한도를 초과했습니다.')
  }
  return { date: input.date, type: input.type, amount: input.amount, categoryId: input.categoryId, memo: input.memo.trim() }
}

export function validateCategoryName(data: LedgerData, type: TransactionType, rawName: string, id?: string) {
  if (!isTransactionType(type)) throw new Error('올바른 카테고리 유형이 아닙니다.')
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name || name.length > 20) throw new Error('카테고리 이름을 1~20자로 입력해 주세요.')
  if (data.categories.some((category) => category.type === type && category.id !== id
    && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('같은 유형에 이미 있는 카테고리 이름입니다.')
  }
  if (id !== undefined && !data.categories.some((category) => category.id === id && category.type === type)) {
    throw new Error('카테고리를 찾을 수 없습니다.')
  }
  return name
}

export function assertCategoryUnused(data: LedgerData, id: string) {
  if (data.transactions.some((row) => row.categoryId === id)) {
    throw new Error('거래에서 사용 중인 카테고리는 삭제할 수 없습니다.')
  }
}
