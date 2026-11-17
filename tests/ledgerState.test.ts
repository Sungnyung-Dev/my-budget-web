import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { createLedgerStore } from '../src/state/ledgerStore.ts'
import { createApiClient } from '../src/lib/api/client.ts'
import { getLedger } from '../src/lib/api/ledgerApi.ts'
import { createLedger } from './fixtures.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const response = (value: unknown) => new Response(JSON.stringify(value))
function fromHttp(fetchImpl: typeof fetch) {
  const client = createApiClient({ fetchImpl })
  return createLedgerStore((signal) => getLedger(client, { signal }))
}

test('최초 조회 전에는 데이터가 null이며 성공한 전체 Ledger만 ready에 반영한다', async (t) => {
  const ledger = createLedger()
  let calls = 0
  const store = fromHttp(async (path, options) => {
    calls += 1
    assert.equal(path, '/api/v1/ledger')
    assert.equal(options?.method, 'GET')
    return response(ledger)
  })
  t.after(store.start())
  assert.deepEqual(store.getSnapshot(), { status: 'loading', data: null, error: null, saving: false, needsRefresh: false })
  assert.equal(await store.reload(), true)
  assert.deepEqual(store.getSnapshot(), { status: 'ready', data: ledger, error: null, saving: false, needsRefresh: false })
  assert.equal(calls, 1)
})

test('실패는 빈 배열이 아닌 error이고 재시도 성공 뒤 ready가 된다. 자동 재시도는 없다', async (t) => {
  let calls = 0
  const store = fromHttp(async () => {
    calls += 1
    return calls === 1 ? new Response(null, { status: 503 }) : response(createLedger())
  })
  t.after(store.start())
  assert.equal(await store.reload(), false)
  assert.equal(store.getSnapshot().status, 'error')
  assert.equal(store.getSnapshot().data, null)
  assert.match(store.getSnapshot().error ?? '', /서버/)
  await setImmediate()
  assert.equal(calls, 1)
  assert.equal(await store.reload(), true)
  assert.equal(store.getSnapshot().status, 'ready')
  assert.equal(store.getSnapshot().error, null)
  assert.equal(calls, 2)
})

for (const categories of [createLedger().categories, []]) {
  test(`서버 거래 0건과 카테고리 ${categories.length}개를 ready 데이터로 구분한다`, async (t) => {
    const ledger = { version: 1, transactions: [], categories }
    const store = fromHttp(async () => response(ledger))
    t.after(store.start())
    await store.reload()
    assert.deepEqual(store.getSnapshot(), { status: 'ready', data: ledger, error: null, saving: false, needsRefresh: false })
  })
}

for (const [label, makeResponse] of [
  ['잘못된 JSON', () => new Response('<html>private-detail</html>')],
  ['도메인 검증 실패', () => response({ version: 1, categories: [], transactions: createLedger().transactions })],
  ['네트워크 실패', () => { throw new TypeError('private-detail') }],
] as const) {
  test(`${label}는 초기 데이터를 만들거나 원문을 노출하지 않는다`, async (t) => {
    const store = fromHttp(async () => makeResponse())
    t.after(store.start())
    assert.equal(await store.reload(), false)
    assert.equal(store.getSnapshot().status, 'error')
    assert.equal(store.getSnapshot().data, null)
    assert.doesNotMatch(store.getSnapshot().error ?? '', /private-detail/)
  })
}

test('주입된 로더도 도메인 검증을 통과한 경우에만 상태에 반영한다', async (t) => {
  const store = createLedgerStore(async () => ({ version: 2, categories: [], transactions: [] }))
  t.after(store.start())
  assert.equal(await store.reload(), false)
  assert.equal(store.getSnapshot().status, 'error')
  assert.equal(store.getSnapshot().data, null)
})

test('재조회 중 기존 데이터를 유지하고 실패 뒤에도 같은 데이터를 표시하며 다시 조회할 수 있다', async (t) => {
  const next = deferred<Response>()
  let calls = 0
  const store = fromHttp(async () => {
    calls += 1
    if (calls === 1) return response(createLedger())
    if (calls === 2) return next.promise
    return response({ version: 1, categories: [], transactions: [] })
  })
  t.after(store.start())
  await store.reload()
  const previous = store.getSnapshot().data
  const refresh = store.reload()
  assert.deepEqual(store.getSnapshot(), { status: 'refreshing', data: previous, error: null, saving: false, needsRefresh: false })
  next.resolve(new Response(null, { status: 500 }))
  assert.equal(await refresh, false)
  assert.equal(store.getSnapshot().status, 'ready')
  assert.equal(store.getSnapshot().data, previous)
  assert.ok(store.getSnapshot().error)
  assert.equal(await store.reload(), true)
  assert.equal(store.getSnapshot().error, null)
  assert.deepEqual(store.getSnapshot().data?.transactions, [])
})

