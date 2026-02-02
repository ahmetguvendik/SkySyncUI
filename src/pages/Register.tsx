import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Register() {
  const navigate = useNavigate()
  const { token, register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) navigate('/', { replace: true })
  }, [token, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setError('Tüm alanları doldurun.')
      return
    }
    try {
      setLoading(true)
      await register(email.trim(), password, firstName.trim(), lastName.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt oluşturulamadı.')
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
          <p className="auth-subtitle">Yeni hesap oluşturun</p>
        </div>
        <div className="auth-card card">
          <form className="form-grid auth-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="reg-firstName">Ad</label>
                <input
                  id="reg-firstName"
                  type="text"
                  placeholder="Ahmet"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-lastName">Soyad</label>
                <input
                  id="reg-lastName"
                  type="text"
                  placeholder="Guvendik"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="reg-email">E-posta</label>
              <input
                id="reg-email"
                type="email"
                placeholder="ahmetguvendik01@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reg-password">Şifre</label>
              <input
                id="reg-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions auth-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
              </button>
            </div>
          </form>
          <p className="auth-footer">
            Zaten hesabınız var mı? <Link to="/login">Giriş yapın</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
