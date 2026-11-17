// 인증용 세션 쿠키는 브라우저만 관리합니다. 이 값은 인증 수단이 아닌 CSRF 토큰입니다.
let csrfToken: string | null = null
const listeners = new Set<() => void>()
export const getCsrfToken = () => csrfToken
export const setCsrfToken = (value: string | null) => { csrfToken = value }
export function invalidateAuth(expected: string | null) {
  // 이전 요청의 늦은 401이 새 로그인을 해제하지 않게 합니다.
  if (expected !== csrfToken) return
  csrfToken = null
  listeners.forEach(listener => listener())
}
export function subscribeUnauthorized(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