test('진행 중 중복 조회는 같은 Promise를 공유하고 구독 변경은 요청을 추가하지 않는다', async (t) => {
  const reply = deferred<Response>()
  let calls = 0
  const store = fromHttp(async () => { calls += 1; return reply.promise })
  t.after(store.start())
  const first = store.reload()
  const tab = store.subscribe(() => {})
  assert.equal(store.reload(), first)
  tab()
  const otherTab = store.subscribe(() => {})
  assert.equal(store.reload(), first)
  await setImmediate()
  assert.equal(calls, 1)
  reply.resolve(response(createLedger()))
  await first
  otherTab()
  assert.equal(calls, 1)
})

test('외부 구독 snapshot은 변경 전까지 같은 객체이고 해제 뒤 알림을 보내지 않는다', async (t) => {
  const store = fromHttp(async () => response(createLedger()))
  t.after(store.start())
  const initial = store.getSnapshot()
  assert.equal(store.getSnapshot(), initial)
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications += 1 })
  await store.reload()
  assert.ok(notifications > 0)
  const received = notifications
  unsubscribe()
  await store.reload()
  assert.equal(notifications, received)
})

test('StrictMode의 start → stop → start는 최초 HTTP 요청을 한 번만 보낸다', async (t) => {
  let calls = 0
  const store = fromHttp(async () => { calls += 1; return response(createLedger()) })
  store.start()()
  t.after(store.start())
  await setImmediate()
  assert.equal(calls, 1)
  assert.equal(store.getSnapshot().status, 'ready')
})

test('요청 전 해제하면 전송하지 않고 해제된 저장소의 reload도 요청하지 않는다', async () => {
  let calls = 0
  const store = fromHttp(async () => { calls += 1; return response(createLedger()) })
  store.start()()
  assert.equal(await store.reload(), false)
  await setImmediate()
  assert.equal(calls, 0)
})

test('수신 중 해제하면 fetch 신호를 취소하고 이후 상태 알림을 보내지 않는다', async () => {
  let signal: AbortSignal | undefined
  const store = fromHttp(async (_path, options) => {
    signal = options?.signal ?? undefined
    return new Promise<Response>(() => {})
  })
  const stop = store.start()
  let notifications = 0
  store.subscribe(() => { notifications += 1 })
  const pending = store.reload()
  await setImmediate()
  stop()
  const previousNotifications = notifications
  assert.equal(await pending, false)
  assert.equal(signal?.aborted, true)
  assert.equal(notifications, previousNotifications)
  assert.equal(store.getSnapshot().data, null)
})

for (const fails of [false, true]) {
  test(`취소를 무시한 이전 로더의 늦은 ${fails ? '실패' : '성공'}가 새 요청·상태를 덮어쓰지 않는다`, async (t) => {
    const old = deferred<unknown>()
    const current = deferred<unknown>()
    let calls = 0
    const store = createLedgerStore(async () => { calls += 1; return calls === 1 ? old.promise : current.promise })
    const stop = store.start()
    const first = store.reload()
    await setImmediate()
    stop()
    t.after(store.start())
    const second = store.reload()
    if (fails) old.reject(new Error('private-detail'))
    else old.resolve(createLedger())
    assert.equal(await first, false)
    assert.equal(store.getSnapshot().status, 'loading')
    assert.equal(store.reload(), second)
    current.resolve({ version: 1, categories: [], transactions: [] })
    assert.equal(await second, true)
    assert.deepEqual(store.getSnapshot().data?.transactions, [])
    assert.equal(store.getSnapshot().error, null)
  })
}

test('재조회 중 해제하면 마지막 정상 데이터로 복구하고 늦은 응답은 무시한다', async () => {
  const late = deferred<unknown>()
  let calls = 0
  const store = createLedgerStore(async () => ++calls === 1 ? createLedger() : late.promise)
  const stop = store.start()
  await store.reload()
  const ready = store.getSnapshot()
  const pending = store.reload()
  await setImmediate()
  stop()
  assert.equal(store.getSnapshot(), ready)
  late.resolve({ version: 1, categories: [], transactions: [] })
  assert.equal(await pending, false)
  assert.equal(store.getSnapshot(), ready)
})
