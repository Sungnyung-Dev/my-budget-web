import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ledgerCategories, ledgerPeriod } from '../src/app/ledgerViews.ts'
import { orderedCategories } from '../src/domain/selectors.ts'
import { ApiError, createApiClient } from '../src/lib/api/client.ts'
import { updateCategoryOrder, type UpdateCategoryOrderInput } from '../src/lib/api/categoryApi.ts'
import { createLedgerStore } from '../src/state/ledgerStore.ts'
import { createLedger } from './fixtures.ts'

const expenseIds = ['transport', 'cafe', 'food']
const reordered = expenseIds.map((id, sortOrder) => ({ ...createLedger().categories.find((category) => category.id === id)!, sortOrder }))
const json = (value: unknown) => new Response(JSON.stringify(value))

test('서버 배열의 위치와 무관하게 유형별 sortOrder를 적용하고 원본과 통계 금액순을 유지한다', () => {
  const ledger = createLedger()
  ledger.categories = [ledger.categories[3], ...reordered].reverse()
  const before = structuredClone(ledger)
  assert.deepEqual(orderedCategories(ledger.categories).map((category) => category.id), [...expenseIds, 'salary'])
  assert.deepEqual(ledgerCategories(ledger).map((category) => category.id), [...expenseIds, 'salary'])
  assert.deepEqual(ledgerPeriod(ledger, new Date(2026, 0, 1)).spending.map((category) => category.id), ['food', 'cafe'])
  assert.deepEqual(ledger, before)
})

for (const input of [null, {}, { type: 'transfer', categoryIds: [] }, { type: 'expense' },
  { type: 'expense', categoryIds: 'food' }, { type: 'expense', categoryIds: ['food', 'food'] },
  { type: 'expense', categoryIds: [''] }, { type: 'income', categoryIds: [1] },
  { type: 'expense', categoryIds: ['food'], sortOrder: 0 }]) {
  test(`잘못된 정렬 요청은 전송하지 않는다: ${JSON.stringify(input)}`, async () => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls++; return json([]) } })
    await assert.rejects(updateCategoryOrder(input as UpdateCategoryOrderInput, client), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_REQUEST')
    assert.equal(calls, 0)
  })
}

for (const [label, response] of [
  ['누락된 ID', reordered.slice(1)],
  ['중복 ID', [reordered[0], reordered[0], reordered[2]]],
  ['다른 ID', [{ ...reordered[0], id: 'other' }, ...reordered.slice(1)]],
  ['다른 유형', [{ ...reordered[0], type: 'income' }, ...reordered.slice(1)]],
  ['다른 배열 순서', [...reordered].reverse()],
  ['반대 sortOrder', reordered.map((category) => ({ ...category, sortOrder: 2 - category.sortOrder }))],
  ['중복 sortOrder', reordered.map((category) => ({ ...category, sortOrder: 0 }))],
  ['누락 sortOrder', reordered.map((category) => ({ ...category, sortOrder: undefined }))],
] as const) {
  test(`정렬 응답 검증: ${label}를 거부한다`, async () => {
    const client = createApiClient({ fetchImpl: async () => json(response) })
    await assert.rejects(updateCategoryOrder({ type: 'expense', categoryIds: expenseIds }, client),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE')
  })
}

for (const categoryIds of [['food'], ['food', 'cafe', 'salary'], ['food', 'cafe', 'missing'], ['food', 'food', 'transport']]) {
  test(`현재 유형의 전체 ID가 아니면 저장소가 전송을 차단한다: ${categoryIds.join(',')}`, async (t) => {
    let calls = 0
    const client = createApiClient({ fetchImpl: async () => { calls++; return json(reordered) } })
    const store = createLedgerStore(async () => createLedger(), client)
    t.after(store.start())
    await store.reload()
    const before = store.getSnapshot().data
    const result = await store.updateCategoryOrder({ type: 'expense', categoryIds })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'INVALID_REQUEST')
    assert.equal(calls, 0)
    assert.equal(store.getSnapshot().data, before)
  })
}

test('지출·수입 순서를 독립적으로 저장하고 새 저장소에서 재조회해도 유지한다', async (t) => {
  const server = createLedger()
  server.categories.push({ id: 'bonus', name: '상여', type: 'income', symbol: 'income', sortOrder: 1 })
  const requests: unknown[] = []
  const client = createApiClient({ getCsrfToken: () => 'csrf-test', fetchImpl: async (path, options) => {
    if (options?.method === 'GET') return json(server)
    assert.equal(path, '/api/v1/categories/order')
    assert.equal(options?.method, 'PUT')
    assert.equal(options?.credentials, 'same-origin')
    assert.equal((options?.headers as Record<string, string>)['X-CSRF-Token'], 'csrf-test')
    const body = JSON.parse(String(options?.body)) as UpdateCategoryOrderInput
    requests.push(body)
    const categories = body.categoryIds.map((id, sortOrder) => ({ ...server.categories.find((category) => category.id === id)!, sortOrder }))
    server.categories = [...server.categories.filter((category) => category.type !== body.type), ...categories]
    return json(categories)
  } })
  const store = createLedgerStore(undefined, client)
  t.after(store.start())
  await store.reload()
  const before = store.getSnapshot().data!
  assert.equal((await store.updateCategoryOrder({ type: 'expense', categoryIds: expenseIds })).ok, true)
  assert.deepEqual(store.getSnapshot().data?.categories.filter((category) => category.type === 'income'), before.categories.filter((category) => category.type === 'income'))
  assert.equal((await store.updateCategoryOrder({ type: 'income', categoryIds: ['bonus', 'salary'] })).ok, true)
  const fresh = createLedgerStore(undefined, client)
  t.after(fresh.start())
  await fresh.reload()
  assert.deepEqual(ledgerCategories(fresh.getSnapshot().data!).map((category) => category.id), [...expenseIds, 'bonus', 'salary'])
  assert.deepEqual(fresh.getSnapshot().data?.transactions, before.transactions)
  assert.deepEqual(requests, [{ type: 'expense', categoryIds: expenseIds }, { type: 'income', categoryIds: ['bonus', 'salary'] }])
})

test('정렬 PUT의 401 응답은 기존 인증 만료 처리를 호출한다', async () => {
  const invalidated: (string | null)[] = []
  const client = createApiClient({ getCsrfToken: () => 'expired', onUnauthorized: (token) => invalidated.push(token),
    fetchImpl: async () => new Response(null, { status: 401 }) })
  await assert.rejects(updateCategoryOrder({ type: 'expense', categoryIds: expenseIds }, client),
    (error: unknown) => error instanceof ApiError && error.status === 401)
  assert.deepEqual(invalidated, ['expired'])
})
