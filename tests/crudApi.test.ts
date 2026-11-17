import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient, DEFAULT_TIMEOUT_MS } from '../src/lib/api/client.ts'
import type { ApiClient, ApiRequestOptions } from '../src/lib/api/client.ts'
import * as transactions from '../src/lib/api/transactionApi.ts'
import * as categories from '../src/lib/api/categoryApi.ts'
import type { TransactionInput } from '../src/domain/types.ts'
import { createInput, createLedger } from './fixtures.ts'

const row = createLedger().transactions[0]
const category = createLedger().categories[0]
const categoryInput = { name: ' 운동 ', type: 'expense' as const, symbol: 'other' as const }
const operations: {
  label: string; method: string; path: string; status: number; body?: object; payload?: object
  run: (client: ApiClient, options?: ApiRequestOptions) => Promise<unknown>
}[] = [
  { label: '거래 생성', method: 'POST', path: '/api/v1/transactions', status: 201,
    body: { ...createInput(), memo: '식사' }, payload: { ...row, id: 'server-transaction', amount: 567 },
    run: (client, options) => transactions.createTransaction(createInput(), client, options) },
  { label: '거래 수정', method: 'PATCH', path: '/api/v1/transactions/a', status: 200,
    body: { memo: '변경' }, payload: { ...row, amount: 789, memo: '변경' },
    run: (client, options) => transactions.updateTransaction('a', { memo: ' 변경 ' }, client, options) },
  { label: '거래 삭제', method: 'DELETE', path: '/api/v1/transactions/a', status: 204,
    run: (client, options) => transactions.deleteTransaction('a', client, options) },
  { label: '카테고리 생성', method: 'POST', path: '/api/v1/categories', status: 201,
    body: { ...categoryInput, name: '운동' }, payload: { ...categoryInput, name: '운동', id: 'server-category' },
    run: (client, options) => categories.createCategory(categoryInput, client, options) },
  { label: '카테고리 수정', method: 'PATCH', path: '/api/v1/categories/food', status: 200,
    body: { name: '식사' }, payload: { ...category, name: '식사' },
    run: (client, options) => categories.updateCategory('food', { name: ' 식사 ' }, client, options) },
  { label: '카테고리 삭제', method: 'DELETE', path: '/api/v1/categories/food', status: 204,
    run: (client, options) => categories.deleteCategory('food', client, options) },
]

function errorIs(code: string, status?: number) {
  return (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    assert.doesNotMatch(error.message, /private-detail/)
    assert.equal(error.cause, undefined)
    return true
  }
}

for (const operation of operations) {
  test(`${operation.label}: 동일 출처 인증과 계약의 메서드·JSON·상태·서버 최종 응답을 사용한다`, async (t) => {
    const response = new Response(operation.payload ? JSON.stringify(operation.payload) : null, { status: operation.status })
    const read = t.mock.method(response, 'text')
    let calls = 0
    const client = createApiClient({ fetchImpl: async (path, options) => {
      calls += 1
      assert.equal(path, operation.path)
      assert.equal(options?.method, operation.method)
      assert.equal(options?.credentials, 'same-origin')
      assert.equal(options?.cache, 'no-store')
      assert.ok(options?.signal instanceof AbortSignal)
      assert.deepEqual(options?.headers, operation.body
        ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' })
      assert.deepEqual(options?.body ? JSON.parse(String(options.body)) : undefined, operation.body)
      return response
    } })
    assert.deepEqual(await operation.run(client), operation.payload)
    assert.equal(calls, 1)
    assert.equal(read.mock.callCount(), operation.method === 'DELETE' ? 0 : 1)
  })

  for (const status of [400, 404, 409, 500]) {
    test(`${operation.label}: HTTP ${status}를 원문 노출 없이 반환한다`, async () => {
      const client = createApiClient({ fetchImpl: async () => new Response('private-detail', { status }) })
      await assert.rejects(operation.run(client), errorIs('HTTP', status))
    })
  }

  test(`${operation.label}: 10초 타임아웃을 재사용하고 한 번만 전송한다`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let signal: AbortSignal | undefined
    let calls = 0
    const client = createApiClient({ fetchImpl: async (_path, options) => {
      calls += 1
      signal = options?.signal ?? undefined
      return new Promise<Response>(() => {})
    } })
    const pending = assert.rejects(operation.run(client), errorIs('TIMEOUT'))
    t.mock.timers.tick(DEFAULT_TIMEOUT_MS)
    await pending
    assert.equal(signal?.aborted, true)
    assert.equal(calls, 1)
  })

  test(`${operation.label}: 네트워크 실패를 자동 재시도하지 않는다`, async () => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls += 1; throw new TypeError('private-detail') } })
    await assert.rejects(operation.run(client), errorIs('NETWORK'))
    assert.equal(calls, 1)
  })

  test(`${operation.label}: 이미 취소한 신호는 전송하지 않는다`, async () => {
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls += 1; return new Response() } })
    await assert.rejects(operation.run(client, { signal: controller.signal }), errorIs('ABORTED'))
    assert.equal(calls, 0)
  })

  for (const status of operation.method === 'DELETE' ? [200, 202] : [202, 204, operation.status === 201 ? 200 : 201]) {
    test(`${operation.label}: 예상과 다른 성공 상태 ${status}를 거부한다`, async () => {
      const client = createApiClient({ fetchImpl: async () => new Response(status === 204 ? null : JSON.stringify(operation.payload ?? {}), { status }) })
      await assert.rejects(operation.run(client), errorIs('INVALID_RESPONSE', status))
    })
  }

  if (operation.method !== 'DELETE') {
    for (const body of ['<html>private-detail</html>', 'null', '{}']) {
      test(`${operation.label}: 잘못된 JSON·응답 데이터 ${body.startsWith('<') ? 'HTML' : body}를 거부한다`, async () => {
        const client = createApiClient({ fetchImpl: async () => new Response(body, { status: operation.status }) })
        await assert.rejects(operation.run(client), errorIs('INVALID_RESPONSE', operation.status))
      })
    }

    test(`${operation.label}: 헤더가 와도 본문 수신까지 타임아웃을 적용한다`, async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      let enterBody: () => void = () => {}
      const bodyReady = new Promise<void>((resolve) => { enterBody = resolve })
      const response = new Response('{}', { status: operation.status })
      t.mock.method(response, 'text', () => { enterBody(); return new Promise<string>(() => {}) })
      const pending = assert.rejects(operation.run(createApiClient({ timeoutMs: 25, fetchImpl: async () => response })), errorIs('TIMEOUT'))
      await bodyReady
      t.mock.timers.tick(25)
      await pending
    })
  }
}

