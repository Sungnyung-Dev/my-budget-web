import type { Category, LedgerData, Transaction, TransactionInput } from '../domain/types.ts'
import { assertCategoryUnused, validateCategoryName, validateLedger, validateTransactionInput } from '../domain/validateLedger.ts'
import { ApiError, apiClient } from '../lib/api/client.ts'
import type { ApiClient, ApiErrorCode } from '../lib/api/client.ts'
import { getLedger } from '../lib/api/ledgerApi.ts'
import * as transactions from '../lib/api/transactionApi.ts'
import * as categories from '../lib/api/categoryApi.ts'
import { categoryCreateInput, categoryOrderInput, categoryUpdateInput, invalidRequest, requestId, transactionCreateInput, transactionUpdateInput } from '../lib/api/validation.ts'

type ReadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: LedgerData; error: string | null }
  | { status: 'refreshing'; data: LedgerData; error: null }

export type LedgerState = ReadState & { saving: boolean; needsRefresh: boolean }
export type LedgerLoader = (signal: AbortSignal) => Promise<unknown>

export type WriteFailure = {
  ok: false
  code: ApiErrorCode | 'NOT_READY' | 'BUSY' | 'NEEDS_REFRESH' | 'UNCERTAIN'
  message: string
  needsRefresh: boolean
  status?: number
}
export type WriteResult<T> = { ok: true; value: T } | WriteFailure

type PendingRequest = { controller: AbortController; previous: LedgerState } & (
  | { kind: 'read'; promise: Promise<boolean> }
  | { kind: 'write'; sent: boolean }
)

const uncertainMessage = '서버의 처리 결과를 확인하지 못했습니다. 이미 반영되었을 수 있으므로 서버 데이터를 다시 조회해 목록에서 확인해 주세요.'

function uncertainResult(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true
  if (error.code === 'HTTP') return !error.status || error.status < 400 || error.status === 408 || error.status >= 500
  return !['INVALID_REQUEST', 'CONFIGURATION'].includes(error.code)
}

function domainInput<T>(check: () => T): T {
  try { return check() } catch (error) {
    return invalidRequest(error instanceof Error ? error.message : '입력값을 확인해 주세요.')
  }
}

