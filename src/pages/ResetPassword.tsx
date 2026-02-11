import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token') ?? ''

  const { token: authToken, resetPassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authToken) navigate('/', { replace: true })
  }, [authToken, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!urlToken) {
      setError('Geçersiz veya eksik şifre yenileme bağlantısı.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Şifre ve şifre tekrarı uyuşmuyor.')
      return
    }

    try {
      setLoading(true)
      const result = await resetPassword(urlToken, newPassword)
      const message =
        result.message ?? 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'
      // Şifre başarıyla değiştiyse login sayfasına yönlendir
      navigate('/login', {
        replace: true,
        state: { message },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Şifre yenileme işlemi sırasında bir hata oluştu.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (authToken) return null

  return (
    <div className="auth-root">
      <div className="auth-gradient" />
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">SkySync</h1>
          <p className="auth-subtitle">Yeni şifrenizi belirleyin</p>
        </div>
        <div className="auth-card card">
          {!urlToken && (
            <div className="alert alert-error">
              Geçersiz şifre yenileme bağlantısı. Lütfen tekrar{' '}
              <Link to="/forgot-password">şifre sıfırlama isteği</Link> oluşturun.
            </div>
          )}
          <form className="form-grid auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="new-password">Yeni Şifre</label>
              <input
                id="new-password"
                type="password"
                placeholder="Yeni şifreniz"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-password">Yeni Şifre (Tekrar)</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Yeni şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {successMessage && <div className="alert alert-success">{successMessage}</div>}
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions auth-actions">
              <button type="submit" disabled={loading || !urlToken}>
                {loading ? 'Şifre güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </div>
          </form>
          <p className="auth-footer">
            Giriş sayfasına dönmek için <Link to="/login">tıklayın</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

