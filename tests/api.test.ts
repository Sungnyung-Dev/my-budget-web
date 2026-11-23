import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, apiClient, createApiClient, DEFAULT_TIMEOUT_MS } from '../src/lib/api/client.ts'
import type { ApiErrorCode } from '../src/lib/api/client.ts'
import { getLedger } from '../src/lib/api/ledgerApi.ts'
import { createLargeLedger, createLedger } from './fixtures.ts'

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
}

function assertApiError(code: ApiErrorCode, status?: number) {
  return (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.name, 'ApiError')
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    assert.ok(error.message.length > 0)
    assert.doesNotMatch(error.message, /private-detail/)
    assert.equal(error.cause, undefined)
    return true
  }
}

test('기본 클라이언트는 동일 출처 인증을 허용한 상대 경로 GET으로 Ledger를 검증하며 본문·캐시를 사용하지 않는다', async (t) => {
  const ledger = createLedger()
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse(ledger))
  assert.equal(fetchMock.mock.callCount(), 0)
  const result = await getLedger()
  assert.deepEqual(result, ledger)
  assert.notEqual(result, ledger)
  assert.equal(fetchMock.mock.callCount(), 1)
  const [path, options] = fetchMock.mock.calls[0].arguments as Parameters<typeof fetch>
  assert.equal(path, '/api/v1/ledger')
  assert.equal(options?.method, 'GET')
  assert.deepEqual(options?.headers, { Accept: 'application/json' })
  assert.equal(options?.body, undefined)
  assert.equal(options?.credentials, 'same-origin')
  assert.equal(options?.cache, 'no-store')
  assert.ok(options?.signal instanceof AbortSignal)
  assert.equal(options.signal.aborted, false)
  assert.deepEqual(Object.keys(apiClient), ['get', 'post', 'postEmpty', 'patch', 'put', 'delete'])
})

test('공통 GET은 주입한 fetch와 응답 검증 함수를 사용한다', async () => {
  const client = createApiClient({ fetchImpl: async (path) => {
    assert.equal(path, '/api/example')
    return jsonResponse({ ok: true })
  } })
  const result = await client.get('/api/example', (value) => {
    assert.deepEqual(value, { ok: true })
    return 'validated'
  })
  assert.equal(result, 'validated')
})

for (const categories of [createLedger().categories, []]) {
  test(`빈 거래 배열과 카테고리 ${categories.length}개는 정상 Ledger로 반환한다`, async () => {
    const ledger = { version: 1, categories, transactions: [] }
    assert.deepEqual(await getLedger(createApiClient({ fetchImpl: async () => jsonResponse(ledger) })), ledger)
  })
}

for (const status of [400, 401, 403, 404, 429, 500, 503]) {
  test(`HTTP ${status}는 본문을 읽거나 빈 Ledger로 대체하지 않고 안전한 오류와 상태를 반환한다`, async (t) => {
    const response = new Response('private-detail', { status })
    const read = t.mock.method(response, 'text')
    const client = createApiClient({ fetchImpl: async () => response })
    await assert.rejects(getLedger(client), assertApiError('HTTP', status))
    assert.equal(read.mock.callCount(), 0)
  })
}

test('헤더 수신 전 네트워크 실패는 원문을 노출하지 않는 NETWORK 오류다', async () => {
  const client = createApiClient({ fetchImpl: async () => { throw new TypeError('private-detail') } })
  await assert.rejects(getLedger(client), assertApiError('NETWORK'))
})

test('본문 수신 중 연결 실패는 INVALID_RESPONSE 대신 NETWORK 오류다', async (t) => {
  const response = jsonResponse(createLedger())
  t.mock.method(response, 'text', async () => { throw new TypeError('private-detail') })
  await assert.rejects(getLedger(createApiClient({ fetchImpl: async () => response })), assertApiError('NETWORK'))
})

for (const [label, body] of [['빈 본문', ''], ['HTML', '<html>private-detail</html>'], ['잘린 JSON', '{"version":']]) {
  test(`${label}은 HTTP 200이어도 INVALID_RESPONSE 오류다`, async () => {
    const client = createApiClient({ fetchImpl: async () => new Response(body) })
    await assert.rejects(getLedger(client), assertApiError('INVALID_RESPONSE', 200))
  })
}

for (const status of [204, 205]) {
  test(`본문 없는 HTTP ${status}를 정상 빈 Ledger로 취급하지 않는다`, async () => {
    const client = createApiClient({ fetchImpl: async () => new Response(null, { status }) })
    await assert.rejects(getLedger(client), assertApiError('INVALID_RESPONSE', status))
  })
}