for (const [label, run] of [
  ['거래', (client: ApiClient) => transactions.updateTransaction('a', { memo: '' }, client)],
  ['카테고리', (client: ApiClient) => categories.updateCategory('food', { name: '식사' }, client)],
] as const) {
  test(`${label} 수정의 다른 응답 ID를 INVALID_RESPONSE로 구분한다`, async () => {
    const payload = label === '거래' ? row : category
    const client = createApiClient({ fetchImpl: async () => new Response(JSON.stringify({ ...payload, id: 'different-id' })) })
    await assert.rejects(run(client), errorIs('INVALID_RESPONSE', 200))
  })
}

const invalidInputs: [string, (client: ApiClient) => Promise<unknown>][] = [
  ...[null, [], {}, { ...createInput(), id: 'client-id' }, { ...createInput(), date: '2026-02-30' },
    { ...createInput(), type: 'transfer' }, { ...createInput(), amount: '100' }, { ...createInput(), amount: 0 },
    { ...createInput(), amount: 1.5 }, { ...createInput(), amount: Infinity }, { ...createInput(), amount: 1_000_000_000_000 },
    { ...createInput(), categoryId: '' }, { ...createInput(), memo: '가'.repeat(101) },
  ].map((input, index): [string, (client: ApiClient) => Promise<unknown>] => [`거래 생성 ${index}`, (client) => transactions.createTransaction(input as TransactionInput, client)]),
  ...[{}, { amount: undefined }, { type: null }, { id: 'id' }, { amount: -1 }, { categoryId: 'x'.repeat(192) }, { memo: null }]
    .map((input, index): [string, (client: ApiClient) => Promise<unknown>] => [`거래 수정 ${index}`, (client) => transactions.updateTransaction('a', input as transactions.UpdateTransactionInput, client)]),
  ...[null, {}, { ...categoryInput, id: 'id' }, { ...categoryInput, name: ' ' }, { ...categoryInput, name: '가'.repeat(21) },
    { ...categoryInput, type: 'transfer' }, { ...categoryInput, symbol: 'unknown' }]
    .map((input, index): [string, (client: ApiClient) => Promise<unknown>] => [`카테고리 생성 ${index}`, (client) => categories.createCategory(input as categories.CreateCategoryInput, client)]),
  ...[{}, { name: ' ' }, { name: 1 }, { name: '식사', type: 'income' }, { name: '식사', symbol: 'food' }]
    .map((input, index): [string, (client: ApiClient) => Promise<unknown>] => [`카테고리 수정 ${index}`, (client) => categories.updateCategory('food', input as categories.UpdateCategoryInput, client)]),
]
for (const [label, run] of invalidInputs) {
  test(`잘못된 입력(${label})은 HTTP 전송 전에 차단한다`, async () => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls += 1; return new Response() } })
    await assert.rejects(run(client), errorIs('INVALID_REQUEST'))
    assert.equal(calls, 0)
  })
}

for (const id of ['', '.', '..', 'x'.repeat(192), '\ud800']) {
  test(`경로로 보낼 수 없는 ID ${JSON.stringify(id)}를 두 리소스 삭제 전에 거부한다`, async () => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls += 1; return new Response() } })
    await assert.rejects(transactions.deleteTransaction(id, client), errorIs('INVALID_REQUEST'))
    await assert.rejects(categories.deleteCategory(id, client), errorIs('INVALID_REQUEST'))
    assert.equal(calls, 0)
  })
}

test('문자열 ID는 경로 세그먼트로 인코딩하고 부분 수정은 제공한 필드만 보낸다', async () => {
  const id = '한글 /?%#'
  const client = createApiClient({ fetchImpl: async (path, options) => {
    assert.equal(path, `/api/v1/transactions/${encodeURIComponent(id)}`)
    assert.deepEqual(JSON.parse(String(options?.body)), { memo: '' })
    return new Response(JSON.stringify({ ...row, id }))
  } })
  await transactions.updateTransaction(id, { memo: ' ' }, client)
})

test('JSON 직렬화 불가 입력은 공통 클라이언트에서 전송 전에 차단한다', async () => {
  let calls = 0
  const client = createApiClient({ fetchImpl: async () => { calls += 1; return new Response() } })
  const circular: { self?: object } = {}
  circular.self = circular
  await assert.rejects(client.post('/api/example', circular, (value) => value), errorIs('INVALID_REQUEST'))
  assert.equal(calls, 0)
})