export function createLedgerStore(load?: LedgerLoader, client: ApiClient = apiClient) {
  const loadLedger: LedgerLoader = load ?? ((signal) => getLedger(client, { signal }))
  let state: LedgerState = { status: 'loading', data: null, error: null, saving: false, needsRefresh: false }

  const listeners = new Set<() => void>()
  let active = false
  let lifecycle = 0
  let pending: PendingRequest | null = null

  function publish(next: LedgerState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function reload(): Promise<boolean> {
    if (!active) return Promise.resolve(false)
    if (pending) return pending.kind === 'read' ? pending.promise : Promise.resolve(false)
    const controller = new AbortController()
    const previous = state
    const current = () => active && pending?.controller === controller && !controller.signal.aborted
    const promise = Promise.resolve().then(async () => {
      if (!current()) return false
      try {
        const response = await loadLedger(controller.signal)
        if (!current()) return false
        const data = validateLedger(response)
        publish({ status: 'ready', data, error: null, saving: false, needsRefresh: false })
        return true
      } catch (error) {
        if (!current()) return false
        const message = error instanceof ApiError
          ? error.message
          : '서버의 가계부를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        publish(previous.data
          ? { ...previous, status: 'ready', data: previous.data, error: message }
          : { ...previous, status: 'error', data: null, error: message })
        return false
      } finally {
        if (pending?.controller === controller) pending = null
      }
    })
    pending = { kind: 'read', controller, promise, previous }
    publish(previous.data
      ? { ...previous, status: 'refreshing', data: previous.data, error: null }
      : { ...previous, status: 'loading', data: null, error: null })
    return promise
  }

  function failure(code: WriteFailure['code'], message: string, status?: number): WriteFailure {
    return { ok: false, code, message, status, needsRefresh: state.needsRefresh }
  }

  function mutate<T>(prepare: (data: LedgerData) => {
    send: (signal: AbortSignal) => Promise<T>
    apply: (value: T) => LedgerData
  }): Promise<WriteResult<T>> {
    if (!active || !state.data) {
      return Promise.resolve(failure('NOT_READY', '서버 데이터를 먼저 불러와 주세요.'))
    }
    if (pending) return Promise.resolve(failure('BUSY', '데이터를 처리 중입니다. 잠시 후 다시 시도해 주세요.'))
    if (state.needsRefresh) return Promise.resolve(failure('NEEDS_REFRESH', uncertainMessage))
    let operation: ReturnType<typeof prepare>
    try { operation = prepare(state.data) } catch (error) {
      return Promise.resolve(failure('INVALID_REQUEST', error instanceof ApiError ? error.message : '입력값과 현재 가계부를 확인해 주세요.'))
    }
    const controller = new AbortController()
    const request: PendingRequest = { kind: 'write', controller, previous: state, sent: false }
    pending = request
    publish({ ...state, saving: true })
    const current = () => active && pending?.controller === controller && !controller.signal.aborted
    return Promise.resolve().then(async () => {
      if (!current()) return failure('ABORTED', '서버 요청을 취소했습니다.')
      request.sent = true
      try {
        const value = await operation.send(controller.signal)
        if (!current()) return failure('UNCERTAIN', uncertainMessage)
        let data: LedgerData
        try { data = validateLedger(operation.apply(value)) } catch {
          throw new ApiError('INVALID_RESPONSE', '서버의 처리 결과를 확인할 수 없습니다.')
        }
        publish({ ...state, status: 'ready', data, saving: false })
        return { ok: true as const, value }
      } catch (error) {
        if (!current()) return failure('UNCERTAIN', uncertainMessage)
        const uncertain = uncertainResult(error)
        publish({ ...state, saving: false, needsRefresh: uncertain })
        return failure(uncertain ? 'UNCERTAIN' : error instanceof ApiError ? error.code : 'INVALID_REQUEST',
          uncertain ? uncertainMessage : error instanceof ApiError ? error.message : '요청을 처리하지 못했습니다.',
          error instanceof ApiError ? error.status : undefined)
      } finally {
        if (pending?.controller === controller) pending = null
      }
    })
  }

  function stop() {
    active = false
    lifecycle += 1
    const request = pending
    pending = null
    if (request) {
      // 해제 뒤의 응답과 finally가 다음 요청의 상태를 덮어쓰지 않게 합니다.
      state = request.kind === 'write' && request.sent
        ? { ...request.previous, saving: false, needsRefresh: true }
        : request.previous
      request.controller.abort()
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    reload,
    createTransaction(input: TransactionInput): Promise<WriteResult<Transaction>> {
      return mutate((data) => {
        const fields = transactionCreateInput(input)
        const body = domainInput(() => validateTransactionInput(data, fields))
        return {
          send: (signal) => transactions.createTransaction(body, client, { signal }),
          apply: (row) => ({ ...data, transactions: [...data.transactions, row] }),
        }
      })
    },
    updateTransaction(id: string, input: transactions.UpdateTransactionInput): Promise<WriteResult<Transaction>> {
      return mutate((data) => {
        requestId(id)
        const target = data.transactions.find((row) => row.id === id)
        if (!target) return invalidRequest('거래를 찾을 수 없습니다. 서버 데이터를 다시 조회해 주세요.')
        const body = transactionUpdateInput(input)
        domainInput(() => validateTransactionInput(data, { ...target, ...body }, id))
        return {
          send: (signal) => transactions.updateTransaction(id, body, client, { signal }),
          apply: (row) => {
            if (row.id !== id) throw new Error('Unexpected transaction ID')
            return { ...data, transactions: data.transactions.map((item) => item.id === id ? row : item) }
          },
        }
      })
    },
    deleteTransaction(id: string): Promise<WriteResult<void>> {
      return mutate((data) => {
        requestId(id)
        if (!data.transactions.some((row) => row.id === id)) return invalidRequest('거래를 찾을 수 없습니다.')
        return {
          send: (signal) => transactions.deleteTransaction(id, client, { signal }),
          apply: () => ({ ...data, transactions: data.transactions.filter((row) => row.id !== id) }),
        }
      })
    },
    createCategory(input: categories.CreateCategoryInput): Promise<WriteResult<Category>> {
      return mutate((data) => {
        const body = categoryCreateInput(input)
        body.name = domainInput(() => validateCategoryName(data, body.type, body.name))
        return {
          send: (signal) => categories.createCategory(body, client, { signal }),
          apply: (category) => ({ ...data, categories: [...data.categories, category] }),
        }
      })
    },
    updateCategory(id: string, input: categories.UpdateCategoryInput): Promise<WriteResult<Category>> {
      return mutate((data) => {
        requestId(id)
        const target = data.categories.find((category) => category.id === id)
        if (!target) return invalidRequest('카테고리를 찾을 수 없습니다. 서버 데이터를 다시 조회해 주세요.')
        const body = categoryUpdateInput(input)
        body.name = domainInput(() => validateCategoryName(data, target.type, body.name, id))
        return {
          send: (signal) => categories.updateCategory(id, body, client, { signal }),
          apply: (category) => {
            if (category.id !== id || category.type !== target.type || category.symbol !== target.symbol) throw new Error('Unexpected category identity')
            return { ...data, categories: data.categories.map((item) => item.id === id ? category : item) }
          },
        }
      })
    },
    deleteCategory(id: string): Promise<WriteResult<void>> {
      return mutate((data) => {
        requestId(id)
        if (!data.categories.some((category) => category.id === id)) return invalidRequest('카테고리를 찾을 수 없습니다.')
        domainInput(() => assertCategoryUnused(data, id))
        return {
          send: (signal) => categories.deleteCategory(id, client, { signal }),
          apply: () => ({ ...data, categories: data.categories.filter((category) => category.id !== id) }),
        }
      })
    },
    updateCategoryOrder(input: categories.UpdateCategoryOrderInput): Promise<WriteResult<Category[]>> {
      return mutate((data) => {
        const body = categoryOrderInput(input)
        const current = data.categories.filter((category) => category.type === body.type)
        const ids = new Set(current.map((category) => category.id))
        if (body.categoryIds.length !== current.length || body.categoryIds.some((id) => !ids.has(id))) {
          return invalidRequest('해당 유형의 전체 카테고리를 순서대로 지정해 주세요.')
        }
        return {
          send: (signal) => categories.updateCategoryOrder(body, client, { signal }),
          apply: (ordered) => {
            if (ordered.some((category) => category.symbol !== current.find((item) => item.id === category.id)?.symbol)) {
              throw new Error('Unexpected category identity')
            }
            let index = 0
            return { ...data, categories: data.categories.map((category) => category.type === body.type ? ordered[index++] : category) }
          },
        }
      })
    },
    start() {
      active = true
      const version = ++lifecycle
      // StrictMode의 즉시 effect 재실행에서는 취소된 최초 요청을 전송하지 않습니다.
      queueMicrotask(() => { if (active && lifecycle === version) void reload() })
      return stop
    },
  }
}
