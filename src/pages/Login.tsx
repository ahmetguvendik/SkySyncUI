import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) navigate('/', { replace: true })
  }, [token, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli.')
      return
    }
    try {
      setLoading(true)
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.')
    } finally {
      setLoading(false)
    }
  }

  if (token) return null

  return (
    <div className="auth-root">
      <div className="auth-gradient" />
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">SkySync</h1>
          <p className="auth-subtitle">Hesabınıza giriş yapın</p>
        </div>
        <div className="auth-card card">
          <form className="form-grid auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">E-posta</label>
              <input
                id="login-email"
                type="email"
                placeholder="ornek@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Şifre</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {successMessage && <div className="alert alert-success">{successMessage}</div>}
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions auth-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </div>
          </form>
          <p className="auth-footer">
            Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
