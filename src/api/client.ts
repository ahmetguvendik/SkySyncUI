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

/** Kullanıcı profil bilgisi: GET auth/profile */
export type ProfileData = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

export async function fetchProfile(): Promise<ProfileData> {
  const res = await fetchWithAuth('auth/profile')
  const text = await res.text()
  if (!res.ok) throw new Error(getErrorMessageFromResponse(
    text ? (() => { try { return JSON.parse(text) } catch { return null } })() : null,
    'Profil yüklenemedi.'
  ))
  let data: Record<string, unknown> = {}
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error('Profil yanıtı okunamadı.')
    }
  }
  return {
    id: String(data.id ?? data.Id ?? ''),
    email: String(data.email ?? data.Email ?? ''),
    firstName: String(data.firstName ?? data.FirstName ?? data.first_name ?? ''),
    lastName: String(data.lastName ?? data.LastName ?? data.last_name ?? ''),
    role: String(data.role ?? data.Role ?? ''),
  }
}

/** Profil güncelleme: PUT auth/profile */
export async function updateProfile(data: {
  firstName: string
  lastName: string
}): Promise<{ message?: string }> {
  const res = await fetchWithAuth('auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  const text = await res.text()
  let parsed: ApiErrorBody & { message?: string } | null = null
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiErrorBody & { message?: string }
    } catch {
      throw new Error('Profil yanıtı okunamadı.')
    }
  }
  if (!res.ok) throw new Error(getErrorMessageFromResponse(parsed, 'Profil güncellenemedi.'))
  return { message: parsed?.message }
}

/** Profil şifre güncelleme: POST auth/change-password */
export async function changePassword(data: {
  currentPassword: string
  newPassword: string
}): Promise<{ message?: string }> {
  const res = await fetchWithAuth('auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const text = await res.text()
  let parsed: ApiErrorBody & { message?: string } | null = null
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiErrorBody & { message?: string }
    } catch {
      throw new Error('Şifre yanıtı okunamadı.')
    }
  }
  if (!res.ok) throw new Error(getErrorMessageFromResponse(parsed, 'Şifre güncellenemedi.'))
  return { message: parsed?.message }
}

/** Sistemdeki kullanıcıları listele: GET auth/users */
export type SystemUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isEmailConfirmed?: boolean
  createdTime?: string
  [key: string]: unknown
}

export type UsersResponse = {
  items: SystemUser[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export async function fetchUsers(params?: {
  page?: number
  pageSize?: number
}): Promise<UsersResponse> {
  const searchParams = new URLSearchParams()
  const page = params?.page && params.page > 0 ? params.page : 1
  const pageSize = params?.pageSize && params.pageSize >= 1 && params.pageSize <= 100 ? params.pageSize : 10
  searchParams.set('page', String(page))
  searchParams.set('pageSize', String(pageSize))
  const res = await fetchWithAuth(`auth/users?${searchParams.toString()}`)
  const text = await res.text()
  let data: ApiErrorBody & UsersResponse | null = null
  if (text) {
    try {
      data = JSON.parse(text) as ApiErrorBody & UsersResponse
    } catch {
      throw new Error('Kullanıcı listesi yanıtı okunamadı.')
    }
  }
  if (!res.ok) {
    throw new Error(getErrorMessageFromResponse(data, 'Kullanıcılar yüklenemedi.'))
  }
  const normalizedItems = Array.isArray(data?.items)
    ? data.items.map((item) => {
        const base = { ...(item as Record<string, unknown>) }
        return {
          ...base,
          id: String(base.id ?? ''),
          email: String(base.email ?? ''),
          firstName: String(base.firstName ?? ''),
          lastName: String(base.lastName ?? ''),
          role: String(base.role ?? ''),
          isEmailConfirmed: typeof base.isEmailConfirmed === 'boolean' ? base.isEmailConfirmed : undefined,
          createdTime: typeof base.createdTime === 'string' ? base.createdTime : undefined,
        }
      })
    : []
  return {
    items: normalizedItems,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalCount: data?.totalCount ?? normalizedItems.length,
    totalPages: data?.totalPages ?? 1,
  }
}

/** Admin kullanıcı ekleme: POST Auth/register/admin (backend 5050, v1.0) */
const ADMIN_REGISTER_URL = 'http://localhost:5050/api/v1.0/Auth/register/admin'

export async function adminRegisterUser(data: {
  email: string
  password: string
  firstName: string
  lastName: string
}): Promise<{ message?: string }> {
  const res = await fetchWithAuth(ADMIN_REGISTER_URL, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const text = await res.text()
  let parsed: ApiErrorBody & { message?: string } | null = null
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiErrorBody & { message?: string }
    } catch {
      //
    }
  }
  if (!res.ok) throw new Error(getErrorMessageFromResponse(parsed, 'Kullanıcı eklenemedi.'))
  return parsed ?? {}
}

export { API_BASE, getStoredToken as getToken }
