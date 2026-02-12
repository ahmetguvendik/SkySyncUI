import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../api/client'
import './Auth.css'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('E-posta doğrulama bağlantısı geçersiz veya eksik.')
      return
    }

    const verify = async () => {
      setStatus('loading')
      try {
        const url = `${API_BASE.replace(/\/$/, '')}/auth/verify-email`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const text = await res.text()
        let data: { message?: string; isSuccess?: boolean } | null = null
        if (text) {
          try {
            data = JSON.parse(text)
          } catch {}
        }

        if (!res.ok) {
          setStatus('error')
          setMessage(data?.message ?? (text || 'E-posta doğrulama başarısız.'))
          return
        }

        setStatus('success')
        setMessage(data?.message ?? 'E-posta adresiniz başarıyla doğrulandı. Artık giriş yapabilirsiniz.')
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Bir hata oluştu.')
      }
    }

    verify()
  }, [token])

  return (
    <div className="auth-root">
      <div className="auth-gradient" />
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">SkySync</h1>
          <p className="auth-subtitle">E-posta Doğrulama</p>
        </div>
        <div className="auth-card">
          {status === 'loading' && (
            <div className="verify-email-loading">
              <div className="verify-email-spinner" />
              <p>E-posta doğrulanıyor...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="verify-email-result success">
              <div className="verify-email-icon">✓</div>
              <p className="verify-email-message">{message}</p>
              <Link to="/login" className="verify-email-success-btn">
                Giriş Yap
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="verify-email-result error">
              <div className="verify-email-icon">✕</div>
              <p className="verify-email-message">{message}</p>
              <Link to="/login" className="verify-email-back-link">
                Giriş sayfasına dön
              </Link>
            </div>
          )}

          {status === 'idle' && !token && (
            <p className="verify-email-message">Bekleniyor...</p>
          )}
        </div>
        <p className="auth-footer" style={{ marginTop: '1.25rem' }}>
          <Link to="/login">Giriş Yap</Link>
          {' · '}
          <Link to="/register">Kayıt Ol</Link>
        </p>
      </div>
    </div>
  )
}