const ledger = createLedger()
const category = ledger.categories[0]
const row = ledger.transactions[0]
const invalidLedgers: [string, unknown][] = [
  ['null', null],
  ['배열', []],
  ['응답 envelope', { data: ledger }],
  ['필수 필드 누락', { categories: [], transactions: [] }],
  ['버전', { ...ledger, version: 2 }],
  ['카테고리 목록 형식', { ...ledger, categories: null }],
  ['거래 목록 형식', { ...ledger, transactions: {} }],
  ['카테고리 아이콘', { ...ledger, categories: [{ ...category, symbol: 'unknown' }] }],
  ['카테고리 ID 중복', { ...ledger, categories: [category, category] }],
  ['거래 ID 중복', { ...ledger, transactions: [row, row] }],
  ['고아 카테고리', { ...ledger, transactions: [{ ...row, categoryId: 'missing' }] }],
  ['카테고리 유형 불일치', { ...ledger, transactions: [{ ...row, categoryId: 'salary' }] }],
  ['날짜', { ...ledger, transactions: [{ ...row, date: '2026-02-30' }] }],
  ['소수 금액', { ...ledger, transactions: [{ ...row, amount: 1.5 }] }],
  ['문자열 금액', { ...ledger, transactions: [{ ...row, amount: '100' }] }],
  ['메모 누락', { ...ledger, transactions: [{ ...row, memo: undefined }] }],
  ['전체 합계 초과', createLargeLedger(Number.MAX_SAFE_INTEGER + 1)],
]
for (const [label, payload] of invalidLedgers) {
  test(`도메인 검증 실패(${label})는 INVALID_RESPONSE 오류다`, async () => {
    const client = createApiClient({ fetchImpl: async () => jsonResponse(payload) })
    await assert.rejects(getLedger(client), assertApiError('INVALID_RESPONSE', 200))
  })
}

test('검증기의 내부 오류도 응답 데이터와 함께 노출하지 않는다', async () => {
  const client = createApiClient({ fetchImpl: async () => jsonResponse({}) })
  await assert.rejects(client.get('/api/example', () => { throw new Error('private-detail') }), assertApiError('INVALID_RESPONSE', 200))
})

for (const path of ['', 'api/v1/ledger', 'https://example.test/api/v1/ledger', '//example.test/api', '/\\example.test', '/api/\nledger', '/api/ledger#hash']) {
  test(`잘못된 상대 경로 ${JSON.stringify(path)}는 요청 전에 CONFIGURATION 오류다`, async () => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls += 1; return jsonResponse({}) } })
    await assert.rejects(client.get(path, (value) => value), assertApiError('CONFIGURATION'))
    assert.equal(calls, 0)
  })
}

for (const timeoutMs of [0, -1, 0.5, NaN, Infinity, 2_147_483_648]) {
  test(`잘못된 타임아웃 ${timeoutMs}는 요청 전에 CONFIGURATION 오류다`, async () => {
    let calls = 0
    const client = createApiClient({ timeoutMs, fetchImpl: async () => { calls += 1; return jsonResponse({}) } })
    await assert.rejects(getLedger(client), assertApiError('CONFIGURATION'))
    assert.equal(calls, 0)
  })
}

test('기본 10초가 지나면 취소를 무시하는 fetch도 TIMEOUT으로 종료하고 신호를 중단한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  assert.equal(DEFAULT_TIMEOUT_MS, 10_000)
  let requestSignal: AbortSignal | undefined
  const client = createApiClient({ fetchImpl: async (_path, options) => {
    requestSignal = options?.signal ?? undefined
    return new Promise<Response>(() => {})
  } })
  const pending = assert.rejects(getLedger(client), assertApiError('TIMEOUT'))
  t.mock.timers.tick(9_999)
  assert.equal(requestSignal?.aborted, false)
  t.mock.timers.tick(1)
  await pending
  assert.equal(requestSignal?.aborted, true)
})

for (const stage of ['fetch', 'body'] as const) {
  test(`${stage}가 중단 신호로 실패해도 타임아웃 분류를 유지한다`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let requestSignal: AbortSignal | undefined
    let enteredBody: (() => void) | undefined
    const bodyReady = new Promise<void>((resolve) => { enteredBody = resolve })
    const client = createApiClient({ timeoutMs: 50, fetchImpl: async (_path, options) => {
      requestSignal = options?.signal ?? undefined
      const interrupted = () => new Promise<never>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new Error('private-detail')), { once: true })
      })
      if (stage === 'fetch') return interrupted()
      const response = jsonResponse(ledger)
      t.mock.method(response, 'text', () => { enteredBody?.(); return interrupted() })
      return response
    } })
    const pending = assert.rejects(getLedger(client), assertApiError('TIMEOUT'))
    if (stage === 'body') await bodyReady
    t.mock.timers.tick(50)
    await pending
    assert.equal(requestSignal?.aborted, true)
  })
}

