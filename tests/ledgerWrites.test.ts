import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { createApiClient, DEFAULT_TIMEOUT_MS } from '../src/lib/api/client.ts'
import { createLedgerStore } from '../src/state/ledgerStore.ts'
import type { WriteResult } from '../src/state/ledgerStore.ts'
import type { LedgerData, TransactionInput } from '../src/domain/types.ts'
import { createInput, createLargeLedger, createLedger } from './fixtures.ts'

type Store = ReturnType<typeof createLedgerStore>
type Call = { path: string; method: string; body: unknown; signal: AbortSignal }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const categoryInput = { name: ' 운동 ', type: 'expense' as const, symbol: 'other' as const }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function readyStore(t: TestContext, write: (call: Call) => Promise<Response>, read = async () => json(createLedger())) {
  const calls: Call[] = []
  const client = createApiClient({ fetchImpl: async (path, options) => {
    const call = { path: String(path), method: options?.method ?? 'GET', body: options?.body ? JSON.parse(String(options.body)) as unknown : undefined, signal: options?.signal as AbortSignal }
    calls.push(call)
    return call.method === 'GET' ? read() : write(call)
  } })
  const store = createLedgerStore(undefined, client)
  const stop = store.start()
  t.after(stop)
  assert.equal(await store.reload(), true)
  return { store, calls, stop }
}

function failed<T>(result: WriteResult<T>, code: string, needsRefresh: boolean) {
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('Expected failure')
  assert.equal(result.code, code)
  assert.equal(result.needsRefresh, needsRefresh)
  assert.doesNotMatch(result.message, /private-detail/)
  return result
}

const ledger = createLedger()
const operations: { label: string; payload?: object; status: number; run: (store: Store) => Promise<WriteResult<unknown>>; next: (data: LedgerData) => LedgerData }[] = [
  { label: '거래 생성', status: 201, payload: { ...ledger.transactions[0], id: 'server-id', amount: 700 },
    run: (store) => store.createTransaction(createInput()),
    next: (data) => ({ ...data, transactions: [...data.transactions, { ...ledger.transactions[0], id: 'server-id', amount: 700 }] }) },
  { label: '거래 수정', status: 200, payload: { ...ledger.transactions[0], amount: 800, memo: '서버 최종 메모' },
    run: (store) => store.updateTransaction('a', { memo: ' 요청 메모 ' }),
    next: (data) => ({ ...data, transactions: data.transactions.map((row) => row.id === 'a' ? { ...row, amount: 800, memo: '서버 최종 메모' } : row) }) },
  { label: '거래 삭제', status: 204, run: (store) => store.deleteTransaction('a'),
    next: (data) => ({ ...data, transactions: data.transactions.filter((row) => row.id !== 'a') }) },
  { label: '카테고리 생성', status: 201, payload: { ...categoryInput, name: '운동', id: 'new-category' },
    run: (store) => store.createCategory(categoryInput),
    next: (data) => ({ ...data, categories: [...data.categories, { ...categoryInput, name: '운동', id: 'new-category' }] }) },
  { label: '카테고리 수정', status: 200, payload: { ...ledger.categories[0], name: '서버 이름' },
    run: (store) => store.updateCategory('food', { name: ' 요청 이름 ' }),
    next: (data) => ({ ...data, categories: data.categories.map((category) => category.id === 'food' ? { ...category, name: '서버 이름' } : category) }) },
  { label: '카테고리 삭제', status: 204, run: (store) => store.deleteCategory('transport'),
    next: (data) => ({ ...data, categories: data.categories.filter((category) => category.id !== 'transport') }) },
]

