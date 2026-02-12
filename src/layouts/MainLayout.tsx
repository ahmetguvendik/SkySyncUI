import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  const isFlightSearch = path === '/ucus-ara' || path === '/ucus-sonuclari'
  const showQuickActions =
    path !== '/ucus-ara' &&
    path !== '/ucus-sonuclari' &&
    path !== '/ucus-ekle' &&
    path !== '/rezervasyonlar' &&
    path !== '/havalimanlari'

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
            <Link
              to="/ucus-ekle"
              className={`app-nav-btn ${path === '/ucus-ekle' ? 'active' : ''}`}
            >
              Uçuş Ekle
            </Link>
            <Link
              to="/rezervasyonlar"
              className={`app-nav-btn ${path === '/rezervasyonlar' ? 'active' : ''}`}
            >
              Rezervasyonlarım
            </Link>
            <Link
              to="/havalimanlari"
              className={`app-nav-btn ${path === '/havalimanlari' ? 'active' : ''}`}
            >
              Havalimanları
            </Link>
          </nav>
          <div className="app-topbar-right">
            {user && (
              <span className="app-user">
                {user.firstName} {user.lastName}
              </span>
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
