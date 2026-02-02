import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthUser, AuthResponse } from '../api/client'
import { clearAuth, setAuth, getToken } from '../api/client'

const AUTH_USER_KEY = 'skysync_user'

type AuthState = {
  user: AuthUser | null
  token: string | null
  isReady: boolean
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthResponse>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<AuthResponse>
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
    const res = await fetch('http://localhost:5000/api/auth/login', {
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
    if (!res.ok) throw new Error((data as { message?: string })?.message || 'Giriş başarısız.')
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
    ): Promise<AuthResponse> => {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
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
      if (!res.ok) throw new Error((data as { message?: string })?.message || 'Kayıt başarısız.')
      if (!data?.token || !data?.user) throw new Error('Eksik kayıt yanıtı.')
      setAuth(data.token, data.user)
      setState({ token: data.token, user: data.user, isReady: true })
      return data
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
