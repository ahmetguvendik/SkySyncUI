import React, { useState } from 'react'
import { adminRegisterUser } from '../api/client'

export default function AdminUserAdd() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setError('Tüm alanları doldurun.')
      return
    }
    try {
      setLoading(true)
      const result = await adminRegisterUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      setSuccess(result?.message ?? 'Kullanıcı başarıyla eklendi.')
      setEmail('')
      setPassword('')
      setFirstName('')
      setLastName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kullanıcı eklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-container">
      <section className="card">
        <h2 className="section-title">Kullanıcı Ekle</h2>
        <p className="section-desc" style={{ marginBottom: '1rem', color: '#64748b' }}>
          Yeni kullanıcı hesabı oluşturun. E-posta doğrulama gerekebilir.
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="add-firstName">Ad</label>
              <input
                id="add-firstName"
                type="text"
                placeholder="Ahmet"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="form-field">
              <label htmlFor="add-lastName">Soyad</label>
              <input
                id="add-lastName"
                type="text"
                placeholder="Guvendik"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="add-email">E-posta</label>
            <input
              id="add-email"
              type="email"
              placeholder="kullanici@skysync.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="form-field">
            <label htmlFor="add-password">Şifre</label>
            <input
              id="add-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Ekleniyor...' : 'Kullanıcı Ekle'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
