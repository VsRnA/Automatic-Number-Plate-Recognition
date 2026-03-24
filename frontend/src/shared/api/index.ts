import { API_BASE_URL } from '@/shared/config'
import { getAuthHeader, clearCredentials } from '@/shared/auth'

export class ApiError extends Error {
  readonly code: string
  readonly serverMessage: string
  readonly guid: string

  constructor(code: string, serverMessage: string, guid: string) {
    super(serverMessage)
    this.name = 'ApiError'
    this.code = code
    this.serverMessage = serverMessage
    this.guid = guid
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  ERR_APP: 'Внутренняя ошибка сервера',
  ERR_CLIENT_BAD_REQUEST: 'Некорректный запрос',
  ERR_CLIENT_REQUEST_VALIDATION: 'Ошибка валидации данных',
  ERR_CLIENT_AUTH: 'Ошибка авторизации',
  ERR_CLIENT_ENTITY_ALREADY_EXIST: 'Запись с такими данными уже существует',
  ERR_CLIENT_ENTITY_NOT_FOUND: 'Запись не найдена',
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.code] ?? 'Произошла ошибка'
  }
  return 'Произошла ошибка'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeader = getAuthHeader()
  const isForm = init?.body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(!isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...init?.headers,
    },
    ...init,
  })

  if (response.status === 401) {
    clearCredentials()
    window.dispatchEvent(new Event('anpr:auth-error'))
    throw new ApiError('ERR_CLIENT_AUTH', 'Unauthorized', '')
  }

  if (!response.ok) {
    try {
      const json = await response.json()
      const { guid, message, code } = json.error ?? {}
      throw new ApiError(code ?? 'ERR_APP', message ?? '', guid ?? '')
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError('ERR_APP', `HTTP ${response.status}`, '')
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
