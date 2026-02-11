import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchWithAuth, getErrorMessageFromResponse } from './api/client'
import { getCurrentTraceparent, runWithTraceContext } from './tracing'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import './App.css'

// React Strict Mode (dev) effect'i iki kez çalıştırır; aynı isteğin iki kez gitmesini önlemek için kısa süreli dedupe
let lastFlightListFetchStart = 0
const FLIGHT_LIST_FETCH_DEBOUNCE_MS = 2000

function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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

  const [flights, setFlights] = useState<
    {
      id: string
      flightNumber: string
      departure: string
      destination: string
      departureTime: string
      arrivalTime: string
      basePrice: number
      status: string
      availableSeats: number
      totalSeats: number
    }[]
  >([])
  const [flightsLoading, setFlightsLoading] = useState(false)
  const [flightsError, setFlightsError] = useState<string | null>(null)

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [selectedFlightSeats, setSelectedFlightSeats] = useState<{
    flightId: string
    flightNumber: string
    seats: {
      id: string
      seatNumber: string
      isReserved: boolean
      price: number
      userId: string | null
    }[]
    availableSeatsCount: number
    reservedSeatsCount: number
    totalSeatsCount: number
  } | null>(null)
  const [seatsLoading, setSeatsLoading] = useState(false)
  const [seatsError, setSeatsError] = useState<string | null>(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null)
  const [reservationName, setReservationName] = useState('')
  const [reservationSurname, setReservationSurname] = useState('')
  const [reservationEmail, setReservationEmail] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [reservationLoading, setReservationLoading] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [reservationSuccess, setReservationSuccess] = useState<{
    correlationId?: string
    reservationId?: string
    message?: string
    traceparent?: string
    tracestate?: string
  } | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentResult, setPaymentResult] = useState<{
    transactionId?: string
    message?: string
  } | null>(null)
  const [activeView, setActiveView] = useState<'list' | 'create' | 'reservations'>('list')

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

  const toggleSeatSelection = (seatId: string, isReserved: boolean) => {
    if (isReserved || !selectedFlightSeats) return

    // Tek koltuk seçimi
    setSelectedSeatIds([seatId])
    setActiveSeatId(seatId)
    setReservationError(null)
    setReservationSuccess(null)
    setReservationName('')
    setReservationSurname('')
    setReservationEmail('')
  }

  const seatRows =
    selectedFlightSeats &&
    (() => {
      const rows: Record<number, typeof selectedFlightSeats.seats> = {}

      for (const seat of selectedFlightSeats.seats) {
        const rowNumber = parseInt(seat.seatNumber, 10)
        if (Number.isNaN(rowNumber)) continue
        if (!rows[rowNumber]) {
          rows[rowNumber] = []
        }
        rows[rowNumber].push(seat)
      }

      const totalRows = Math.max(
        1,
        Math.ceil((selectedFlightSeats.totalSeatsCount || selectedFlightSeats.seats.length) / 6),
      )

      return Array.from({ length: totalRows }, (_, idx) => idx + 1).map((row) => {
        const seatsForRow = (rows[row] ?? []).slice().sort((a, b) => a.seatNumber.localeCompare(b.seatNumber))
        const left = seatsForRow.filter((s) =>
          ['A', 'B', 'C'].includes(s.seatNumber.slice(-1)),
        )
        const right = seatsForRow.filter((s) =>
          ['D', 'E', 'F'].includes(s.seatNumber.slice(-1)),
        )
        return { row, left, right }
      })
    })()

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

  const fetchFlights = async () => {
    try {
      setFlightsLoading(true)
      setFlightsError(null)
      const res = await fetchWithAuth('flight')
      const text = await res.text()

      let data: any = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }

      if (!res.ok) {
        throw new Error(getErrorMessageFromResponse(data, 'Uçuşlar alınırken bir hata oluştu.'))
      }

      if (!text) {
        setFlights([])
        return
      }

      setFlights(data?.flights ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setFlightsError(message)
    } finally {
      setFlightsLoading(false)
    }
  }

  const fetchSeats = async (flightId: string) => {
    try {
      setSeatsLoading(true)
      setSeatsError(null)
      setSelectedFlightSeats(null)
      setSelectedFlightId(flightId)
      setSelectedSeatIds([])
      setActiveSeatId(null)
      setReservationError(null)
      setReservationSuccess(null)

      const res = await fetchWithAuth(`flight/${flightId}/seats`)
      const text = await res.text()

      let data: any = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }

      if (!res.ok) {
        throw new Error(getErrorMessageFromResponse(data, 'Koltuklar alınırken bir hata oluştu.'))
      }

      if (!text) {
        throw new Error('Bu uçuş için koltuk bilgisi bulunamadı.')
      }

      setSelectedFlightSeats(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setSeatsError(message)
    } finally {
      setSeatsLoading(false)
    }
  }

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFlightSeats || !activeSeatId) return

    const activeSeat = selectedFlightSeats.seats.find((s) => s.id === activeSeatId)
    if (!activeSeat) return

    if (!reservationName || !reservationSurname || !reservationEmail) {
      setReservationError('Lütfen yolcu adı, soyadı ve e-posta alanlarını doldurun.')
      return
    }

    try {
      setReservationLoading(true)
      setReservationError(null)

      const payload = {
        flightId: selectedFlightSeats.flightId,
        seatNumber: activeSeat.seatNumber,
        price: activeSeat.price,
        passengerName: reservationName,
        passengerSurname: reservationSurname,
        passengerEmail: reservationEmail,
      }

      const res = await fetchWithAuth('reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Cevap gelir gelmez traceparent al (body okunmadan; aktif span hâlâ rezervasyon isteği)
      let traceparent = res.headers.get('traceparent') ?? undefined
      let tracestate = res.headers.get('tracestate') ?? undefined
      if (!traceparent) {
        const fromSpan = getCurrentTraceparent()
        if (fromSpan) traceparent = fromSpan
      }

      const text = await res.text()
      let data: any = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          // JSON değilse, sadece mesaj gösteririz
        }
      }

      if (!res.ok || data?.isSuccess === false) {
        throw new Error(getErrorMessageFromResponse(data, 'Rezervasyon oluşturulurken bir hata oluştu.'))
      }

      // Body'de traceparent dönüyorsa onu da kullan (backend bazen header yerine body'de verir)
      const finalTraceparent = traceparent ?? data?.traceparent ?? undefined
      const finalTracestate = tracestate ?? data?.tracestate ?? undefined

      setReservationSuccess({
        correlationId: data?.correlationId,
        reservationId: data?.reservationId,
        message: data?.message || 'Rezervasyon oluşturuldu. Ödemeyi tamamlayın.',
        traceparent: finalTraceparent,
        tracestate: finalTracestate,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setReservationError(message)
    } finally {
      setReservationLoading(false)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setReservationError(null)

    if (!reservationSuccess?.reservationId || !reservationSuccess?.correlationId || !selectedFlightSeats || !activeSeatId) {
      setReservationError(reservationSuccess?.reservationId && !reservationSuccess?.correlationId
        ? 'Rezervasyon cevabında correlationId yok; ödeme yapılamıyor.'
        : 'Rezervasyon bilgisi eksik.')
      return
    }

    const activeSeat = selectedFlightSeats.seats.find((s) => s.id === activeSeatId)
    if (!activeSeat) {
      setReservationError('Koltuk bilgisi bulunamadı.')
      return
    }

    const cardNumDigits = cardNumber.replace(/\s/g, '')
    if (cardNumDigits.length !== 16 || !/^\d+$/.test(cardNumDigits)) {
      setReservationError('Geçerli bir kart numarası girin (16 rakam).')
      return
    }
    const [expMonth, expYear] = cardExpiry.split('/')
    const month = parseInt(expMonth, 10)
    const year = parseInt(expYear, 10)
    const currentYear = new Date().getFullYear() % 100
    const currentMonth = new Date().getMonth() + 1
    if (
      !expMonth ||
      !expYear ||
      month < 1 ||
      month > 12 ||
      year < currentYear ||
      (year === currentYear && month < currentMonth)
    ) {
      setReservationError('Geçerli bir son kullanma tarihi girin (MM/YY).')
      return
    }
    if (!/^\d{3,4}$/.test(cardCvv.trim())) {
      setReservationError('CVV 3 veya 4 rakam olmalıdır.')
      return
    }
    if (!cardholderName.trim()) {
      setReservationError('Kart sahibi adını girin.')
      return
    }

    try {
      setPaymentLoading(true)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

      const payload = {
        correlationId: reservationSuccess.correlationId,
        reservationId: reservationSuccess.reservationId,
        amount: activeSeat.price,
        expiresAt,
        cardNumber: cardNumDigits,
      }

      const paymentHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (reservationSuccess.traceparent) paymentHeaders['traceparent'] = reservationSuccess.traceparent
      if (reservationSuccess.tracestate) paymentHeaders['tracestate'] = reservationSuccess.tracestate

      const doPaymentFetch = () =>
        fetchWithAuth('payment/process', {
          method: 'POST',
          headers: paymentHeaders,
          body: JSON.stringify(payload),
        })

      const res =
        reservationSuccess.traceparent != null
          ? await runWithTraceContext(
              reservationSuccess.traceparent,
              reservationSuccess.tracestate,
              doPaymentFetch
            )
          : await doPaymentFetch()

      const text = await res.text()
      let data: { success?: boolean; transactionId?: string; message?: string; code?: string | null } | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          // ignore
        }
      }

      if (!res.ok || data?.success !== true) {
        throw new Error(data?.message ?? 'Ödeme işlenirken bir hata oluştu.')
      }

      setPaymentResult({
        transactionId: data.transactionId,
        message: data.message ?? 'Ödeme başarıyla tamamlandı.',
      })
      setPaymentComplete(true)
      setCardNumber('')
      setCardExpiry('')
      setCardCvv('')
      setCardholderName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ödeme işlenirken bir hata oluştu.'
      setReservationError(message)
    } finally {
      setPaymentLoading(false)
    }
  }

  useEffect(() => {
    if (!activeSeatId) return
    setReservationSuccess(null)
    setPaymentComplete(false)
    setPaymentResult(null)
  }, [activeSeatId])

  const fetchReservations = React.useCallback(async () => {
    if (!user?.email) return
    try {
      setReservationsLoading(true)
      setReservationsError(null)
      const emailEncoded = encodeURIComponent(user.email)
      const res = await fetchWithAuth(`reservation/passenger/${emailEncoded}`)
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
      const list = Array.isArray(data) ? data : (data?.reservations ?? [])
      setReservations(Array.isArray(list) ? list : [])
    } catch (err) {
      setReservationsError(err instanceof Error ? err.message : 'Rezervasyonlar yüklenemedi.')
      setReservations([])
    } finally {
      setReservationsLoading(false)
    }
  }, [user?.email])

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

  useEffect(() => {
    const now = Date.now()
    if (now - lastFlightListFetchStart < FLIGHT_LIST_FETCH_DEBOUNCE_MS) return
    lastFlightListFetchStart = now
    fetchFlights()
  }, [])

  useEffect(() => {
    if (activeView === 'create') fetchAircrafts()
  }, [activeView, fetchAircrafts])

  useEffect(() => {
    if (activeView === 'reservations' && user?.email) fetchReservations()
  }, [activeView, user?.email, fetchReservations])

  return (
    <div className="app-root">
      <div className="app-gradient" />
      <main className="app-container">
        <header className="app-header">
          <div className="app-header-main">
            <div>
              <h1 className="app-title">SkySync - Uçuş Yönetimi</h1>
              <p className="app-subtitle">
                Uçuşları görüntüleyin, koltuk seçin ve rezervasyon oluşturun.
              </p>
            </div>
            <div className="app-header-right">
              {user && (
                <span className="app-user">
                  {user.firstName} {user.lastName}
                </span>
              )}
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                Çıkış
              </button>
              <nav className="view-toggle">
              <button
                type="button"
                className={
                  activeView === 'list'
                    ? 'view-toggle-button view-toggle-button-active'
                    : 'view-toggle-button'
                }
                onClick={() => setActiveView('list')}
              >
                Uçuşlar
              </button>
              <button
                type="button"
                className={
                  activeView === 'create'
                    ? 'view-toggle-button view-toggle-button-active'
                    : 'view-toggle-button'
                }
                onClick={() => setActiveView('create')}
              >
                Uçuş Ekle
              </button>
              <button
                type="button"
                className={
                  activeView === 'reservations'
                    ? 'view-toggle-button view-toggle-button-active'
                    : 'view-toggle-button'
                }
                onClick={() => setActiveView('reservations')}
              >
                Rezervasyonlarım
              </button>
            </nav>
            </div>
          </div>
        </header>

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
              <button
                type="button"
                className="ghost-button"
                onClick={fetchReservations}
                disabled={reservationsLoading}
              >
                {reservationsLoading ? 'Yenileniyor...' : 'Yenile'}
              </button>
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

        {activeView === 'list' && (
        <section className="card card-secondary">
          <div className="section-header">
            <h2 className="section-title">Uçuş Listesi</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={fetchFlights}
              disabled={flightsLoading}
            >
              {flightsLoading ? 'Yenileniyor...' : 'Listeyi Yenile'}
            </button>
          </div>

          {flightsError && <div className="alert alert-error">{flightsError}</div>}

          {flights.length === 0 && !flightsLoading && !flightsError && (
            <p className="muted-text">Henüz kayıtlı bir uçuş bulunmuyor.</p>
          )}

          {flights.length > 0 && (
            <div className="flights-table-wrapper">
              <table className="flights-table">
                <thead>
                  <tr>
                    <th>Uçuş</th>
                    <th>Rota</th>
                    <th>Kalkış</th>
                    <th>Varış</th>
                    <th>Fiyat</th>
                    <th>Koltuk</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map((f) => (
                    <tr
                      key={f.id}
                      className={selectedFlightId === f.id ? 'flight-row active' : 'flight-row'}
                    >
                      <td>
                        <div className="mono">{f.flightNumber}</div>
                      </td>
                      <td>
                        <div className="route">
                          <span>{f.departure}</span>
                          <span className="route-arrow">→</span>
                          <span>{f.destination}</span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>
                            {new Date(f.departureTime).toLocaleDateString('tr-TR')}{' '}
                          </span>
                          <span className="datetime-secondary">
                            {new Date(f.departureTime).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>
                            {new Date(f.arrivalTime).toLocaleDateString('tr-TR')}{' '}
                          </span>
                          <span className="datetime-secondary">
                            {new Date(f.arrivalTime).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="mono">
                          ₺{f.basePrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const totalSeats =
                            f.totalSeats && f.totalSeats > 0
                              ? f.totalSeats
                              : selectedFlightSeats && selectedFlightSeats.flightId === f.id
                                ? selectedFlightSeats.totalSeatsCount
                                : f.availableSeats

                          return (
                            <div className="seats-pill">
                              {typeof totalSeats === 'number' ? totalSeats : ''}
                            </div>
                          )
                        })()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => fetchSeats(f.id)}
                        >
                          Koltukları Gör
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {seatsLoading && (
            <div className="muted-text" style={{ marginTop: '1rem' }}>
              Koltuk bilgileri yükleniyor...
            </div>
          )}

          {seatsError && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              {seatsError}
            </div>
          )}

          {selectedFlightSeats && !seatsLoading && (
            <div className="seats-section">
              <div className="seats-header">
                <div>
                  <div className="seats-title">
                    {selectedFlightSeats.flightNumber} koltuk planı
                  </div>
                  <div className="seats-subtitle">
                    Boş: {selectedFlightSeats.availableSeatsCount} · Dolu:{' '}
                    {selectedFlightSeats.reservedSeatsCount} · Toplam:{' '}
                    {selectedFlightSeats.totalSeatsCount}
                  </div>
                </div>
                <div className="seats-legend">
                  <span className="seat-box seat-free">Boş</span>
                  <span className="seat-box seat-reserved">Dolu</span>
                  <span className="seat-box seat-premium">Premium</span>
                  <span className="seat-box seat-economy">Economy</span>
                </div>
              </div>

              <div className="plane-wrapper">
                <div className="plane-wing-left" />
                <div className="plane-wing-right" />
                <div className="plane-tail-fin" />
                <div className="plane-body">
                  <div className="aisle-hint">Ön</div>
                  <div className="seats-grid">
                    {seatRows &&
                      seatRows.map(({ row, left, right }) => {
                        const rowClass =
                          row <= 10
                            ? 'seat-premium'
                            : 'seat-economy'

                        const renderSeatButton = (seat: (typeof selectedFlightSeats.seats)[number], side: 'left' | 'right') => {
                          const isSelected = selectedSeatIds.includes(seat.id)
                          const baseClass = seat.isReserved
                            ? 'seat-item seat-item-reserved'
                            : 'seat-item seat-item-free'
                          const sideClass = side === 'left' ? 'seat-left' : 'seat-right'
                          const className = `${baseClass} ${sideClass} ${rowClass}${
                            isSelected ? ' seat-item-selected' : ''
                          }`

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              className={className}
                              onClick={() => toggleSeatSelection(seat.id, seat.isReserved)}
                            >
                              <span className="seat-number">{seat.seatNumber}</span>
                            </button>
                          )
                        }

                        return (
                          <div className="seat-row" key={row}>
                            <div className="seat-row-label">{row}</div>
                            <div className="seat-row-inner">
                              <div className="seat-row-cluster">
                                {['A', 'B', 'C'].map((letter) => {
                                  const seat = left.find((s) => s.seatNumber.endsWith(letter))
                                  return seat
                                    ? renderSeatButton(seat, 'left')
                                    : (
                                      <div
                                        key={`L-${row}-${letter}`}
                                        className="seat-spacer"
                                      />
                                    )
                                })}
                              </div>
                              <div className="aisle-spacer" />
                              <div className="seat-row-cluster">
                                {['D', 'E', 'F'].map((letter) => {
                                  const seat = right.find((s) => s.seatNumber.endsWith(letter))
                                  return seat
                                    ? renderSeatButton(seat, 'right')
                                    : (
                                      <div
                                        key={`R-${row}-${letter}`}
                                        className="seat-spacer"
                                      />
                                    )
                                })}
                              </div>
                            </div>
                            <div className="seat-row-label seat-row-label-right">{row}</div>
                          </div>
                        )
                      })}
                  </div>
                  <div className="aisle-hint aisle-back">Arka</div>
                </div>
              </div>

              {activeSeatId && (
                <div className="selected-seats-info">
                  <div>
                    Seçili koltuk:{' '}
                    <span className="mono">
                      {
                        selectedFlightSeats.seats.find((s) => s.id === activeSeatId)
                          ?.seatNumber
                      }
                    </span>
                  </div>
                </div>
              )}

              {activeSeatId && (
                <div className="reservation-card">
                  <h3 className="section-title">Yolcu Bilgileri</h3>

                  {!reservationSuccess && (
                    <form className="form-grid" onSubmit={handleReservationSubmit}>
                      <div className="form-row">
                        <div className="form-field">
                          <label>Uçuş</label>
                          <input
                            type="text"
                            value={selectedFlightSeats.flightNumber}
                            disabled
                          />
                        </div>
                        <div className="form-field">
                          <label>Koltuk</label>
                          <input
                            type="text"
                            value={
                              selectedFlightSeats.seats.find((s) => s.id === activeSeatId)
                                ?.seatNumber ?? ''
                            }
                            disabled
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-field">
                          <label>Ad</label>
                          <input
                            type="text"
                            placeholder="Örn. Ahmet"
                            value={reservationName}
                            onChange={(e) => setReservationName(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label>Soyad</label>
                          <input
                            type="text"
                            placeholder="Örn. Yılmaz"
                            value={reservationSurname}
                            onChange={(e) => setReservationSurname(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-field">
                          <label>E-posta</label>
                          <input
                            type="email"
                            placeholder="ornek@mail.com"
                            value={reservationEmail}
                            onChange={(e) => setReservationEmail(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label>Ücret</label>
                          <input
                            type="text"
                            disabled
                            value={
                              '₺' +
                              (selectedFlightSeats.seats.find((s) => s.id === activeSeatId)
                                ?.price ?? 0).toLocaleString('tr-TR', {
                                maximumFractionDigits: 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" disabled={reservationLoading}>
                          {reservationLoading
                            ? 'Rezervasyon Oluşturuluyor...'
                            : 'Rezervasyonu Oluştur'}
                        </button>
                      </div>
                    </form>
                  )}

                  {reservationSuccess && !paymentComplete && (
                    <>
                      <div className="reservation-created-banner">
                        <span className="reservation-created-text">
                          Rezervasyon oluşturuldu.
                          {reservationSuccess.reservationId && (
                            <> Rezervasyon no: <span className="mono">{reservationSuccess.reservationId}</span></>
                          )}{' '}
                          Ödemeye geçin.
                        </span>
                      </div>
                      <form className="form-grid" onSubmit={handlePaymentSubmit}>
                        <div className="card-details-section">
                          <h4 className="card-details-title">Kart Bilgileri</h4>
                          <p className="card-details-hint">Ödeme demo amaçlıdır; kart bilgileriniz kaydedilmez.</p>
                          <div className="form-row">
                            <div className="form-field form-field-full">
                              <label>Kart Numarası</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="cc-number"
                                placeholder="1234 5678 9012 3456"
                                maxLength={19}
                                value={cardNumber}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                                  setCardNumber(v.replace(/(\d{4})(?=\d)/g, '$1 ').trim())
                                }}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Son Kullanma Tarihi</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="cc-exp"
                                placeholder="MM/YY"
                                maxLength={5}
                                value={cardExpiry}
                                onChange={(e) => {
                                  let v = e.target.value.replace(/\D/g, '')
                                  if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4)
                                  setCardExpiry(v)
                                }}
                              />
                            </div>
                            <div className="form-field">
                              <label>CVV</label>
                              <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="cc-csc"
                                placeholder="123"
                                maxLength={4}
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              />
                              <span className="form-field-hint">Kartın arkasındaki 3 veya 4 rakam</span>
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-field form-field-full">
                              <label>Kart Üzerindeki İsim</label>
                              <input
                                type="text"
                                autoComplete="cc-name"
                                placeholder="AD SOYAD"
                                value={cardholderName}
                                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="form-actions">
                          <button type="submit" disabled={paymentLoading}>
                            {paymentLoading ? 'Ödeme işleniyor...' : 'Ödemeyi Tamamla'}
                          </button>
                        </div>
                      </form>
                    </>
                  )}

                  {paymentComplete && reservationSuccess && (
                    <div className="payment-panel">
                      <div className="payment-title">Ödeme Tamamlandı</div>
                      <div className="payment-text">
                        {paymentResult?.message ?? reservationSuccess.message}
                      </div>
                      {reservationSuccess.reservationId && (
                        <div className="payment-text">
                          Rezervasyon no: <span className="mono">{reservationSuccess.reservationId}</span>
                        </div>
                      )}
                      {paymentResult?.transactionId && (
                        <div className="payment-text">
                          İşlem no: <span className="mono">{paymentResult.transactionId}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {reservationError && (
                    <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
                      {reservationError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        )}
      </main>
    </div>
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
      <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
