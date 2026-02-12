import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { fetchWithAuth, getErrorMessageFromResponse } from './api/client'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import FlightSearchForm from './pages/FlightSearchForm'
import FlightSearchResults from './pages/FlightSearch'
import MainLayout from './layouts/MainLayout'
import './App.css'

function Dashboard() {
  const { user } = useAuth()
  const [flightNumber, setFlightNumber] = useState('')
  const [departure, setDeparture] = useState('')
  const [destination, setDestination] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [basePrice, setBasePrice] = useState<number | ''>('')
  const [aircraftId, setAircraftId] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [aircrafts, setAircrafts] = useState<{ id: string; model?: string; name?: string; seatCount?: number; [key: string]: unknown }[]>([])
  const [aircraftsLoading, setAircraftsLoading] = useState(false)
  const [aircraftsError, setAircraftsError] = useState<string | null>(null)

  const location = useLocation()
  const path = location.pathname
  const activeView = path === '/ucus-ekle' ? 'create' : path === '/rezervasyonlar' ? 'reservations' : path === '/havalimanlari' ? 'airports' : 'create'

  const [airports, setAirports] = useState<{ id: string; code: string; name: string; city: string; country: string }[]>([])
  const [airportsLoading, setAirportsLoading] = useState(false)
  const [airportsError, setAirportsError] = useState<string | null>(null)
  const [airportCode, setAirportCode] = useState('')
  const [airportName, setAirportName] = useState('')
  const [airportCity, setAirportCity] = useState('')
  const [airportCountry, setAirportCountry] = useState('')
  const [airportCreateLoading, setAirportCreateLoading] = useState(false)
  const [airportCreateMessage, setAirportCreateMessage] = useState<string | null>(null)
  const [airportCreateSuccess, setAirportCreateSuccess] = useState(false)

  const [reservations, setReservations] = useState<
    {
      id?: string
      flightId?: string
      flightNumber?: string
      departure?: string
      arrival?: string
      seatNumber?: string
      price?: number
      status?: string
      passengerName?: string
      passengerSurname?: string
      passengerEmail?: string
      createdTime?: string
      departureTime?: string
      [key: string]: unknown
    }[]
  >([])
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const [reservationsError, setReservationsError] = useState<string | null>(null)
  const [reservationsPage, setReservationsPage] = useState(1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)

    if (!aircraftId || !flightNumber || !departure || !destination || !departureTime || !arrivalTime || basePrice === '') {
      setErrorMessage('Lütfen tüm alanları (uçak dahil) doldurun.')
      return
    }

    try {
      setLoading(true)

      const payload = {
        aircraftId,
        flightNumber,
        departure,
        destination,
        departureTime: new Date(departureTime).toISOString(),
        arrivalTime: new Date(arrivalTime).toISOString(),
        basePrice: Number(basePrice),
        status: 1,
      }

      const res = await fetchWithAuth('flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data: any = null
      const text = await res.text()
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error('Sunucudan beklenmeyen bir yanıt alındı.')
        }
      }

      if (!res.ok || !data?.isSuccess) {
        throw new Error(getErrorMessageFromResponse(data, 'Uçuş oluşturulurken bir hata oluştu.'))
      }

      setSuccessMessage(`Uçuş başarıyla oluşturuldu. Flight ID: ${data.flightId}`)
      setAircraftId('')
      setFlightNumber('')
      setDeparture('')
      setDestination('')
      setDepartureTime('')
      setArrivalTime('')
      setBasePrice('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  const fetchReservations = React.useCallback(async () => {
    if (!user?.email) return
    try {
      setReservationsLoading(true)
      setReservationsError(null)
      const emailEncoded = encodeURIComponent(user.email)
      const res = await fetchWithAuth(`reservation/passenger/${emailEncoded}?page=${reservationsPage}`)
      const text = await res.text()
      let data: { reservations?: typeof reservations } | typeof reservations | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }
      if (!res.ok) {
        throw new Error(getErrorMessageFromResponse(data as import('./api/client').ApiErrorBody | null, 'Rezervasyonlar alınırken bir hata oluştu.'))
      }
      if (!text) {
        setReservations([])
        return
      }
      const anyData: any = data
      const list = Array.isArray(anyData)
        ? anyData
        : (anyData?.reservations ?? anyData?.items ?? anyData?.data ?? [])
      setReservations(Array.isArray(list) ? list : [])
    } catch (err) {
      setReservationsError(err instanceof Error ? err.message : 'Rezervasyonlar yüklenemedi.')
      setReservations([])
    } finally {
      setReservationsLoading(false)
    }
  }, [user?.email, reservationsPage])

  const fetchAircrafts = React.useCallback(async () => {
    try {
      setAircraftsLoading(true)
      setAircraftsError(null)
      let res = await fetchWithAuth('flight/aircrafts')
      let text = await res.text()
      if (!res.ok) {
        res = await fetchWithAuth('flight/aircrafts')
        text = await res.text()
      }
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }
      if (!res.ok) throw new Error(getErrorMessageFromResponse(data as import('./api/client').ApiErrorBody | null, 'Uçak listesi alınamadı.'))
      if (!text) {
        setAircrafts([])
        return
      }
      const obj = data as Record<string, unknown>
      const rawList = Array.isArray(data)
        ? data
        : (obj?.aircraft ?? obj?.aircrafts ?? obj?.data ?? obj?.Aircraft ?? obj?.Aircrafts ?? obj?.Data ?? [])
      const list = Array.isArray(rawList) ? rawList : []
      const normalized = list.map((item: Record<string, unknown>) => {
        const id = String(item.id ?? item.aircraftId ?? '')
        const model = item.model ?? item.Model
        const name = item.name ?? item.Name
        const tailNumber = item.tailNumber ?? item.TailNumber
        const seatCount = typeof item.seatCount === 'number' ? item.seatCount : typeof item.SeatCount === 'number' ? item.SeatCount : undefined
        const label = [model, name, tailNumber, id].find((v) => v != null && v !== '')
        return { id, model: String(label ?? id), name: label != null ? String(label) : undefined, seatCount }
      })
      setAircrafts(normalized.filter((a) => a.id))
    } catch (err) {
      setAircraftsError(err instanceof Error ? err.message : 'Uçak listesi yüklenemedi.')
      setAircrafts([])
    } finally {
      setAircraftsLoading(false)
    }
  }, [])

  const fetchAirports = React.useCallback(async () => {
    try {
      setAirportsLoading(true)
      setAirportsError(null)
      const res = await fetchWithAuth('airport')
      const text = await res.text()
      let data: { airports?: { id: string; code: string; name: string; city: string; country: string }[] } | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }
      if (!res.ok) throw new Error(getErrorMessageFromResponse(data as import('./api/client').ApiErrorBody | null, 'Havalimanları alınamadı.'))
      const raw = (data as any)?.airports ?? (data as any)?.Airports ?? []
      const list = Array.isArray(raw) ? raw.map((a: any) => ({
        id: String(a.id ?? a.Id ?? ''),
        code: String(a.code ?? a.Code ?? ''),
        name: String(a.name ?? a.Name ?? ''),
        city: String(a.city ?? a.City ?? ''),
        country: String(a.country ?? a.Country ?? ''),
      })) : []
      setAirports(list)
    } catch (err) {
      setAirportsError(err instanceof Error ? err.message : 'Havalimanları yüklenemedi.')
      setAirports([])
    } finally {
      setAirportsLoading(false)
    }
  }, [])

  const handleCreateAirport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!airportCode.trim() || !airportName.trim() || !airportCity.trim() || !airportCountry.trim()) {
      setAirportCreateMessage('Tüm alanları doldurun.')
      return
    }
    try {
      setAirportCreateLoading(true)
      setAirportCreateMessage(null)
      setAirportCreateSuccess(false)
      const res = await fetchWithAuth('airport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: airportCode.trim().toUpperCase(),
          name: airportName.trim(),
          city: airportCity.trim(),
          country: airportCountry.trim(),
        }),
      })
      const text = await res.text()
      let data: { airportId?: string; isSuccess?: boolean; message?: string } | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {}
      }
      if (!res.ok) throw new Error(getErrorMessageFromResponse(data, 'Havalimanı oluşturulamadı.'))
      setAirportCreateSuccess(true)
      setAirportCreateMessage(data?.message ?? 'Havalimanı başarıyla oluşturuldu.')
      setAirportCode('')
      setAirportName('')
      setAirportCity('')
      setAirportCountry('')
      fetchAirports()
    } catch (err) {
      setAirportCreateSuccess(false)
      setAirportCreateMessage(err instanceof Error ? err.message : 'Havalimanı oluşturulamadı.')
    } finally {
      setAirportCreateLoading(false)
    }
  }

  useEffect(() => {
    if (activeView === 'create') fetchAircrafts()
  }, [activeView, fetchAircrafts])

  useEffect(() => {
    if (activeView === 'reservations' && user?.email) fetchReservations()
  }, [activeView, user?.email, fetchReservations])

  useEffect(() => {
    if (activeView === 'airports') fetchAirports()
  }, [activeView, fetchAirports])

  return (
    <main className="app-container">
        {activeView === 'create' && (
          <section className="card">
            <h2 className="section-title">Uçuş Ekle</h2>
            {aircraftsError && <div className="alert alert-error">{aircraftsError}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="aircraft">Uçak</label>
                  <select
                    id="aircraft"
                    value={aircraftId}
                    onChange={(e) => setAircraftId(e.target.value)}
                    disabled={aircraftsLoading}
                  >
                    <option value="">
                      {aircraftsLoading ? 'Yükleniyor...' : 'Uçak seçin'}
                    </option>
                    {aircrafts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.model ?? a.name ?? a.id) as string}
                        {a.seatCount != null ? ` (${a.seatCount} koltuk)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="flightNumber">Uçuş Numarası</label>
                  <input
                    id="flightNumber"
                    type="text"
                    placeholder="PC2122"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="basePrice">Taban Fiyat (₺)</label>
                  <input
                    id="basePrice"
                    type="number"
                    min={0}
                    placeholder="3000"
                    value={basePrice}
                    onChange={(e) =>
                      setBasePrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="departure">Kalkış (IATA)</label>
                  <input
                    id="departure"
                    type="text"
                    placeholder="SAW"
                    maxLength={3}
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="destination">Varış (IATA)</label>
                  <input
                    id="destination"
                    type="text"
                    placeholder="AYT"
                    maxLength={3}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="departureTime">Kalkış Zamanı</label>
                  <input
                    id="departureTime"
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="arrivalTime">Varış Zamanı</label>
                  <input
                    id="arrivalTime"
                    type="datetime-local"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={loading}>
                  {loading ? 'Kaydediliyor...' : 'Uçuşu Oluştur'}
                </button>
              </div>
            </form>

            {successMessage && (
              <div className="alert alert-success">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="alert alert-error">
                {errorMessage}
              </div>
            )}

          </section>
        )}

        {activeView === 'reservations' && (
          <section className="card card-secondary">
            <div className="section-header">
              <h2 className="section-title">Rezervasyonlarım</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={fetchReservations}
                  disabled={reservationsLoading}
                >
                  {reservationsLoading ? 'Yenileniyor...' : 'Yenile'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (reservationsPage <= 1 || reservationsLoading) return
                    const nextPage = reservationsPage - 1
                    setReservationsPage(nextPage)
                    fetchReservations()
                  }}
                  disabled={reservationsPage <= 1 || reservationsLoading}
                >
                  Önceki
                </button>
                <span className="muted-text">Sayfa {reservationsPage}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (reservationsLoading) return
                    const nextPage = reservationsPage + 1
                    setReservationsPage(nextPage)
                    fetchReservations()
                  }}
                  disabled={reservationsLoading}
                >
                  Sonraki
                </button>
              </div>
            </div>
            <p className="muted-text" style={{ marginBottom: '1rem' }}>
              E-posta: <span className="mono">{user?.email}</span>
            </p>
            {reservationsError && (
              <div className="alert alert-error">{reservationsError}</div>
            )}
            {reservationsLoading && reservations.length === 0 && (
              <p className="muted-text">Rezervasyonlar yükleniyor...</p>
            )}
            {!reservationsLoading && reservations.length === 0 && !reservationsError && (
              <p className="muted-text">Henüz rezervasyonunuz bulunmuyor.</p>
            )}
            {reservations.length > 0 && (
              <div className="reservations-table-wrapper">
                <table className="flights-table reservations-table">
                  <thead>
                    <tr>
                      <th>Uçuş</th>
                      <th>Rota</th>
                      <th>Koltuk</th>
                      <th>Yolcu</th>
                      <th>Durum</th>
                      <th>Kalkış</th>
                      <th>Ücret</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r, idx) => (
                      <tr key={r.id ?? r.flightId ?? idx} className="flight-row">
                        <td>
                          <span className="mono">{r.flightNumber ?? '—'}</span>
                        </td>
                        <td>
                          <div className="route">
                            <span>{r.departure ?? '—'}</span>
                            <span className="route-arrow">→</span>
                            <span>{r.arrival ?? '—'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="mono">{r.seatNumber ?? '—'}</span>
                        </td>
                        <td>
                          {[r.passengerName, r.passengerSurname].filter(Boolean).join(' ') || r.passengerEmail || '—'}
                        </td>
                        <td>
                          <span className="reservation-status">{r.status ?? '—'}</span>
                        </td>
                        <td>
                          {r.departureTime ? (
                            <div className="datetime">
                              <span>
                                {new Date(r.departureTime).toLocaleDateString('tr-TR')}{' '}
                              </span>
                              <span className="datetime-secondary">
                                {new Date(r.departureTime).toLocaleTimeString('tr-TR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {typeof r.price === 'number' ? (
                            <span className="mono">
                              ₺{r.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === 'airports' && (
          <section className="card card-secondary">
            <div className="section-header">
              <h2 className="section-title">Havalimanları</h2>
              <button
                type="button"
                className="ghost-button"
                onClick={fetchAirports}
                disabled={airportsLoading}
              >
                {airportsLoading ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>

            <h3 className="section-title" style={{ marginTop: '1.5rem' }}>Yeni Havalimanı Ekle</h3>
            <form className="form-grid" onSubmit={handleCreateAirport}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="airport-code">Kod (IATA)</label>
                  <input
                    id="airport-code"
                    type="text"
                    maxLength={3}
                    placeholder="IST"
                    value={airportCode}
                    onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="airport-name">Ad</label>
                  <input
                    id="airport-name"
                    type="text"
                    placeholder="İstanbul Havalimanı"
                    value={airportName}
                    onChange={(e) => setAirportName(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="airport-city">Şehir</label>
                  <input
                    id="airport-city"
                    type="text"
                    placeholder="İstanbul"
                    value={airportCity}
                    onChange={(e) => setAirportCity(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="airport-country">Ülke</label>
                  <input
                    id="airport-country"
                    type="text"
                    placeholder="Türkiye"
                    value={airportCountry}
                    onChange={(e) => setAirportCountry(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={airportCreateLoading}>
                  {airportCreateLoading ? 'Ekleniyor...' : 'Havalimanı Ekle'}
                </button>
              </div>
            </form>
            {airportCreateMessage && (
              <div className={`alert ${airportCreateSuccess ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '1rem' }}>
                {airportCreateMessage}
              </div>
            )}

            {airportsError && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{airportsError}</div>}
            {airportsLoading && airports.length === 0 && (
              <p className="muted-text" style={{ marginTop: '1rem' }}>Havalimanları yükleniyor...</p>
            )}
            {!airportsLoading && airports.length === 0 && !airportsError && (
              <p className="muted-text" style={{ marginTop: '1rem' }}>Henüz havalimanı bulunmuyor.</p>
            )}
            {airports.length > 0 && (
              <div className="flights-table-wrapper" style={{ marginTop: '1.5rem' }}>
                <table className="flights-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ad</th>
                      <th>Şehir</th>
                      <th>Ülke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {airports.map((a) => (
                      <tr key={a.id} className="flight-row">
                        <td><span className="mono">{a.code}</span></td>
                        <td>{a.name}</td>
                        <td>{a.city}</td>
                        <td>{a.country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}


        {/* Footer - ucuzabilet FAQ tarzı */}
        <footer className="app-footer">
          <h3 className="footer-title">Sıkça Sorulan Sorular</h3>
          <div className="footer-faq">
            <div className="footer-faq-item">
              <strong>Uçuş nasıl aranır?</strong>
              <p>Kalkış (IATA), varış ve tarih girerek Uçuş Ara butonuna tıklayın.</p>
            </div>
            <div className="footer-faq-item">
              <strong>Kaç koltuk seçebilirim?</strong>
              <p>Tek rezervasyonda en fazla 3 koltuk seçebilirsiniz.</p>
            </div>
            <div className="footer-faq-item">
              <strong>Premium ve Economy farkı nedir?</strong>
              <p>Ön 10 sıra Premium (mavi), sonrası Economy (gri) koltuklardır.</p>
            </div>
          </div>
        </footer>
    </main>
  )
}

function App() {
  const { token, isReady } = useAuth()
  if (!isReady) return null
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/" element={token ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/ucus-ara" replace />} />
        <Route path="ucus-ara" element={<FlightSearchForm />} />
        <Route path="ucus-sonuclari" element={<FlightSearchResults />} />
        <Route path="ucus-ekle" element={<Dashboard />} />
        <Route path="rezervasyonlar" element={<Dashboard />} />
        <Route path="havalimanlari" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
