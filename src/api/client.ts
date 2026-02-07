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

function getStoredToken(): string | null {
  return localStorage.getItem('skysync_token')
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem('skysync_token', token)
  localStorage.setItem('skysync_user', JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem('skysync_token')
  localStorage.removeItem('skysync_user')
}

function buildUrl(path: string): string {
  const p = path.replace(/^\//, '')
  return `${API_BASE.replace(/\/$/, '')}/${p}`
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : buildUrl(path)
  const token = getStoredToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body != null && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  return fetch(url, { ...options, headers })
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
