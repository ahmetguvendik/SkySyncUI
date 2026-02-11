import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { token, forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) navigate('/', { replace: true })
  }, [token, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!email.trim()) {
      setError('E-posta adresi zorunludur.')
      return
    }

    try {
      setLoading(true)
      const result = await forgotPassword(email.trim())
      setSuccessMessage(
        result.message ??
          'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Şifre sıfırlama e-postası gönderilirken bir hata oluştu.'
      )
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
          <p className="auth-subtitle">Şifrenizi mi unuttunuz?</p>
        </div>
        <div className="auth-card card">
          <form className="form-grid auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="forgot-email">E-posta</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="ornek@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {successMessage && <div className="alert alert-success">{successMessage}</div>}
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions auth-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Gönderiliyor...' : 'Şifre Sıfırlama Bağlantısı Gönder'}
              </button>
            </div>
          </form>
          <p className="auth-footer">
            Giriş sayfasına dönmek için <Link to="/login">tıklayın</Link>.
          </p>
          <p className="auth-footer">
            Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

