import { isValidDate } from '../../domain/dates.ts'
import { MAX_AMOUNT } from '../../domain/ledger.ts'
import type { Category, TransactionInput } from '../../domain/types.ts'
import { isCategorySymbol, isTransactionType } from '../../domain/validateLedger.ts'
import { ApiError } from './client.ts'

export function invalidRequest(message: string): never {
  throw new ApiError('INVALID_REQUEST', message)
}

function requestFields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !allowed.includes(key))) {
    return invalidRequest('요청 데이터에 허용되지 않은 필드가 있습니다.')
  }
  return value as Record<string, unknown>
}

export function requestId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 191) return invalidRequest('ID는 1~191자의 문자열이어야 합니다.')
  return value
}

export function resourcePath(collection: string, id: string): string {
  const validId = requestId(id)
  try {
    if (validId === '.' || validId === '..') throw new Error('Invalid segment')
    return `${collection}/${encodeURIComponent(validId)}`
  } catch {
    return invalidRequest('요청할 ID의 형식을 확인해 주세요.')
  }
}

function requestType(value: unknown) {
  if (!isTransactionType(value)) return invalidRequest('거래 유형은 expense 또는 income이어야 합니다.')
  return value
}

function requestAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_AMOUNT) {
    return invalidRequest('금액은 1~999,999,999,999원의 정수여야 합니다.')
  }
  return value
}

function requestDate(value: unknown): string {
  if (typeof value !== 'string' || !isValidDate(value)) return invalidRequest('날짜는 실제 존재하는 YYYY-MM-DD 형식이어야 합니다.')
  return value
}

function requestMemo(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 100) return invalidRequest('메모는 100자 이하의 문자열이어야 합니다.')
  return value.trim()
}

function requestName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 20) return invalidRequest('카테고리 이름은 1~20자로 입력해 주세요.')
  return value.trim()
}

const transactionFields = ['date', 'type', 'amount', 'categoryId', 'memo'] as const

export function transactionCreateInput(value: unknown): TransactionInput {
  const fields = requestFields(value, transactionFields)
  return {
    date: requestDate(fields.date), type: requestType(fields.type), amount: requestAmount(fields.amount),
    categoryId: requestId(fields.categoryId), memo: requestMemo(fields.memo),
  }
}

export function transactionUpdateInput(value: unknown): Partial<TransactionInput> {
  const fields = requestFields(value, transactionFields)
  const body: Partial<TransactionInput> = {}
  if (fields.date !== undefined) body.date = requestDate(fields.date)
  if (fields.type !== undefined) body.type = requestType(fields.type)
  if (fields.amount !== undefined) body.amount = requestAmount(fields.amount)
  if (fields.categoryId !== undefined) body.categoryId = requestId(fields.categoryId)
  if (fields.memo !== undefined) body.memo = requestMemo(fields.memo)
  if (!Object.keys(body).length) return invalidRequest('수정할 필드를 하나 이상 지정해 주세요.')
  return body
}

export function categoryCreateInput(value: unknown): Omit<Category, 'id'> {
  const fields = requestFields(value, ['name', 'type', 'symbol'])
  if (!isCategorySymbol(fields.symbol)) return invalidRequest('카테고리 아이콘을 확인해 주세요.')
  return { name: requestName(fields.name), type: requestType(fields.type), symbol: fields.symbol }
}

export function categoryUpdateInput(value: unknown): Pick<Category, 'name'> {
  const fields = requestFields(value, ['name'])
  return { name: requestName(fields.name) }
}
