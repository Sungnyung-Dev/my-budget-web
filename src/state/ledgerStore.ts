import type { LedgerData } from '../domain/types.ts'
import { validateLedger } from '../domain/validateLedger.ts'
import { ApiError, apiClient } from '../lib/api/client.ts'
import { getLedger } from '../lib/api/ledgerApi.ts'

export type LedgerState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: LedgerData; error: string | null }
  | { status: 'refreshing'; data: LedgerData; error: null }

export type LedgerLoader = (signal: AbortSignal) => Promise<unknown>

const loadFromServer: LedgerLoader = (signal) => getLedger(apiClient, { signal })

export function createLedgerStore(load: LedgerLoader = loadFromServer) {
  let state: LedgerState = { status: 'loading', data: null, error: null }
  const listeners = new Set<() => void>()
  let active = false
  let lifecycle = 0
  let pending: { controller: AbortController; promise: Promise<boolean>; previous: LedgerState } | null = null

  function publish(next: LedgerState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function reload(): Promise<boolean> {
    if (!active) return Promise.resolve(false)
    if (pending) return pending.promise
    const controller = new AbortController()
    const previous = state
    const current = () => active && pending?.controller === controller && !controller.signal.aborted
    const promise = Promise.resolve().then(async () => {
      if (!current()) return false
      try {
        const response = await load(controller.signal)
        if (!current()) return false
        const data = validateLedger(response)
        publish({ status: 'ready', data, error: null })
        return true
      } catch (error) {
        if (!current()) return false
        const message = error instanceof ApiError
          ? error.message
          : '서버의 가계부를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        publish(previous.data
          ? { status: 'ready', data: previous.data, error: message }
          : { status: 'error', data: null, error: message })
        return false
      } finally {
        if (pending?.controller === controller) pending = null
      }
    })
    pending = { controller, promise, previous }
    publish(previous.data
      ? { status: 'refreshing', data: previous.data, error: null }
      : { status: 'loading', data: null, error: null })
    return promise
  }

  function stop() {
    active = false
    lifecycle += 1
    const request = pending
    pending = null
    if (request) {
      // 해제 뒤의 응답과 finally가 다음 요청의 상태를 덮어쓰지 않게 합니다.
      state = request.previous
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
    start() {
      active = true
      const version = ++lifecycle
      // StrictMode의 즉시 effect 재실행에서는 취소된 최초 요청을 전송하지 않습니다.
      queueMicrotask(() => { if (active && lifecycle === version) void reload() })
      return stop
    },
  }
}