test('본문을 기다리는 동안에도 요청 시작 시점부터의 타임아웃을 적용한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let sendHeaders: (response: Response) => void = () => {}
  let enterBody: () => void = () => {}
  let finishBody: (body: string) => void = () => {}
  let requestSignal: AbortSignal | undefined
  let validationCalls = 0
  const response = jsonResponse({})
  const bodyReady = new Promise<void>((resolve) => { enterBody = resolve })
  t.mock.method(response, 'text', () => {
    enterBody()
    return new Promise<string>((resolve) => { finishBody = resolve })
  })
  const client = createApiClient({ timeoutMs: 100, fetchImpl: async (_path, options) => {
    requestSignal = options?.signal ?? undefined
    return new Promise<Response>((resolve) => { sendHeaders = resolve })
  } })
  const pending = assert.rejects(client.get('/api/example', () => { validationCalls += 1 }), assertApiError('TIMEOUT'))
  t.mock.timers.tick(80)
  sendHeaders(response)
  await bodyReady
  t.mock.timers.tick(19)
  assert.equal(requestSignal?.aborted, false)
  t.mock.timers.tick(1)
  await pending
  assert.equal(requestSignal?.aborted, true)
  finishBody('{}')
  await Promise.resolve()
  assert.equal(validationCalls, 0)
})

test('이미 취소한 요청은 fetch를 호출하지 않는다', async () => {
  const controller = new AbortController()
  controller.abort('private-detail')
  let calls = 0
  const client = createApiClient({ fetchImpl: async () => { calls += 1; return jsonResponse(ledger) } })
  await assert.rejects(getLedger(client, { signal: controller.signal }), assertApiError('ABORTED'))
  assert.equal(calls, 0)
})

for (const stage of ['fetch', 'body'] as const) {
  test(`호출자가 ${stage} 수신 중 취소하면 타임아웃과 구분하며 리스너·타이머를 정리한다`, async (t) => {
    const controller = new AbortController()
    const removeListener = t.mock.method(controller.signal, 'removeEventListener')
    const clearTimer = t.mock.method(globalThis, 'clearTimeout')
    let requestSignal: AbortSignal | undefined
    let enterBody: () => void = () => {}
    const bodyReady = new Promise<void>((resolve) => { enterBody = resolve })
    const client = createApiClient({ fetchImpl: async (_path, options) => {
      requestSignal = options?.signal ?? undefined
      if (stage === 'fetch') return new Promise<Response>(() => {})
      const response = jsonResponse(ledger)
      t.mock.method(response, 'text', () => { enterBody(); return new Promise<string>(() => {}) })
      return response
    } })
    const pending = assert.rejects(getLedger(client, { signal: controller.signal }), assertApiError('ABORTED'))
    if (stage === 'body') await bodyReady
    controller.abort('private-detail')
    await pending
    assert.equal(requestSignal?.aborted, true)
    assert.equal(removeListener.mock.callCount(), 1)
    assert.equal(clearTimer.mock.callCount(), 1)
  })
}

test('동시 요청의 타이머·취소 신호는 독립적이다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const signals: AbortSignal[] = []
  const client = createApiClient({ timeoutMs: 100, fetchImpl: async (_path, options) => {
    assert.ok(options?.signal)
    signals.push(options.signal)
    if (signals.length === 1) return new Promise<Response>(() => {})
    return jsonResponse(ledger)
  } })
  const pending = assert.rejects(getLedger(client), assertApiError('TIMEOUT'))
  assert.deepEqual(await getLedger(client), ledger)
  t.mock.timers.tick(100)
  await pending
  assert.equal(signals[0].aborted, true)
  assert.equal(signals[1].aborted, false)
})

for (const fails of [false, true]) {
  test(`${fails ? '실패' : '성공'} 완료 뒤에는 타이머·외부 리스너를 정리하고 취소 영향을 받지 않는다`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const controller = new AbortController()
    const clearTimer = t.mock.method(globalThis, 'clearTimeout')
    const removeListener = t.mock.method(controller.signal, 'removeEventListener')
    let requestSignal: AbortSignal | undefined
    const client = createApiClient({ fetchImpl: async (_path, options) => {
      requestSignal = options?.signal ?? undefined
      return fails ? new Response(null, { status: 500 }) : jsonResponse(ledger)
    } })
    const result = getLedger(client, { signal: controller.signal })
    if (fails) await assert.rejects(result, assertApiError('HTTP', 500))
    else assert.deepEqual(await result, ledger)
    assert.equal(clearTimer.mock.callCount(), 1)
    assert.equal(removeListener.mock.callCount(), 1)
    controller.abort()
    t.mock.timers.tick(DEFAULT_TIMEOUT_MS)
    assert.equal(requestSignal?.aborted, false)
  })
}