for (const operation of operations) {
  test(`${operation.label}: 낙관적 갱신 없이 검증된 다음 Ledger와 서버 결과를 반영한다`, async (t) => {
    const reply = deferred<Response>()
    const { store, calls } = await readyStore(t, async () => reply.promise)
    const before = store.getSnapshot().data
    const pending = operation.run(store)
    assert.equal(store.getSnapshot().saving, true)
    assert.equal(store.getSnapshot().data, before)
    reply.resolve(operation.payload ? json(operation.payload, operation.status) : new Response(null, { status: 204 }))
    const result = await pending
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual(result.value, operation.payload)
    assert.deepEqual(store.getSnapshot().data, operation.next(ledger))
    assert.deepEqual(before, ledger)
    assert.equal(store.getSnapshot().saving, false)
    assert.equal(store.getSnapshot().needsRefresh, false)
    assert.equal(calls.length, 2)
  })

  for (const status of [400, 404, 409, 429]) {
    test(`${operation.label}: HTTP ${status} 거절은 기존 데이터를 유지하고 쓰기 잠금은 해제한다`, async (t) => {
      const { store, calls } = await readyStore(t, async () => new Response('private-detail', { status }))
      const before = store.getSnapshot().data
      const result = failed(await operation.run(store), 'HTTP', false)
      assert.equal(result.status, status)
      assert.equal(store.getSnapshot().data, before)
      assert.equal(store.getSnapshot().saving, false)
      assert.equal(store.getSnapshot().needsRefresh, false)
      failed(await operation.run(store), 'HTTP', false)
      assert.equal(calls.length, 3)
    })
  }

  test(`${operation.label}: 중복 쓰기와 동시 GET을 전송하지 않는다`, async (t) => {
    const reply = deferred<Response>()
    const { store, calls } = await readyStore(t, async () => reply.promise)
    const pending = operation.run(store)
    failed(await operation.run(store), 'BUSY', false)
    assert.equal(await store.reload(), false)
    reply.resolve(operation.payload ? json(operation.payload, operation.status) : new Response(null, { status: 204 }))
    assert.equal((await pending).ok, true)
    assert.equal(calls.length, 2)
  })

  for (const reason of ['network', 'timeout', 'server', 'invalid-success'] as const) {
    test(`${operation.label}: ${reason} 뒤 같은 쓰기를 막고 GET 실패·성공으로 복구한다`, async (t) => {
      let readCount = 0
      const { store, calls } = await readyStore(t, async () => {
        if (reason === 'network') throw new TypeError('private-detail')
        if (reason === 'timeout') return new Promise<Response>(() => {})
        if (reason === 'server') return new Response('private-detail', { status: 503 })
        return json({ invalid: true }, operation.status === 201 ? 201 : 200)
      }, async () => {
        readCount += 1
        if (readCount === 2) return new Response(null, { status: 503 })
        return json(createLedger())
      })
      const before = store.getSnapshot().data
      if (reason === 'timeout') t.mock.timers.enable({ apis: ['setTimeout'] })
      const pending = operation.run(store)
      if (reason === 'timeout') { await setImmediate(); t.mock.timers.tick(DEFAULT_TIMEOUT_MS) }
      failed(await pending, 'UNCERTAIN', true)
      assert.equal(store.getSnapshot().data, before)
      assert.equal(store.getSnapshot().saving, false)
      failed(await operation.run(store), 'NEEDS_REFRESH', true)
      assert.equal(calls.length, 2)
      assert.equal(await store.reload(), false)
      assert.equal(store.getSnapshot().data, before)
      assert.equal(store.getSnapshot().needsRefresh, true)
      failed(await store.deleteTransaction('a'), 'NEEDS_REFRESH', true)
      assert.equal(await store.reload(), true)
      assert.equal(store.getSnapshot().needsRefresh, false)
      assert.equal(store.getSnapshot().error, null)
      const nextWrite = operation.run(store)
      if (reason === 'timeout') { await setImmediate(); t.mock.timers.tick(DEFAULT_TIMEOUT_MS) }
      failed(await nextWrite, 'UNCERTAIN', true)
      assert.equal(calls.filter((call) => call.method !== 'GET').length, 2)
    })
  }
}

