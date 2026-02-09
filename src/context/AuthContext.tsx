import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthUser, AuthResponse } from '../api/client'
import { API_BASE, clearAuth, setAuth, getToken, getErrorMessageFromResponse } from '../api/client'

const AUTH_USER_KEY = 'skysync_user'

type AuthState = {
  user: AuthUser | null
  token: string | null
  isReady: boolean
}

/** Backend kayıt başarılı döndüğünde token/user vermeyebilir; sadece isSuccess, message, userId döner */
export type RegisterSuccessResponse = {
  isSuccess: true
  message?: string
  userId?: string
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthResponse>
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<AuthResponse | RegisterSuccessResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isReady: false,
  })

  useEffect(() => {
    const token = getToken()
    const user = readStoredUser()
    setState({ token, user, isReady: true })
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const text = await res.text()
    let data: AuthResponse & { message?: string } | null = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Sunucudan beklenmeyen yanıt alındı.')
      }
    }
    if (!res.ok) throw new Error(getErrorMessageFromResponse(data, 'Giriş başarısız.'))
    if (!data?.token || !data?.user) throw new Error('Eksik giriş yanıtı.')
    setAuth(data.token, data.user)
    setState({ token: data.token, user: data.user, isReady: true })
    return data
  }, [])

  const register = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string
    ): Promise<AuthResponse | RegisterSuccessResponse> => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      })
      const text = await res.text()
      let data: (AuthResponse & { isSuccess?: boolean; message?: string; userId?: string }) | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error('Sunucudan beklenmeyen yanıt alındı.')
        }
      }
      if (!res.ok) throw new Error(getErrorMessageFromResponse(data, 'Kayıt başarısız.'))
      if (data?.isSuccess === false) throw new Error(getErrorMessageFromResponse(data, 'Kayıt başarısız.'))
      // Backend bazen sadece isSuccess, message, userId döner; token/user yoksa oturum açmıyoruz
      if (data?.token && data?.user) {
        setAuth(data.token, data.user)
        setState({ token: data.token, user: data.user, isReady: true })
        return data
      }
      if (data?.isSuccess === true || data?.userId) {
        return { isSuccess: true, message: data?.message, userId: data?.userId }
      }
      throw new Error(getErrorMessageFromResponse(data, 'Kayıt yanıtı işlenemedi.'))
    },
    []
  )

  const logout = useCallback(() => {
    clearAuth()
    setState({ token: null, user: null, isReady: true })
  }, [])

  const value: AuthContextValue = { ...state, login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
