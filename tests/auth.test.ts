import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient, ApiError } from '../src/lib/api/client.ts'
import { createAuthApi, type AuthApi } from '../src/lib/api/authApi.ts'
import { getCsrfToken, setCsrfToken, invalidateAuth } from '../src/lib/api/authContext.ts'
import { createAuthStore } from '../src/state/authStore.ts'

const token = 'C'.repeat(43)
const session = () => ({ authenticated: true as const, csrfToken: token, expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() })
const unauthorized = () => new ApiError('HTTP', '로그인이 필요합니다.', 401)
function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return { session: async () => session(), login: async () => session(), logout: async () => {}, ...overrides }
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })

test('인증 API는 상대 경로·동일 출처 쿠키·no-store와 로그인 200/로그아웃 204를 사용한다', async () => {
  const calls: { path: unknown; options?: RequestInit }[] = []
  const client = createApiClient({ getCsrfToken: () => token, fetchImpl: async (path, options) => {
    calls.push({ path, options })
    return String(path).endsWith('/logout') ? new Response(null, { status: 204 }) : json(session())
  } })
  const api = createAuthApi(client)
  await api.session(); await api.login('budget', 'password'); await api.logout()
  assert.deepEqual(calls.map(call => call.path), ['/api/v1/auth/session', '/api/v1/auth/login', '/api/v1/auth/logout'])
  for (const call of calls) { assert.equal(call.options?.credentials, 'same-origin'); assert.equal(call.options?.cache, 'no-store') }
  assert.equal(calls[0]!.options?.method, 'GET')
  assert.equal((calls[0]!.options?.headers as Record<string, string>)['X-CSRF-Token'], undefined)
  for (const call of calls.slice(1)) {
    assert.equal((call.options?.headers as Record<string, string>)['X-CSRF-Token'], token)
    assert.equal((call.options?.headers as Record<string, string>)['X-Budget-Request'], '1')
  }
  assert.equal(calls[2]!.options?.body, undefined)
})