const invalidWrites: [string, (store: Store) => Promise<WriteResult<unknown>>][] = [
  ['고아 카테고리', (store) => store.createTransaction({ ...createInput(), categoryId: 'missing' })],
  ['카테고리 유형', (store) => store.createTransaction({ ...createInput(), categoryId: 'salary' })],
  ['금액', (store) => store.createTransaction({ ...createInput(), amount: 0 })],
  ['메모', (store) => store.createTransaction({ ...createInput(), memo: '가'.repeat(101) })],
  ['알 수 없는 필드', (store) => store.createTransaction({ ...createInput(), extra: true } as TransactionInput)],
  ['빈 수정', (store) => store.updateTransaction('a', {})],
  ['부분 수정의 유형 불일치', (store) => store.updateTransaction('a', { type: 'income' })],
  ['없는 거래 수정', (store) => store.updateTransaction('missing', { memo: '' })],
  ['없는 거래 삭제', (store) => store.deleteTransaction('missing')],
  ['카테고리 중복 이름', (store) => store.createCategory({ ...categoryInput, name: 'cAFE' })],
  ['카테고리 이름 변경 중복', (store) => store.updateCategory('food', { name: 'cAFE' })],
  ['카테고리 symbol', (store) => store.createCategory({ ...categoryInput, symbol: 'unknown' } as never)],
  ['없는 카테고리 수정', (store) => store.updateCategory('missing', { name: '운동' })],
  ['없는 카테고리 삭제', (store) => store.deleteCategory('missing')],
  ['사용 중 카테고리 삭제', (store) => store.deleteCategory('food')],
]
for (const [label, run] of invalidWrites) {
  test(`상태의 입력 검증(${label}) 실패는 전송 없이 반환하며 입력 객체를 유지한다`, async (t) => {
    const { store, calls } = await readyStore(t, async () => { throw new Error('Unexpected write') })
    const before = store.getSnapshot()
    failed(await run(store), 'INVALID_REQUEST', false)
    assert.equal(calls.length, 1)
    assert.equal(store.getSnapshot(), before)
  })
}

test('부분 수정은 기존 거래와 합쳐 검증하고 원본 입력·서버 Ledger를 변경하지 않는다', async (t) => {
  const patch = Object.freeze({ type: 'income' as const, categoryId: 'salary', memo: '  메모  ' })
  const { store, calls } = await readyStore(t, async (call) => {
    assert.deepEqual(call.body, { type: 'income', categoryId: 'salary', memo: '메모' })
    return json({ ...ledger.transactions[0], ...call.body as object })
  })
  assert.equal((await store.updateTransaction('a', patch)).ok, true)
  assert.equal(patch.memo, '  메모  ')
  assert.equal(calls.length, 2)
})

test('전체 금액 한도는 요청 전에 검사하고 수정에서는 기존 금액을 제외한다', async (t) => {
  const large = createLargeLedger(Number.MAX_SAFE_INTEGER)
  const target = large.transactions[0]
  const { store, calls } = await readyStore(t, async () => json({ ...target, amount: target.amount - 1 }), async () => json(large))
  failed(await store.createTransaction(createInput()), 'INVALID_REQUEST', false)
  assert.equal(calls.length, 1)
  assert.equal((await store.updateTransaction(target.id, { amount: target.amount - 1 })).ok, true)
})

const invalidSuccesses: [string, object, (store: Store) => Promise<WriteResult<unknown>>, number][] = [
  ['생성 거래 중복 ID', ledger.transactions[0], (store) => store.createTransaction(createInput()), 201],
  ['생성 카테고리 중복 ID', ledger.categories[0], (store) => store.createCategory(categoryInput), 201],
  ['생성 카테고리 중복 이름', { ...ledger.categories[0], id: 'new-id' }, (store) => store.createCategory(categoryInput), 201],
  ['거래 응답 ID 변경', { ...ledger.transactions[0], id: 'other' }, (store) => store.updateTransaction('a', { memo: '' }), 200],
  ['카테고리 응답 ID 변경', { ...ledger.categories[0], id: 'other' }, (store) => store.updateCategory('food', { name: '식사' }), 200],
  ['거래 응답 고아 참조', { ...ledger.transactions[0], categoryId: 'missing' }, (store) => store.updateTransaction('a', { memo: '' }), 200],
  ['거래 응답 유형 불일치', { ...ledger.transactions[0], categoryId: 'salary' }, (store) => store.updateTransaction('a', { memo: '' }), 200],
  ['카테고리 고정 symbol 변경', { ...ledger.categories[0], symbol: 'other' }, (store) => store.updateCategory('food', { name: '식사' }), 200],
  ['미사용 카테고리 유형 변경', { ...ledger.categories[2], type: 'income' }, (store) => store.updateCategory('transport', { name: '이름' }), 200],
]
for (const [label, payload, run, status] of invalidSuccesses) {
  test(`잘못된 성공 응답(${label})을 다음 Ledger에 적용하지 않는다`, async (t) => {
    const { store } = await readyStore(t, async () => json(payload, status))
    const before = store.getSnapshot().data
    failed(await run(store), 'UNCERTAIN', true)
    assert.equal(store.getSnapshot().data, before)
    assert.equal(store.getSnapshot().needsRefresh, true)
  })
}

