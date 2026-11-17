import { createAuthApi, type AuthApi, type AuthSession } from '../lib/api/authApi.ts'
import { ApiError } from '../lib/api/client.ts'
import { setCsrfToken, subscribeUnauthorized } from '../lib/api/authContext.ts'
export type AuthState =
  | { status: 'checking' }
  | { status: 'anonymous'; busy: boolean; message: string | null }
  | { status: 'authenticated'; expiresAt: string }
  | { status: 'error'; message: string; retry: 'check' | 'logout' }
export function createAuthStore(api: AuthApi = createAuthApi()) {
  let state: AuthState = { status: 'checking' }
  let sequence = 0
  let logoutRequested = false
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  function publish(next: AuthState) { state = next; listeners.forEach(listener => listener()) }
  function cancel() { sequence++; controller?.abort(); controller = null; clearTimeout(timer) }
  function anonymous(message: string | null = null) {
    logoutRequested = false
    cancel(); setCsrfToken(null); publish({ status: 'anonymous', busy: false, message })
  }
  function accept(session: AuthSession) {
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (remaining <= 0) { anonymous('로그인 유효기간이 지났습니다. 다시 로그인해 주세요.'); return }
    setCsrfToken(session.csrfToken)
    publish({ status: 'authenticated', expiresAt: session.expiresAt })
    // 브라우저 setTimeout 한도를 넘는 30일은 나누어 예약합니다.
    const expire = () => {
      const left = Date.parse(session.expiresAt) - Date.now()
      if (left <= 0) anonymous('로그인 유효기간이 지났습니다. 다시 로그인해 주세요.')
      else timer = setTimeout(expire, Math.min(left, 2_147_483_647))
    }
    timer = setTimeout(expire, Math.min(remaining, 2_147_483_647))
  }
  async function check() {
    cancel(); const version = sequence
    setCsrfToken(null); publish({ status: 'checking' }); controller = new AbortController()
    try {
      const session = await api.session({ signal: controller.signal })
      if (version === sequence) {
        if (logoutRequested) { setCsrfToken(session.csrfToken); await logout() }
        else accept(session)
      }
    } catch (error) {
      if (version !== sequence) return
      if (error instanceof ApiError && error.status === 401) anonymous()
      else publish({ status: 'error', message: '로그인 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.', retry: 'check' })
    }
  }
  async function login(username: string, password: string) {
    if (state.status !== 'anonymous' || state.busy) return
    cancel(); const version = sequence
    publish({ status: 'anonymous', busy: true, message: null }); controller = new AbortController()
    try {
      const session = await api.login(username, password, { signal: controller.signal })
      if (version === sequence) accept(session)
    } catch (error) {
      if (version !== sequence) return
      anonymous(error instanceof ApiError && error.status === 401 ? '사용자명 또는 비밀번호를 확인해 주세요.' :
        error instanceof ApiError && error.status === 429 ? '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.' :
          '로그인 결과를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.')
    }
  }
  async function logout() {
    logoutRequested = true
    cancel(); const version = sequence
    publish({ status: 'checking' }); controller = new AbortController()
    try {
      await api.logout({ signal: controller.signal })
      if (version === sequence) anonymous()
    } catch {
      if (version === sequence) publish({ status: 'error', message: '서버 로그아웃을 확인하지 못했습니다. 다시 시도해 주세요.', retry: 'logout' })
    }
  }
  function suspend() { cancel(); setCsrfToken(null); publish({ status: 'checking' }) }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    check, login, logout, suspend,
    start() {
      const unsubscribe = subscribeUnauthorized(() => anonymous('로그인이 만료되었습니다. 다시 로그인해 주세요.'))
      void check()
      return () => { unsubscribe(); cancel(); setCsrfToken(null) }
    },
  }
}