test('기존 CRUD의 생성 201과 삭제 204 계약은 유지한다', async () => {
  const client = createApiClient({ fetchImpl: async () => json(session()) })
  await assert.rejects(client.post('/api/v1/categories', {}, value => value), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE')
  await assert.rejects(createAuthApi(createApiClient({ fetchImpl: async () => new Response(null, { status: 200 }) })).logout())
})

test('서버 세션 응답의 잘못된 CSRF 토큰·만료 형식은 거절한다', async () => {
  for (const value of [null, {}, { ...session(), authenticated: false }, { ...session(), csrfToken: 'short' }, { ...session(), expiresAt: 'bad-date' }]) {
    await assert.rejects(createAuthApi(createApiClient({ fetchImpl: async () => json(value) })).session(), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE')
  }
})

test('최초 실행은 서버 확인 전 checking이며 401이면 로그인 화면 상태가 된다', async () => {
  const store = createAuthStore(fakeApi({ session: async () => { throw unauthorized() } }))
  assert.equal(store.getSnapshot().status, 'checking')
  await store.check(); assert.deepEqual(store.getSnapshot(), { status: 'anonymous', busy: false, message: null }); assert.equal(getCsrfToken(), null)
})

test('쿠키가 유효하면 비밀번호 없이 자동 로그인하고 CSRF는 메모리에만 설정한다', async () => {
  let logins = 0
  const store = createAuthStore(fakeApi({ login: async () => { logins++; return session() } }))
  await store.check(); assert.equal(store.getSnapshot().status, 'authenticated'); assert.equal(logins, 0); assert.equal(getCsrfToken(), token)
  store.suspend()
})

test('로그인·로그아웃 후 서버 확인 결과에 따라 전환하며 중복 로그인을 막는다', async () => {
  let calls = 0; let resolve!: (value: ReturnType<typeof session>) => void
  const store = createAuthStore(fakeApi({ session: async () => { throw unauthorized() }, login: () => { calls++; return new Promise(done => { resolve = done }) } }))
  await store.check()
  const first = store.login('budget', 'password'); await store.login('budget', 'password'); assert.equal(calls, 1)
  assert.equal(store.getSnapshot().status, 'anonymous'); resolve(session()); await first
  assert.equal(store.getSnapshot().status, 'authenticated')
  await store.logout(); assert.equal(store.getSnapshot().status, 'anonymous'); assert.equal(getCsrfToken(), null)
})

for (const status of [401, 429, 500]) {
  test(`로그인 HTTP ${status}는 로그인 화면에 안전한 오류를 표시한다`, async () => {
    const store = createAuthStore(fakeApi({ session: async () => { throw unauthorized() }, login: async () => { throw new ApiError('HTTP', 'private-detail', status) } }))
    await store.check(); await store.login('budget', 'password')
    const state = store.getSnapshot(); assert.equal(state.status, 'anonymous')
    if (state.status === 'anonymous') { assert.equal(state.busy, false); assert.ok(state.message); assert.doesNotMatch(state.message, /private-detail/) }
  })
}

test('연결 실패는 만료로 처리하지 않고 장부를 가리는 오류 상태가 된다', async () => {
  const store = createAuthStore(fakeApi({ session: async () => { throw new Error('offline') } }))
  await store.check(); const state = store.getSnapshot(); assert.equal(state.status, 'error')
  if (state.status === 'error') assert.equal(state.retry, 'check')
})

test('로그아웃 결과 유실 시 성공으로 표시하지 않고 재시도를 제공한다', async () => {
  let calls = 0
  const store = createAuthStore(fakeApi({ logout: async () => { calls++; if (calls === 1) throw new Error('offline') } }))
  await store.check(); await store.logout()
  const state = store.getSnapshot(); assert.equal(state.status, 'error'); if (state.status === 'error') assert.equal(state.retry, 'logout')
  await store.logout(); assert.equal(store.getSnapshot().status, 'anonymous')
})

test('백그라운드 복귀·늦은 응답이 이전 로그인 상태를 복원하지 않는다', async () => {
  let resolve!: (value: ReturnType<typeof session>) => void
  let firstSignal: AbortSignal | undefined
  const store = createAuthStore(fakeApi({ session: options => { firstSignal = options?.signal; return new Promise(done => { resolve = done }) } }))
  const pending = store.check(); store.suspend(); assert.ok(firstSignal?.aborted)
  resolve(session()); await pending; assert.equal(store.getSnapshot().status, 'checking'); assert.equal(getCsrfToken(), null)
})

test('금융 API 401은 장부를 닫으며 이전 요청 401은 새로운 세션을 무효화하지 않는다', async () => {
  const store = createAuthStore(fakeApi()); const stop = store.start(); await store.check()
  invalidateAuth('old-token'); assert.equal(store.getSnapshot().status, 'authenticated')
  invalidateAuth(token); assert.equal(store.getSnapshot().status, 'anonymous'); stop()
})

test('공통 클라이언트는 금융 API 401만 인증 만료로 알리고 쓰기를 재전송하지 않는다', async () => {
  let calls = 0; const seen: (string | null)[] = []
  const client = createApiClient({ getCsrfToken: () => token, onUnauthorized: value => seen.push(value), fetchImpl: async () => { calls++; return new Response(null, { status: 401 }) } })
  await assert.rejects(client.post('/api/v1/transactions', {}, value => value)); assert.equal(calls, 1); assert.deepEqual(seen, [token])
  await assert.rejects(createAuthApi(client).login('budget', 'bad')); assert.equal(seen.length, 1)
})

test('30일 만료는 setTimeout 최대값을 넘겨도 즉시 만료되지 않으며 경계에서 잠긴다', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-17T12:00:00Z') })
  const store = createAuthStore(fakeApi()); await store.check()
  t.mock.timers.tick(2_147_483_647); assert.equal(store.getSnapshot().status, 'authenticated')
  t.mock.timers.tick(30 * 86400_000 - 2_147_483_647 - 1); assert.equal(store.getSnapshot().status, 'authenticated')
  t.mock.timers.tick(1); assert.equal(store.getSnapshot().status, 'anonymous')
})

test('이미 만료된 서버 응답은 장부를 열지 않는다', async () => {
  const store = createAuthStore(fakeApi({ session: async () => ({ ...session(), expiresAt: new Date(0).toISOString() }) }))
  await store.check(); assert.equal(store.getSnapshot().status, 'anonymous')
})

test('시작 정리 시 구독·요청·CSRF 상태를 해제한다', async () => {
  const store = createAuthStore(fakeApi()); const stop = store.start(); await store.check(); stop(); assert.equal(getCsrfToken(), null)
  setCsrfToken(null)
})


test('로그아웃 응답 유실 후 백그라운드 복귀에서도 장부 대신 로그아웃을 재시도한다', async () => {
  let attempts = 0
  const store = createAuthStore(fakeApi({ logout: async () => { attempts++; if (attempts === 1) throw new Error('offline') } }))
  await store.check(); await store.logout(); store.suspend(); await store.check()
  assert.equal(attempts, 2); assert.equal(store.getSnapshot().status, 'anonymous'); assert.equal(getCsrfToken(), null)
})
