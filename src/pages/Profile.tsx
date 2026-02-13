import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, changePassword } from '../api/client'

export default function Profile() {
  const { user, refreshProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editFirstName, setEditFirstName] = useState(user?.firstName ?? '')
  const [editLastName, setEditLastName] = useState(user?.lastName ?? '')
  const [editEmail, setEditEmail] = useState(user?.email ?? '')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  React.useEffect(() => {
    setEditFirstName(user?.firstName ?? '')
    setEditLastName(user?.lastName ?? '')
    setEditEmail(user?.email ?? '')
  }, [user])

  React.useEffect(() => {
    if (!editing) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      setPasswordSuccess(null)
    }
  }, [editing])

  const handleRefresh = async () => {
    setRefreshError(null)
    setRefreshing(true)
    try {
      await refreshProfile()
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Profil yenilenemedi.')
    } finally {
      setRefreshing(false)
    }
  }

  const copyId = () => {
    if (!user?.id) return
    navigator.clipboard.writeText(user.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(null)
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      setEditError('Tüm alanları doldurun.')
      return
    }
    setEditLoading(true)
    try {
      const result = await updateProfile({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
      })
      await refreshProfile()
      setEditSuccess(result.message ?? 'Profiliniz güncellendi.')
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Profil güncellenemedi.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditFirstName(user?.firstName ?? '')
    setEditLastName(user?.lastName ?? '')
    setEditEmail(user?.email ?? '')
    setEditError(null)
    setEditSuccess(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordSuccess(null)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tüm şifre alanlarını doldurun.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalıdır.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifre ve tekrarı eşleşmiyor.')
      return
    }
    setPasswordLoading(true)
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      })
      setPasswordSuccess(result.message ?? 'Şifreniz güncellendi.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Şifre güncellenemedi.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'
  const initial = fullName.charAt(0).toUpperCase() || '?'

  return (
    <main className="profile-page">
      <div className="profile-cover" />
      <div className="profile-content">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{initial}</div>
          </div>
          <div className="profile-header-text">
            <h1 className="profile-name">{fullName}</h1>
            <p className="profile-email">{user?.email ?? '—'}</p>
            <span className={`profile-badge ${user?.role === 'Admin' ? 'profile-badge-admin' : 'profile-badge-user'}`}>
              {user?.role ?? '—'}
            </span>
          </div>
          <button
            type="button"
            className={`profile-refresh-btn ${refreshing ? 'profile-refresh-loading' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Profil bilgilerini güncelle"
          >
            <span className="profile-refresh-icon">↻</span>
            {refreshing ? 'Yenileniyor...' : 'Profilimi yenile'}
          </button>
        </div>

        {refreshError && (
          <div className="alert alert-error profile-alert">{refreshError}</div>
        )}

        <section className="profile-details">
          <h2 className="profile-details-title">Hesap Bilgileri</h2>
          <div className="profile-detail-grid">
            <div className="profile-detail-item">
              <span className="profile-detail-icon">👤</span>
              <div>
                <span className="profile-detail-label">Ad Soyad</span>
                <span className="profile-detail-value">{fullName}</span>
              </div>
            </div>
            <div className="profile-detail-item">
              <span className="profile-detail-icon">✉</span>
              <div>
                <span className="profile-detail-label">E-posta</span>
                <span className="profile-detail-value mono">{user?.email ?? '—'}</span>
              </div>
            </div>
            <div className="profile-detail-item">
              <span className="profile-detail-icon">🔑</span>
              <div>
                <span className="profile-detail-label">Rol</span>
                <span className={`profile-badge profile-badge-inline ${user?.role === 'Admin' ? 'profile-badge-admin' : 'profile-badge-user'}`}>
                  {user?.role ?? '—'}
                </span>
              </div>
            </div>
            <div className="profile-detail-item profile-detail-id">
              <span className="profile-detail-icon">#</span>
              <div>
                <span className="profile-detail-label">Kullanıcı ID</span>
                <div className="profile-id-row">
                  <span className="profile-detail-value mono profile-id-value">{user?.id ?? '—'}</span>
                  <button
                    type="button"
                    className="profile-copy-btn"
                    onClick={copyId}
                    disabled={!user?.id}
                    title="Panoya kopyala"
                  >
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-edit-section">
          <div className="profile-edit-header">
            <h2 className="profile-details-title">Profil Düzenle</h2>
            {!editing ? (
              <button
                type="button"
                className="profile-edit-toggle-btn"
                onClick={() => setEditing(true)}
              >
                Düzenle
              </button>
            ) : (
              <button
                type="button"
                className="profile-edit-cancel-btn"
                onClick={handleCancelEdit}
                disabled={editLoading}
              >
                İptal
              </button>
            )}
          </div>

          {editing && (
            <div className="profile-edit-forms">
              <form className="profile-edit-form form-grid" onSubmit={handleEditSubmit}>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="profile-edit-firstName">Ad</label>
                    <input
                      id="profile-edit-firstName"
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Adınız"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="profile-edit-lastName">Soyad</label>
                    <input
                      id="profile-edit-lastName"
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Soyadınız"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="profile-edit-email">E-posta</label>
                  <input
                    id="profile-edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    autoComplete="email"
                  />
                </div>
                {editError && <div className="alert alert-error">{editError}</div>}
                {editSuccess && <div className="alert alert-success">{editSuccess}</div>}
                <div className="profile-edit-actions">
                  <button type="submit" className="profile-edit-submit-btn" disabled={editLoading}>
                    {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>

              <form className="profile-password-form" onSubmit={handlePasswordSubmit}>
                <div className="profile-password-header">
                  <div>
                    <h3>Şifreyi Güncelle</h3>
                    <p>Güvenliğiniz için güçlü bir şifre belirleyin.</p>
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="profile-password-current">Mevcut Şifre</label>
                  <input
                    id="profile-password-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mevcut şifreniz"
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="profile-password-new">Yeni Şifre</label>
                  <input
                    id="profile-password-new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifreniz"
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="profile-password-confirm">Yeni Şifre (Tekrar)</label>
                  <input
                    id="profile-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Yeni şifrenizi tekrar girin"
                    autoComplete="new-password"
                  />
                </div>
                {passwordError && <div className="alert alert-error">{passwordError}</div>}
                {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
                <div className="profile-password-actions">
                  <button type="submit" className="profile-password-submit-btn" disabled={passwordLoading}>
                    {passwordLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
