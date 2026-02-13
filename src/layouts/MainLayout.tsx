import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname
  const isAdmin = user?.role === 'Admin'

  const isFlightSearch = path === '/ucus-ara' || path === '/ucus-sonuclari'
  const showQuickActions =
    path !== '/ucus-ara' &&
    path !== '/ucus-sonuclari' &&
    path !== '/ucus-ekle' &&
    path !== '/rezervasyonlar' &&
    path !== '/havalimanlari' &&
    path !== '/kullanici-ekle' &&
    path !== '/kullanicilar' &&
    path !== '/profil'

  return (
    <div className={`app-root ${isFlightSearch ? 'flight-search-active' : ''}`}>
      <div className="app-gradient" />
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link to="/ucus-ara" className="app-logo-link">
            <h1 className="app-logo">
              <span className="app-logo-icon">✦</span>
              SkySync
            </h1>
          </Link>
          <nav className="app-nav">
            <Link
              to="/ucus-ara"
              className={`app-nav-btn ${path === '/ucus-ara' || path === '/ucus-sonuclari' ? 'active' : ''}`}
            >
              Uçuş Ara
            </Link>
            {isAdmin && (
              <Link
                to="/ucus-ekle"
                className={`app-nav-btn ${path === '/ucus-ekle' ? 'active' : ''}`}
              >
                Uçuş Ekle
              </Link>
            )}
            <Link
              to="/rezervasyonlar"
              className={`app-nav-btn ${path === '/rezervasyonlar' ? 'active' : ''}`}
            >
              Rezervasyonlarım
            </Link>
            <Link
              to="/profil"
              className={`app-nav-btn ${path === '/profil' ? 'active' : ''}`}
            >
              Profilim
            </Link>
            {isAdmin && (
              <Link
                to="/havalimanlari"
                className={`app-nav-btn ${path === '/havalimanlari' ? 'active' : ''}`}
              >
                Havalimanları
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/kullanici-ekle"
                className={`app-nav-btn ${path === '/kullanici-ekle' ? 'active' : ''}`}
              >
                Kullanıcı Ekle
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/kullanicilar"
                className={`app-nav-btn ${path === '/kullanicilar' ? 'active' : ''}`}
              >
                Kullanıcılar
              </Link>
            )}
          </nav>
          <div className="app-topbar-right">
            {user && (
              <Link to="/profil" className="app-user app-user-link">
                {user.firstName} {user.lastName}
              </Link>
            )}
            <button
              type="button"
              className="app-logout-btn"
              onClick={() => { logout(); navigate('/login') }}
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {showQuickActions && (
      <div className="quick-actions">
        <Link
          to="/ucus-ara"
          className={`quick-action-card ${path === '/ucus-ara' || path === '/ucus-sonuclari' ? 'active' : ''}`}
        >
          <span className="quick-action-icon">✈</span>
          <span className="quick-action-title">Uçuş Ara</span>
          <span className="quick-action-desc">Rota ve tarihe göre uçuşları listeleyin</span>
        </Link>
        <Link
          to="/rezervasyonlar"
          className={`quick-action-card ${path === '/rezervasyonlar' ? 'active' : ''}`}
        >
          <span className="quick-action-icon">📋</span>
          <span className="quick-action-title">Rezervasyonlarım</span>
          <span className="quick-action-desc">Biletlerinize kolayca ulaşın</span>
        </Link>
        <Link
          to="/profil"
          className={`quick-action-card ${path === '/profil' ? 'active' : ''}`}
        >
          <span className="quick-action-icon">👤</span>
          <span className="quick-action-title">Profilim</span>
          <span className="quick-action-desc">Hesap bilgilerinizi görüntüleyin</span>
        </Link>
        {isAdmin && (
          <>
            <Link
              to="/ucus-ekle"
              className={`quick-action-card ${path === '/ucus-ekle' ? 'active' : ''}`}
            >
              <span className="quick-action-icon">➕</span>
              <span className="quick-action-title">Uçuş Ekle</span>
              <span className="quick-action-desc">Yeni uçuş planı oluşturun</span>
            </Link>
            <Link
              to="/havalimanlari"
              className={`quick-action-card ${path === '/havalimanlari' ? 'active' : ''}`}
            >
              <span className="quick-action-icon">🏢</span>
              <span className="quick-action-title">Havalimanları</span>
              <span className="quick-action-desc">Havalimanı listesi ve ekleme</span>
            </Link>
            <Link
              to="/kullanici-ekle"
              className={`quick-action-card ${path === '/kullanici-ekle' ? 'active' : ''}`}
            >
              <span className="quick-action-icon">👤</span>
              <span className="quick-action-title">Kullanıcı Ekle</span>
              <span className="quick-action-desc">Yeni kullanıcı hesabı oluşturun</span>
            </Link>
            <Link
              to="/kullanicilar"
              className={`quick-action-card ${path === '/kullanicilar' ? 'active' : ''}`}
            >
              <span className="quick-action-icon">👥</span>
              <span className="quick-action-title">Kullanıcılar</span>
              <span className="quick-action-desc">Sistemdeki tüm kullanıcıları görüntüleyin</span>
            </Link>
          </>
        )}
      </div>
      )}

      {path !== '/ucus-ara' && (
      <div className={`info-cards ${!showQuickActions ? 'info-cards-spaced' : ''}`}>
        <div className="info-card">
          <span className="info-card-badge">%50</span>
          <span className="info-card-title">Premium Koltuk</span>
          <span className="info-card-desc">Ön sıralarda konforlu seyahat</span>
        </div>
        <div className="info-card">
          <span className="info-card-badge">3</span>
          <span className="info-card-title">Koltuk Seçimi</span>
          <span className="info-card-desc">Tek seferde en fazla 3 koltuk</span>
        </div>
        <div className="info-card">
          <span className="info-card-badge">∞</span>
          <span className="info-card-title">Rota Seçeneği</span>
          <span className="info-card-desc">Tüm havalimanları arası uçuş</span>
        </div>
      </div>
      )}

      <Outlet />
    </div>
  )
}
