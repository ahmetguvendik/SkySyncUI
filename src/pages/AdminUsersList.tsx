import { useEffect, useState, type ChangeEvent } from 'react'
import { fetchUsers, type SystemUser } from '../api/client'

export default function AdminUsersList() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadUsers = async (nextPage = page, nextPageSize = pageSize) => {
    setError(null)
    setLoading(true)
    try {
      const result = await fetchUsers({ page: nextPage, pageSize: nextPageSize })
      setUsers(result.items)
      setPage(result.page)
      setPageSize(result.pageSize)
      setTotalPages(Math.max(result.totalPages, 1))
      setTotalCount(result.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kullanıcılar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value)
    const sanitized = Number.isFinite(value) ? value : 10
    loadUsers(1, sanitized)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <main className="app-container">
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Sistem Kullanıcıları</h2>
          <button
            type="button"
            className="ghost-button"
            onClick={() => loadUsers(page, pageSize)}
            disabled={loading}
          >
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>
        <p className="section-desc" style={{ marginBottom: '1rem', color: '#64748b' }}>
          Kayıtlı tüm kullanıcıları görüntüleyin.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {loading && users.length === 0 && (
          <p className="muted-text">Kullanıcılar yükleniyor...</p>
        )}
        {!loading && users.length === 0 && !error && (
          <p className="muted-text">Henüz kullanıcı bulunmuyor.</p>
        )}
        {users.length > 0 && (
          <>
            <div className="flights-table-wrapper">
              <table className="flights-table">
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>E-posta</th>
                    <th>Rol</th>
                    <th>Oluşturulma</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const createdAt =
                      typeof u.createdTime === 'string' ? new Date(u.createdTime) : null
                    const createdAtLabel =
                      createdAt && !Number.isNaN(createdAt.getTime())
                        ? createdAt.toLocaleString('tr-TR')
                        : '—'
                    return (
                      <tr key={u.id} className="flight-row">
                        <td>
                          {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td>
                          <span className="mono">{u.email || '—'}</span>
                        </td>
                        <td>
                          <span className={`reservation-status ${
                            u.role === 'Admin' ? 'reservation-status-positive' : 'reservation-status-neutral'
                          }`}>
                            {u.role || '—'}
                          </span>
                        </td>
                        <td>{createdAtLabel}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="users-list-footer">
              <div className="users-list-info">
                Toplam {totalCount} kullanıcı
              </div>
              <div className="users-page-size">
                <label htmlFor="users-page-size-select">Sayfa boyutu</label>
                <select
                  id="users-page-size-select"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  disabled={loading}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flight-results-pagination">
                <button
                  type="button"
                  className="flight-results-pagination-btn"
                  onClick={() => loadUsers(page - 1, pageSize)}
                  disabled={loading || page <= 1}
                >
                  ‹
                </button>
                <span className="flight-results-page-num">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  className="flight-results-pagination-btn"
                  onClick={() => loadUsers(page + 1, pageSize)}
                  disabled={loading || page >= totalPages}
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
