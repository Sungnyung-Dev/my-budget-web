import { apiClient, type ApiClient, type ApiRequestOptions } from './client.ts'
export interface AuthSession { authenticated: true; csrfToken: string; expiresAt: string }
function validateSession(value: unknown): AuthSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid session')
  const session = value as Record<string, unknown>
  if (session.authenticated !== true || typeof session.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) ||
    typeof session.expiresAt !== 'string' || !Number.isFinite(Date.parse(session.expiresAt))) throw new Error('Invalid session')
  return { authenticated: true, csrfToken: session.csrfToken, expiresAt: session.expiresAt }
}
export function createAuthApi(client: ApiClient = apiClient) {
  return {
    session: (options?: ApiRequestOptions) => client.get('/api/v1/auth/session', validateSession, options),
    login: (username: string, password: string, options?: ApiRequestOptions) =>
      client.post('/api/v1/auth/login', { username, password }, validateSession, { ...options, expectedStatus: 200 }),
    logout: (options?: ApiRequestOptions) => client.postEmpty('/api/v1/auth/logout', options),
  }
}
export type AuthApi = ReturnType<typeof createAuthApi>
