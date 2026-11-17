export const DEFAULT_TIMEOUT_MS = 10_000

export type ApiErrorCode = 'CONFIGURATION' | 'INVALID_REQUEST' | 'HTTP' | 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'ABORTED'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status?: number

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export interface ApiRequestOptions {
  signal?: AbortSignal
}

interface ApiClientOptions {
  timeoutMs?: number
  fetchImpl?: typeof globalThis.fetch
}

function requestPath(path: string): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\s\\#]/.test(path)) {
    throw new ApiError('CONFIGURATION', '서버 요청 경로가 올바르지 않습니다. 앱 설정을 확인해 주세요.')
  }
  return path
}

function httpMessage(status: number): string {
  if (status === 404) return '요청한 데이터를 찾을 수 없습니다.'
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.'
  return '서버 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function invalidResponse(status: number): ApiError {
  return new ApiError('INVALID_RESPONSE', '서버에서 받은 데이터 형식을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', status)
}

async function readJson<T>(response: Response, validate: (value: unknown) => T, signal: AbortSignal, expectedStatus?: number): Promise<T> {
  if ((expectedStatus !== undefined && response.status !== expectedStatus) || response.status === 204 || response.status === 205) {
    throw invalidResponse(response.status)
  }
  // 본문 전송 중 연결이 끊긴 경우는 JSON/도메인 검증 실패와 구분합니다.
  const body = await response.text()
  signal.throwIfAborted()
  try {
    const value: unknown = JSON.parse(body)
    return validate(value)
  } catch {
    throw invalidResponse(response.status)
  }
}

export function createApiClient({ timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl }: ApiClientOptions = {}) {
  async function send<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string,
    read: (response: Response, signal: AbortSignal) => Promise<T>, body?: object, { signal }: ApiRequestOptions = {}): Promise<T> {
    const url = requestPath(path)
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      throw new ApiError('CONFIGURATION', '서버 연결 대기 시간 설정을 확인해 주세요.')
    }
    if (signal?.aborted) throw new ApiError('ABORTED', '서버 요청을 취소했습니다.')
    let json: string | undefined
    if (body !== undefined) {
      try {
        json = JSON.stringify(body)
        if (json === undefined) throw new Error('Invalid body')
      } catch {
        throw new ApiError('INVALID_REQUEST', '전송할 데이터 형식을 확인해 주세요.')
      }
    }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: () => void = () => {}
    const cancellation = new Promise<never>((_, reject) => {
      onAbort = () => {
        reject(new ApiError('ABORTED', '서버 요청을 취소했습니다.'))
        controller.abort()
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => {
        reject(new ApiError('TIMEOUT', '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'))
        controller.abort()
      }, timeoutMs)
    })
    const request = async () => {
      const response = await (fetchImpl ?? globalThis.fetch)(url, {
        method,
        headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(json !== undefined ? { body: json } : {}),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      })
      controller.signal.throwIfAborted()
      if (!response.ok) throw new ApiError('HTTP', httpMessage(response.status), response.status)
      return read(response, controller.signal)
    }
    try {
      // fetch가 취소를 무시하더라도 본문 수신까지 대기 시간을 제한합니다.
      return await Promise.race([request(), cancellation])
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('NETWORK', '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  return {
    get<T>(path: string, validate: (value: unknown) => T, options?: ApiRequestOptions): Promise<T> {
      return send('GET', path, (response, signal) => readJson(response, validate, signal), undefined, options)
    },
    post<T>(path: string, body: object, validate: (value: unknown) => T, options?: ApiRequestOptions): Promise<T> {
      return send('POST', path, (response, signal) => readJson(response, validate, signal, 201), body, options)
    },
    patch<T>(path: string, body: object, validate: (value: unknown) => T, options?: ApiRequestOptions): Promise<T> {
      return send('PATCH', path, (response, signal) => readJson(response, validate, signal, 200), body, options)
    },
    delete(path: string, options?: ApiRequestOptions): Promise<void> {
      return send('DELETE', path, async (response) => {
        if (response.status !== 204) throw invalidResponse(response.status)
      }, undefined, options)
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

export const apiClient = createApiClient()