test('서버 최종 응답으로 전체 합계가 초과하면 적용하지 않고 재조회를 요구한다', async (t) => {
  const large = createLargeLedger(Number.MAX_SAFE_INTEGER - 2000)
  const { store } = await readyStore(t, async () => json({ ...ledger.transactions[0], id: 'server-id', amount: 3000 }, 201), async () => json(large))
  const before = store.getSnapshot().data
  failed(await store.createTransaction(createInput()), 'UNCERTAIN', true)
  assert.equal(store.getSnapshot().data, before)
})

test('GET 진행 중 쓰기를 막고 늦은 GET이 완료된 다음에만 쓰기를 허용한다', async (t) => {
  const read = deferred<Response>()
  let readCount = 0
  const { store, calls } = await readyStore(t, async () => new Response(null, { status: 204 }), async () => ++readCount === 1 ? json(ledger) : read.promise)
  const reload = store.reload()
  failed(await store.deleteTransaction('a'), 'BUSY', false)
  assert.equal(calls.filter((call) => call.method !== 'GET').length, 0)
  read.resolve(json(ledger))
  await reload
  assert.equal((await store.deleteTransaction('a')).ok, true)
  assert.equal(store.getSnapshot().data?.transactions.some((row) => row.id === 'a'), false)
})

test('쓰기 해제·취소는 불확실한 상태로 남기며 늦은 응답이 새 GET·데이터를 덮어쓰지 않는다', async (t) => {
  const late = deferred<Response>()
  const nextRead = deferred<Response>()
  let reads = 0
  const { store, calls, stop } = await readyStore(t, async () => late.promise, async () => ++reads === 1 ? json(ledger) : nextRead.promise)
  const saving = store.deleteTransaction('a')
  await setImmediate()
  stop()
  assert.equal(calls[1].signal.aborted, true)
  assert.equal(store.getSnapshot().saving, false)
  assert.equal(store.getSnapshot().needsRefresh, true)
  t.after(store.start())
  const reload = store.reload()
  failed(await saving, 'UNCERTAIN', true)
  late.resolve(new Response(null, { status: 204 }))
  await setImmediate()
  assert.equal(store.reload(), reload)
  assert.equal(store.getSnapshot().data?.transactions.length, ledger.transactions.length)
  nextRead.resolve(json({ ...ledger, transactions: ledger.transactions.filter((row) => row.id !== 'a') }))
  assert.equal(await reload, true)
  assert.equal(store.getSnapshot().needsRefresh, false)
  assert.equal(store.getSnapshot().data?.transactions.some((row) => row.id === 'a'), false)
})

test('전송 예약 직후 해제한 쓰기는 보내지 않고 불확실 상태를 만들지 않는다', async (t) => {
  const { store, calls, stop } = await readyStore(t, async () => new Response(null, { status: 204 }))
  const saving = store.deleteTransaction('a')
  stop()
  failed(await saving, 'ABORTED', false)
  assert.equal(calls.length, 1)
  assert.equal(store.getSnapshot().needsRefresh, false)
})

test('최초 조회 전과 해제된 저장소의 쓰기는 전송하지 않는다', async () => {
  const store = createLedgerStore()
  failed(await store.deleteTransaction('a'), 'NOT_READY', false)
  store.start()()
  failed(await store.createCategory(categoryInput), 'NOT_READY', false)
})

test('재조회 HTTP 200이어도 도메인 검증 실패이면 불확실 상태와 마지막 데이터를 유지한다', async (t) => {
  let reads = 0
  const { store } = await readyStore(t, async () => { throw new TypeError('private-detail') }, async () => {
    reads += 1
    return reads === 1 ? json(ledger) : json({ version: 1, categories: [], transactions: ledger.transactions })
  })
  const before = store.getSnapshot().data
  failed(await store.deleteTransaction('a'), 'UNCERTAIN', true)
  assert.equal(await store.reload(), false)
  assert.equal(store.getSnapshot().data, before)
  assert.equal(store.getSnapshot().needsRefresh, true)
  failed(await store.createCategory(categoryInput), 'NEEDS_REFRESH', true)
})

test('프록시 HTTP 408은 명확한 거절로 취급하지 않는다', async (t) => {
  const { store } = await readyStore(t, async () => new Response(null, { status: 408 }))
  failed(await store.deleteTransaction('a'), 'UNCERTAIN', true)
})
