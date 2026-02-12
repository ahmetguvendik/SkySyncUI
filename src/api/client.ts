const API_BASE = 'http://localhost:5000/api/v1'

export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

export type AuthResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}

const USER_STORAGE_KEY = 'skysync_user'

function getStoredToken(): string | null {
  return localStorage.getItem('skysync_token')
}

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem('skysync_token', token)
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem('skysync_token')
  localStorage.removeItem(USER_STORAGE_KEY)
}

function buildUrl(path: string): string {
  const p = path.replace(/^\//, '')
  return `${API_BASE.replace(/\/$/, '')}/${p}`
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : buildUrl(path)
  const token = getStoredToken()
  const user = getStoredUser()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // UserLogContext: Gateway/backend JWT'den veya bu header'lardan UserId & UserEmail alır (LogContext, Seq)
  if (user?.id) headers['X-User-Id'] = user.id
  if (user?.email) headers['X-User-Email'] = user.email
  if (options.body != null && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    clearAuth()
    window.location.replace('/login')
    throw new Error('Oturum süresi doldu.')
  }
  return res
}

/** API hata cevabı: message, isteğe bağlı code, validasyon için errors */
export type ApiErrorBody = {
  message?: string
  code?: string
  errors?: Array<{ propertyName?: string; errorMessage?: string }>
}

/**
 * response.message ve isteğe bağlı response.code ile tutarlı hata metni üretir.
 * Validasyon hatalarında errors[].errorMessage birleştirilir.
 */
export function getErrorMessageFromResponse(
  data: ApiErrorBody | null,
  fallback: string
): string {
  if (!data) return fallback
  let msg = data.message ?? fallback
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const details = data.errors
      .map((e) => e.errorMessage ?? e.propertyName)
      .filter(Boolean)
      .join(' ')
    if (details) msg = `${msg} ${details}`.trim()
  }
  if (data.code) msg = `${msg} [${data.code}]`
  return msg
}

export { API_BASE, getStoredToken as getToken }
