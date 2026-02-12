import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchWithAuth, getErrorMessageFromResponse } from '../api/client'
import { getCurrentTraceparent, runWithTraceContext } from '../tracing'
import '../App.css'

const FLIGHT_LIST_PAGE_SIZE = 20
const MAX_SELECTABLE_SEATS = 3

function normalizeFlight(f: Record<string, unknown>): {
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
} {
  return {
    id: String(f.id ?? f.Id ?? ''),
    flightNumber: String(f.flightNumber ?? f.FlightNumber ?? ''),
    departure: String(f.departure ?? f.Departure ?? ''),
    destination: String(f.destination ?? f.Destination ?? ''),
    departureTime: String(f.departureTime ?? f.DepartureTime ?? ''),
    arrivalTime: String(f.arrivalTime ?? f.ArrivalTime ?? ''),
    basePrice: Number(f.basePrice ?? f.BasePrice ?? 0),
    status: String(f.status ?? f.Status ?? ''),
    availableSeats: Number(f.availableSeats ?? f.AvailableSeats ?? 0),
    totalSeats: Number(f.totalSeats ?? f.TotalSeats ?? 0),
  }
}

export default function FlightSearchResults() {
  const [searchParams] = useSearchParams()
  const depFromUrl = searchParams.get('departure') ?? ''
  const destFromUrl = searchParams.get('destination') ?? ''
  const dateFromUrl = searchParams.get('date') ?? ''
  const returnDateFromUrl = searchParams.get('returnDate') ?? ''
  const tripTypeFromUrl = (searchParams.get('tripType') ?? 'oneWay') as 'oneWay' | 'roundTrip'

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
  const [flightsPage, setFlightsPage] = useState(1)
  const [returnFlights, setReturnFlights] = useState<
    { id: string; flightNumber: string; departure: string; destination: string; departureTime: string; arrivalTime: string; basePrice: number; status: string; availableSeats: number; totalSeats: number }[]
  >([])

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
    seatNumber?: string
    amount?: number
  }[] | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentResult, setPaymentResult] = useState<{
    transactionId?: string
    message?: string
  } | null>(null)

  const toggleSeatSelection = (seatId: string, isReserved: boolean) => {
    if (isReserved || !selectedFlightSeats) return
    setSelectedSeatIds((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId)
      if (prev.length >= MAX_SELECTABLE_SEATS) return prev
      return [...prev, seatId]
    })
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
        if (!rows[rowNumber]) rows[rowNumber] = []
        rows[rowNumber].push(seat)
      }
      const totalRows = Math.max(
        1,
        Math.ceil((selectedFlightSeats.totalSeatsCount || selectedFlightSeats.seats.length) / 6),
      )
      return Array.from({ length: totalRows }, (_, idx) => idx + 1).map((row) => {
        const seatsForRow = (rows[row] ?? []).slice().sort((a, b) => a.seatNumber.localeCompare(b.seatNumber))
        const left = seatsForRow.filter((s) => ['A', 'B', 'C'].includes(s.seatNumber.slice(-1)))
        const right = seatsForRow.filter((s) => ['D', 'E', 'F'].includes(s.seatNumber.slice(-1)))
        return { row, left, right }
      })
    })()

  const doFetchFlights = async (dep: string, dest: string, date: string, page: number) => {
    const params = new URLSearchParams()
    params.append('departure', dep)
    params.append('destination', dest)
    params.append('departureDate', date)
    params.append('page', String(page))
    params.append('pageSize', String(FLIGHT_LIST_PAGE_SIZE))
    const res = await fetchWithAuth(`flight?${params.toString()}`)
    const text = await res.text()
    let data: any = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        if (!res.ok) throw new Error(text)
      }
    }
    if (!res.ok) throw new Error(getErrorMessageFromResponse(data, 'Uçuşlar alınırken bir hata oluştu.'))
    const raw = Array.isArray(data) ? data : (data?.flights ?? data?.Flights ?? data?.items ?? data?.data ?? [])
    return Array.isArray(raw) ? raw.map((f: Record<string, unknown>) => normalizeFlight(f)) : []
  }

  const fetchFlights = useCallback(async (page: number) => {
    const dep = depFromUrl.trim().toUpperCase()
    const dest = destFromUrl.trim().toUpperCase()
    const date = dateFromUrl.trim()
    const returnDate = returnDateFromUrl.trim()

    if (!dep || !dest || !date) {
      setFlightsError('Lütfen kalkış, varış ve tarih girdilerini doldurun.')
      setFlights([])
      return
    }

    if (tripTypeFromUrl === 'roundTrip' && !returnDate) {
      setFlightsError('Gidiş-dönüş için dönüş tarihini girin.')
      setFlights([])
      return
    }

    try {
      setFlightsLoading(true)
      setFlightsError(null)
      setReturnFlights([])
      const outboundList = await doFetchFlights(dep, dest, date, page)
      setFlights(outboundList)

      if (tripTypeFromUrl === 'roundTrip' && returnDate) {
        const returnList = await doFetchFlights(dest, dep, returnDate, 1)
        setReturnFlights(returnList)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setFlightsError(message)
      setFlights([])
    } finally {
      setFlightsLoading(false)
    }
  }, [depFromUrl, destFromUrl, dateFromUrl, returnDateFromUrl, tripTypeFromUrl])

  useEffect(() => {
    if (depFromUrl && destFromUrl && dateFromUrl) {
      fetchFlights(1)
    }
  }, [depFromUrl, destFromUrl, dateFromUrl, returnDateFromUrl, tripTypeFromUrl, fetchFlights])

  const closeSeats = useCallback(() => {
    setSelectedFlightSeats(null)
    setSelectedFlightId(null)
    setSelectedSeatIds([])
    setReservationError(null)
    setReservationSuccess(null)
  }, [])

  const fetchSeats = async (flightId: string) => {
    if (selectedFlightId === flightId && selectedFlightSeats) {
      closeSeats()
      return
    }
    try {
      setSeatsLoading(true)
      setSeatsError(null)
      setSelectedFlightSeats(null)
      setSelectedFlightId(flightId)
      setSelectedSeatIds([])
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
    if (!selectedFlightSeats || selectedSeatIds.length === 0) return

    const seatsToReserve = selectedFlightSeats.seats.filter((s) => selectedSeatIds.includes(s.id))
    if (seatsToReserve.length === 0) return

    if (!reservationName || !reservationSurname || !reservationEmail) {
      setReservationError('Lütfen yolcu adı, soyadı ve e-posta alanlarını doldurun.')
      return
    }

    try {
      setReservationLoading(true)
      setReservationError(null)

      const results: { correlationId?: string; reservationId?: string; message?: string; traceparent?: string; tracestate?: string; seatNumber?: string; amount?: number }[] = []

      for (const seat of seatsToReserve) {
        const payload = {
          flightId: selectedFlightSeats.flightId,
          seatNumber: seat.seatNumber,
          price: seat.price,
          passengerName: reservationName,
          passengerSurname: reservationSurname,
          passengerEmail: reservationEmail,
        }

        const res = await fetchWithAuth('reservation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

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
          } catch {}
        }

        if (!res.ok || data?.isSuccess === false) {
          throw new Error(getErrorMessageFromResponse(data, 'Rezervasyon oluşturulurken bir hata oluştu.'))
        }

        results.push({
          correlationId: data?.correlationId,
          reservationId: data?.reservationId,
          message: data?.message || 'Rezervasyon oluşturuldu.',
          traceparent: traceparent ?? data?.traceparent ?? undefined,
          tracestate: tracestate ?? data?.tracestate ?? undefined,
          seatNumber: seat.seatNumber,
          amount: seat.price,
        })
      }

      setReservationSuccess(results)
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

    if (!reservationSuccess?.length || !selectedFlightSeats) {
      setReservationError('Rezervasyon bilgisi eksik.')
      return
    }

    const hasInvalid = reservationSuccess.some((r) => !r.reservationId || !r.correlationId)
    if (hasInvalid) {
      setReservationError('Rezervasyon cevabında correlationId yok; ödeme yapılamıyor.')
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
      const transactionIds: string[] = []

      for (const resv of reservationSuccess) {
        const payload = {
          correlationId: resv.correlationId,
          reservationId: resv.reservationId,
          amount: resv.amount ?? 0,
          expiresAt,
          cardNumber: cardNumDigits,
        }

        const paymentHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (resv.traceparent) paymentHeaders['traceparent'] = resv.traceparent
        if (resv.tracestate) paymentHeaders['tracestate'] = resv.tracestate

        const doPaymentFetch = () =>
          fetchWithAuth('payment/process', {
            method: 'POST',
            headers: paymentHeaders,
            body: JSON.stringify(payload),
          })

        const res =
          resv.traceparent != null
            ? await runWithTraceContext(resv.traceparent, resv.tracestate, doPaymentFetch)
            : await doPaymentFetch()

        const text = await res.text()
        let data: { success?: boolean; transactionId?: string; message?: string; code?: string | null } | null = null
        if (text) {
          try {
            data = JSON.parse(text)
          } catch {}
        }

        if (!res.ok || data?.success !== true) {
          throw new Error(data?.message ?? 'Ödeme işlenirken bir hata oluştu.')
        }

        if (data?.transactionId) transactionIds.push(data.transactionId)
      }

      setPaymentResult({
        transactionId: transactionIds.join(', '),
        message: `${reservationSuccess.length} rezervasyon için ödeme başarıyla tamamlandı.`,
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
    if (selectedSeatIds.length === 0) return
    setReservationSuccess(null)
    setPaymentComplete(false)
    setPaymentResult(null)
  }, [selectedSeatIds])

  const hasParams = depFromUrl && destFromUrl && dateFromUrl

  if (!hasParams) {
    return (
      <main className="app-container flight-search-page flight-results-page">
        <section className="flight-results-section">
          <div className="flight-results-empty">
            <div className="flight-results-empty-icon">✈</div>
            <p className="flight-results-empty-title">Arama yapın</p>
            <p className="flight-results-empty-desc">Uçuş sonuçlarını görmek için kalkış, varış ve tarih bilgilerini girin.</p>
            <Link to="/ucus-ara" className="flight-results-new-search-btn">
              Uçuş Ara Sayfasına Git
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-container flight-search-page flight-results-page">
      <section className="flight-results-section">
        <div className="flight-results-header">
          <div className="flight-results-summary">
            <h2 className="flight-results-title">Uçuş Sonuçları</h2>
            {hasParams && (
              <div className="flight-results-route-badge">
                <span className="route-from">{depFromUrl}</span>
                <span className="route-arrow-badge">→</span>
                <span className="route-to">{destFromUrl}</span>
                <span className="route-dates">
                  {dateFromUrl}
                  {tripTypeFromUrl === 'roundTrip' && returnDateFromUrl ? ` / ${returnDateFromUrl}` : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flight-results-actions">
            <Link to="/ucus-ara" className="flight-results-new-search-btn">
              <span>✈</span>
              Yeni Arama
            </Link>
            {hasParams && (
              <div className="flight-results-pagination">
                <button
                  type="button"
                  className="flight-results-pagination-btn"
                  onClick={() => fetchFlights(flightsPage)}
                  disabled={flightsLoading}
                  title="Yenile"
                >
                  {flightsLoading ? '···' : '↻'}
                </button>
                <button
                  type="button"
                  className="flight-results-pagination-btn"
                  onClick={() => {
                    if (flightsPage <= 1 || flightsLoading) return
                    const nextPage = flightsPage - 1
                    setFlightsPage(nextPage)
                    fetchFlights(nextPage)
                  }}
                  disabled={flightsPage <= 1 || flightsLoading}
                >
                  ‹
                </button>
                <span className="flight-results-page-num">Sayfa {flightsPage}</span>
                <button
                  type="button"
                  className="flight-results-pagination-btn"
                  onClick={() => {
                    if (flightsLoading) return
                    const nextPage = flightsPage + 1
                    setFlightsPage(nextPage)
                    fetchFlights(nextPage)
                  }}
                  disabled={flightsLoading}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {flightsLoading && flights.length === 0 && (
          <div className="flight-results-loading">
            <div className="flight-results-spinner" />
            <p>Uçuşlar aranıyor...</p>
          </div>
        )}

        {flightsError && <div className="alert alert-error">{flightsError}</div>}

        {flights.length === 0 && returnFlights.length === 0 && !flightsLoading && !flightsError && (
          <div className="flight-results-empty">
            <div className="flight-results-empty-icon">✈</div>
            <p className="flight-results-empty-title">Uçuş bulunamadı</p>
            <p className="flight-results-empty-desc">Bu rota ve tarih için henüz kayıtlı uçuş bulunmuyor.</p>
            <Link to="/ucus-ara" className="flight-results-new-search-btn">
              Farklı arama yap
            </Link>
          </div>
        )}

        {flights.length > 0 && (
          <div className="flights-section flight-results-list">
            {tripTypeFromUrl === 'roundTrip' && (
              <h3 className="flights-section-title">Gidiş uçuşları ({depFromUrl} → {destFromUrl})</h3>
            )}
            <div className="flights-table-wrapper flight-results-table-modern">
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
                      <td><div className="mono">{f.flightNumber}</div></td>
                      <td>
                        <div className="route">
                          <span>{f.departure}</span>
                          <span className="route-arrow">→</span>
                          <span>{f.destination}</span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>{new Date(f.departureTime).toLocaleDateString('tr-TR')} </span>
                          <span className="datetime-secondary">
                            {new Date(f.departureTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>{new Date(f.arrivalTime).toLocaleDateString('tr-TR')} </span>
                          <span className="datetime-secondary">
                            {new Date(f.arrivalTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
                          className={
                            selectedFlightId === f.id && selectedFlightSeats
                              ? 'flight-select-seat-btn active'
                              : 'flight-select-seat-btn'
                          }
                          onClick={() => fetchSeats(f.id)}
                        >
                          {selectedFlightId === f.id && selectedFlightSeats
                            ? 'Koltukları Kapat'
                            : 'Koltuk Seç'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {returnFlights.length > 0 && (
          <div className="flights-section" style={{ marginTop: '1.5rem' }}>
            <h3 className="flights-section-title">Dönüş uçuşları ({destFromUrl} → {depFromUrl})</h3>
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
                  {returnFlights.map((f) => (
                    <tr key={f.id} className="flight-row">
                      <td><div className="mono">{f.flightNumber}</div></td>
                      <td>
                        <div className="route">
                          <span>{f.departure}</span>
                          <span className="route-arrow">→</span>
                          <span>{f.destination}</span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>{new Date(f.departureTime).toLocaleDateString('tr-TR')} </span>
                          <span className="datetime-secondary">
                            {new Date(f.departureTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="datetime">
                          <span>{new Date(f.arrivalTime).toLocaleDateString('tr-TR')} </span>
                          <span className="datetime-secondary">
                            {new Date(f.arrivalTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td><div className="mono">₺{f.basePrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</div></td>
                      <td><div className="seats-pill">{f.totalSeats ?? f.availableSeats ?? ''}</div></td>
                      <td>
                        <button
                          type="button"
                          className="flight-select-seat-btn"
                          onClick={() => fetchSeats(f.id)}
                        >
                          Koltuk Seç
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {seatsLoading && (
          <div className="flight-results-loading" style={{ marginTop: '1.5rem', padding: '2rem' }}>
            <div className="flight-results-spinner" />
            <p>Koltuk planı yükleniyor...</p>
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
                <div className="seats-title">{selectedFlightSeats.flightNumber} kabin planı</div>
                <div className="seats-subtitle">
                  Boş: {selectedFlightSeats.availableSeatsCount} · Dolu: {selectedFlightSeats.reservedSeatsCount} · Toplam: {selectedFlightSeats.totalSeatsCount}
                </div>
              </div>
              <div className="seats-header-right">
                <div className="seats-legend">
                  <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-free" /> Boş</span>
                  <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-reserved" /> Dolu</span>
                  <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-selected" /> Seçili</span>
                  <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-premium" /> Premium</span>
                  <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-economy" /> Economy</span>
                </div>
                <button type="button" className="seats-close-btn" onClick={closeSeats} title="Koltuk planını kapat">
                  Kapat
                </button>
              </div>
            </div>

            <div className="plane-wrapper">
              <div className="plane-stage-glow" />
              <div className="plane-wing-left" />
              <div className="plane-wing-right" />
              <div className="plane-tail-fin" />
              <div className="plane-body">
                <div className="plane-window-band" aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <span key={idx} className="plane-window-dot" />
                  ))}
                </div>
                <div className="aisle-hint">Ön</div>
                <div className="seats-grid">
                  {seatRows &&
                    seatRows.map(({ row, left, right }) => {
                      const rowClass = row <= 10 ? 'seat-premium' : 'seat-economy'
                      const renderSeatButton = (seat: (typeof selectedFlightSeats.seats)[number], side: 'left' | 'right') => {
                        const isSelected = selectedSeatIds.includes(seat.id)
                        const baseClass = seat.isReserved
                          ? 'seat-item seat-item-reserved'
                          : 'seat-item seat-item-free'
                        const sideClass = side === 'left' ? 'seat-left' : 'seat-right'
                        const className = `${baseClass} ${sideClass} ${rowClass}${isSelected ? ' seat-item-selected' : ''}`
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
                        <div
                          className={`seat-row ${row === 11 ? 'seat-row-economy-start' : ''}`}
                          key={row}
                        >
                          <div className="seat-row-label">{row}</div>
                          <div className="seat-row-inner">
                            <div className="seat-row-cluster">
                              {['A', 'B', 'C'].map((letter) => {
                                const seat = left.find((s) => s.seatNumber.endsWith(letter))
                                return seat
                                  ? renderSeatButton(seat, 'left')
                                  : <div key={`L-${row}-${letter}`} className="seat-spacer" />
                              })}
                            </div>
                            <div className="aisle-spacer" />
                            <div className="seat-row-cluster">
                              {['D', 'E', 'F'].map((letter) => {
                                const seat = right.find((s) => s.seatNumber.endsWith(letter))
                                return seat
                                  ? renderSeatButton(seat, 'right')
                                  : <div key={`R-${row}-${letter}`} className="seat-spacer" />
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

            {selectedSeatIds.length > 0 && (
              <div className="selected-seats-info">
                <div>
                  Seçili koltuk{selectedSeatIds.length > 1 ? 'lar' : ''}:{' '}
                  <span className="mono">
                    {selectedFlightSeats.seats
                      .filter((s) => selectedSeatIds.includes(s.id))
                      .map((s) => s.seatNumber)
                      .join(', ')}
                  </span>
                  {selectedSeatIds.length < MAX_SELECTABLE_SEATS && (
                    <span className="muted-text" style={{ marginLeft: '0.5rem' }}>
                      (en fazla {MAX_SELECTABLE_SEATS} koltuk seçebilirsiniz)
                    </span>
                  )}
                </div>
              </div>
            )}

            {selectedSeatIds.length > 0 && (
              <div className="reservation-card">
                <h3 className="section-title">Yolcu Bilgileri</h3>

                {!reservationSuccess && (
                  <form className="form-grid" onSubmit={handleReservationSubmit}>
                    <div className="form-row">
                      <div className="form-field">
                        <label>Uçuş</label>
                        <input type="text" value={selectedFlightSeats.flightNumber} disabled />
                      </div>
                      <div className="form-field">
                        <label>Koltuk{selectedSeatIds.length > 1 ? 'lar' : ''}</label>
                        <input
                          type="text"
                          value={
                            selectedFlightSeats.seats
                              .filter((s) => selectedSeatIds.includes(s.id))
                              .map((s) => s.seatNumber)
                              .join(', ') ?? ''
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
                        <label>Toplam Ücret</label>
                        <input
                          type="text"
                          disabled
                          value={
                            '₺' +
                            selectedFlightSeats.seats
                              .filter((s) => selectedSeatIds.includes(s.id))
                              .reduce((sum, s) => sum + s.price, 0)
                              .toLocaleString('tr-TR', { maximumFractionDigits: 0 })
                          }
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="submit" disabled={reservationLoading}>
                        {reservationLoading ? 'Rezervasyon Oluşturuluyor...' : 'Rezervasyonu Oluştur'}
                      </button>
                    </div>
                  </form>
                )}

                {reservationSuccess && !paymentComplete && (
                  <>
                    <div className="reservation-created-banner">
                      <span className="reservation-created-text">
                        {reservationSuccess.length} rezervasyon oluşturuldu.
                        {reservationSuccess.some((r) => r.reservationId) && (
                          <> Rezervasyon no: <span className="mono">{reservationSuccess.map((r) => r.reservationId).filter(Boolean).join(', ')}</span></>
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
                      {paymentResult?.message ?? `${reservationSuccess.length} rezervasyon için ödeme tamamlandı.`}
                    </div>
                    {reservationSuccess.some((r) => r.reservationId) && (
                      <div className="payment-text">
                        Rezervasyon no: <span className="mono">{reservationSuccess.map((r) => r.reservationId).filter(Boolean).join(', ')}</span>
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
    </main>
  )
}
