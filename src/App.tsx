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

const AIRPORTS_PAGE_SIZE = 20
const RESERVATIONS_PAGE_SIZE = 20
const AIRPORT_AUTOCOMPLETE_PAGE_SIZE = 8
const AIRPORT_AUTOCOMPLETE_DEBOUNCE_MS = 250

type AirportSuggestionOption = {
  id: string
  code: string
  name: string
  city: string
  country: string
}

function normalizeAirportSuggestion(item: Record<string, unknown>): AirportSuggestionOption {
  return {
    id: String(item.id ?? item.Id ?? item.airportId ?? item.AirportId ?? ''),
    code: String(item.code ?? item.Code ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    city: String(item.city ?? item.City ?? ''),
    country: String(item.country ?? item.Country ?? ''),
  }
}

function extractAirportSuggestions(data: unknown): AirportSuggestionOption[] {
  if (!data || typeof data !== 'object') return []

  const payload = data as Record<string, unknown>
  const payloadData = payload.data
  const nested =
    payloadData && typeof payloadData === 'object' && !Array.isArray(payloadData)
      ? (payloadData as Record<string, unknown>)
      : null

  const candidate =
    payload.airports ??
    payload.Airports ??
    payload.items ??
    payload.Items ??
    nested?.airports ??
    nested?.Airports ??
    nested?.items ??
    nested?.Items ??
    payload.data ??
    payload.Data ??
    []

  if (!Array.isArray(candidate)) return []

  const list = candidate
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => normalizeAirportSuggestion(item))
    .filter((a) => a.code)

  return Array.from(new Map(list.map((a) => [a.code, a])).values())
}

function resolveAirportCodeFromInput(inputValue: string, options: AirportSuggestionOption[]): string {
  const value = inputValue.trim()
  if (!value) return ''

  const upper = value.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper)) return upper

  const exact = options.find((a) => {
    const code = a.code.toUpperCase()
    const name = a.name.toUpperCase()
    const city = a.city.toUpperCase()
    return code === upper || name === upper || city === upper
  })
  if (exact) return exact.code.toUpperCase()

  const matched = options.filter((a) => {
    const code = a.code.toUpperCase()
    const name = a.name.toUpperCase()
    const city = a.city.toUpperCase()
    const country = a.country.toUpperCase()
    return code.includes(upper) || name.includes(upper) || city.includes(upper) || country.includes(upper)
  })
  if (matched.length === 1) return matched[0].code.toUpperCase()

  return upper
}

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
  const [airportsPage, setAirportsPage] = useState(1)
  const [airportsTotalPages, setAirportsTotalPages] = useState<number | null>(null)
  const [airportsHasNextPage, setAirportsHasNextPage] = useState<boolean | null>(null)
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
  const [departureAirportOptions, setDepartureAirportOptions] = useState<AirportSuggestionOption[]>([])
  const [destinationAirportOptions, setDestinationAirportOptions] = useState<AirportSuggestionOption[]>([])
  const [departureSuggestionsLoading, setDepartureSuggestionsLoading] = useState(false)
  const [destinationSuggestionsLoading, setDestinationSuggestionsLoading] = useState(false)
  const [departureSuggestionsOpen, setDepartureSuggestionsOpen] = useState(false)
  const [destinationSuggestionsOpen, setDestinationSuggestionsOpen] = useState(false)

  const getReservationStatusClass = (status: unknown) => {
    const value = String(status ?? '').toLowerCase()
    if (!value) return 'reservation-status-neutral'

    if (['approved', 'confirmed', 'success', 'paid', 'completed', 'active', 'booked', 'rezerve', 'onay'].some((k) => value.includes(k))) {
      return 'reservation-status-positive'
    }
    if (['pending', 'bekle', 'processing', 'hold', 'review'].some((k) => value.includes(k))) {
      return 'reservation-status-pending'
    }
    if (['cancel', 'iptal', 'failed', 'error', 'expired', 'reject', 'declined'].some((k) => value.includes(k))) {
      return 'reservation-status-negative'
    }
    return 'reservation-status-neutral'
  }

  const searchAirportOptions = React.useCallback(async (query: string, signal?: AbortSignal): Promise<AirportSuggestionOption[]> => {
    const trimmed = query.trim()
    if (!trimmed) return []

    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', String(AIRPORT_AUTOCOMPLETE_PAGE_SIZE))
    params.set('search', trimmed)
    params.set('query', trimmed)

    const res = await fetchWithAuth(`airport?${params.toString()}`, { signal })
    const text = await res.text()
    if (!res.ok) return []

    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        return []
      }
    }

    const all = extractAirportSuggestions(data)
    const upper = trimmed.toUpperCase()
    return all
      .filter((a) => {
        const code = a.code.toUpperCase()
        const name = a.name.toUpperCase()
        const city = a.city.toUpperCase()
        const country = a.country.toUpperCase()
        return code.includes(upper) || name.includes(upper) || city.includes(upper) || country.includes(upper)
      })
      .slice(0, AIRPORT_AUTOCOMPLETE_PAGE_SIZE)
  }, [])

  useEffect(() => {
    if (activeView !== 'create') return
    const query = departure.trim()
    if (!query) {
      setDepartureAirportOptions([])
      setDepartureSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setDepartureSuggestionsLoading(true)
      try {
        const list = await searchAirportOptions(query, controller.signal)
        setDepartureAirportOptions(list)
      } catch (err) {
        const abortErr = err as { name?: string }
        if (abortErr?.name !== 'AbortError') setDepartureAirportOptions([])
      } finally {
        setDepartureSuggestionsLoading(false)
      }
    }, AIRPORT_AUTOCOMPLETE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activeView, departure, searchAirportOptions])

  useEffect(() => {
    if (activeView !== 'create') return
    const query = destination.trim()
    if (!query) {
      setDestinationAirportOptions([])
      setDestinationSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setDestinationSuggestionsLoading(true)
      try {
        const list = await searchAirportOptions(query, controller.signal)
        setDestinationAirportOptions(list)
      } catch (err) {
        const abortErr = err as { name?: string }
        if (abortErr?.name !== 'AbortError') setDestinationAirportOptions([])
      } finally {
        setDestinationSuggestionsLoading(false)
      }
    }, AIRPORT_AUTOCOMPLETE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activeView, destination, searchAirportOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)
    const departureCode = resolveAirportCodeFromInput(departure, departureAirportOptions)
    const destinationCode = resolveAirportCodeFromInput(destination, destinationAirportOptions)

    if (!aircraftId || !flightNumber || !departureCode || !destinationCode || !departureTime || !arrivalTime || basePrice === '') {
      setErrorMessage('Lütfen tüm alanları (uçak dahil) doldurun.')
      return
    }

    try {
      setLoading(true)

      const payload = {
        aircraftId,
        flightNumber,
        departure: departureCode,
        destination: destinationCode,
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
      setDepartureAirportOptions([])
      setDestinationAirportOptions([])
      setDepartureSuggestionsOpen(false)
      setDestinationSuggestionsOpen(false)
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
      const res = await fetchWithAuth(
        `reservation/passenger/${emailEncoded}?page=${reservationsPage}&pageSize=${RESERVATIONS_PAGE_SIZE}`,
      )
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
      const normalizedList = Array.isArray(list) ? list : []
      if (reservationsPage > 1 && normalizedList.length === 0) {
        setReservationsPage((prev) => Math.max(1, prev - 1))
        return
      }
      setReservations(normalizedList)
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

  const fetchAirports = React.useCallback(async (page: number) => {
    try {
      setAirportsLoading(true)
      setAirportsError(null)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(AIRPORTS_PAGE_SIZE))
      const res = await fetchWithAuth(`airport?${params.toString()}`)
      const text = await res.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          if (!res.ok) throw new Error(text)
        }
      }
      if (!res.ok) throw new Error(getErrorMessageFromResponse(data as import('./api/client').ApiErrorBody | null, 'Havalimanları alınamadı.'))

      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
      const payloadData = payload?.data
      const nested = payloadData && typeof payloadData === 'object' && !Array.isArray(payloadData)
        ? (payloadData as Record<string, unknown>)
        : null

      const candidate =
        payload?.airports ??
        payload?.Airports ??
        payload?.items ??
        payload?.Items ??
        nested?.airports ??
        nested?.Airports ??
        nested?.items ??
        nested?.Items ??
        payload?.data ??
        payload?.Data ??
        []

      const raw = Array.isArray(candidate) ? candidate : []
      const list = raw.map((item) => {
        const a = item as Record<string, unknown>
        return {
          id: String(a.id ?? a.Id ?? ''),
          code: String(a.code ?? a.Code ?? ''),
          name: String(a.name ?? a.Name ?? ''),
          city: String(a.city ?? a.City ?? ''),
          country: String(a.country ?? a.Country ?? ''),
        }
      })
      setAirports(list)

      const metaSource = nested ?? payload
      const totalPagesCandidate = Number(
        metaSource?.totalPages ??
        metaSource?.TotalPages ??
        metaSource?.pageCount ??
        metaSource?.PageCount,
      )
      const hasNextCandidate = metaSource?.hasNextPage ?? metaSource?.HasNextPage ?? metaSource?.hasNext ?? metaSource?.HasNext
      setAirportsTotalPages(Number.isFinite(totalPagesCandidate) && totalPagesCandidate > 0 ? totalPagesCandidate : null)
      setAirportsHasNextPage(typeof hasNextCandidate === 'boolean' ? hasNextCandidate : null)
      if (page > 1 && list.length === 0) {
        setAirportsPage((prev) => Math.max(1, prev - 1))
        return
      }
    } catch (err) {
      setAirportsError(err instanceof Error ? err.message : 'Havalimanları yüklenemedi.')
      setAirports([])
      setAirportsTotalPages(null)
      setAirportsHasNextPage(null)
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
      if (airportsPage === 1) {
        fetchAirports(1)
      } else {
        setAirportsPage(1)
      }
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
    if (activeView === 'airports') fetchAirports(airportsPage)
  }, [activeView, airportsPage, fetchAirports])

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
                <div className="form-field airport-autocomplete">
                  <label htmlFor="departure">Kalkış (şehir veya IATA)</label>
                  <input
                    id="departure"
                    type="text"
                    autoComplete="off"
                    placeholder="İstanbul / IST"
                    value={departure}
                    onFocus={() => setDepartureSuggestionsOpen(true)}
                    onBlur={() => window.setTimeout(() => setDepartureSuggestionsOpen(false), 120)}
                    onChange={(e) => setDeparture(e.target.value)}
                  />
                  {departureSuggestionsOpen && departure.trim().length > 0 && (
                    <div className="airport-suggestions">
                      {departureSuggestionsLoading && <div className="airport-suggestion-state">Havalimanları aranıyor...</div>}
                      {!departureSuggestionsLoading && departureAirportOptions.length === 0 && (
                        <div className="airport-suggestion-state">Sonuç bulunamadı</div>
                      )}
                      {!departureSuggestionsLoading &&
                        departureAirportOptions.map((airport) => (
                          <button
                            key={`create-dep-${airport.id || airport.code}`}
                            type="button"
                            className="airport-suggestion-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setDeparture(airport.code.toUpperCase())
                              setDepartureAirportOptions([])
                              setDepartureSuggestionsOpen(false)
                            }}
                          >
                            <span className="airport-suggestion-code">{airport.code}</span>
                            <span className="airport-suggestion-name">{airport.name || airport.city}</span>
                            <span className="airport-suggestion-meta">
                              {[airport.city, airport.country].filter(Boolean).join(', ')}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="form-field airport-autocomplete">
                  <label htmlFor="destination">Varış (şehir veya IATA)</label>
                  <input
                    id="destination"
                    type="text"
                    autoComplete="off"
                    placeholder="Antalya / AYT"
                    value={destination}
                    onFocus={() => setDestinationSuggestionsOpen(true)}
                    onBlur={() => window.setTimeout(() => setDestinationSuggestionsOpen(false), 120)}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                  {destinationSuggestionsOpen && destination.trim().length > 0 && (
                    <div className="airport-suggestions">
                      {destinationSuggestionsLoading && <div className="airport-suggestion-state">Havalimanları aranıyor...</div>}
                      {!destinationSuggestionsLoading && destinationAirportOptions.length === 0 && (
                        <div className="airport-suggestion-state">Sonuç bulunamadı</div>
                      )}
                      {!destinationSuggestionsLoading &&
                        destinationAirportOptions.map((airport) => (
                          <button
                            key={`create-dest-${airport.id || airport.code}`}
                            type="button"
                            className="airport-suggestion-item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setDestination(airport.code.toUpperCase())
                              setDestinationAirportOptions([])
                              setDestinationSuggestionsOpen(false)
                            }}
                          >
                            <span className="airport-suggestion-code">{airport.code}</span>
                            <span className="airport-suggestion-name">{airport.name || airport.city}</span>
                            <span className="airport-suggestion-meta">
                              {[airport.city, airport.country].filter(Boolean).join(', ')}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
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
                    setReservationsPage((prev) => prev - 1)
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
                    if (reservations.length < RESERVATIONS_PAGE_SIZE) return
                    setReservationsPage((prev) => prev + 1)
                  }}
                  disabled={reservationsLoading || reservations.length < RESERVATIONS_PAGE_SIZE}
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
              <div className="reservations-table-wrapper reservations-table-modern">
                <table className="flights-table reservations-table reservations-table-modern-table">
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
                    {reservations.map((r, idx) => {
                      const statusText = String(r.status ?? '—')
                      const passengerName = [r.passengerName, r.passengerSurname].filter(Boolean).join(' ')
                      return (
                      <tr key={r.id ?? r.flightId ?? idx} className="flight-row reservation-row">
                        <td>
                          <span className="mono reservation-flight-number">{r.flightNumber ?? '—'}</span>
                        </td>
                        <td>
                          <div className="route reservation-route">
                            <span>{r.departure ?? '—'}</span>
                            <span className="route-arrow">→</span>
                            <span>{r.arrival ?? '—'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="mono reservation-seat-pill">{r.seatNumber ?? '—'}</span>
                        </td>
                        <td>
                          <div className="reservation-passenger">
                            <span className="reservation-passenger-name">{passengerName || r.passengerEmail || '—'}</span>
                            {passengerName && r.passengerEmail && (
                              <span className="reservation-passenger-email">{r.passengerEmail}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`reservation-status ${getReservationStatusClass(r.status)}`}>{statusText}</span>
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
                            <span className="mono reservation-price">
                              ₺{r.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )})}
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => fetchAirports(airportsPage)}
                  disabled={airportsLoading}
                >
                  {airportsLoading ? 'Yenileniyor...' : 'Yenile'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (airportsPage <= 1 || airportsLoading) return
                    setAirportsPage((prev) => prev - 1)
                  }}
                  disabled={airportsPage <= 1 || airportsLoading}
                >
                  Önceki
                </button>
                <span className="muted-text">
                  Sayfa {airportsPage}
                  {airportsTotalPages != null ? ` / ${airportsTotalPages}` : ''}
                </span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (airportsLoading) return
                    if (airportsTotalPages != null && airportsPage >= airportsTotalPages) return
                    if (airportsHasNextPage === false) return
                    if (airportsTotalPages == null && airportsHasNextPage == null && airports.length < AIRPORTS_PAGE_SIZE) return
                    setAirportsPage((prev) => prev + 1)
                  }}
                  disabled={
                    airportsLoading ||
                    (airportsTotalPages != null && airportsPage >= airportsTotalPages) ||
                    airportsHasNextPage === false ||
                    (airportsTotalPages == null && airportsHasNextPage == null && airports.length < AIRPORTS_PAGE_SIZE)
                  }
                >
                  Sonraki
                </button>
              </div>
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
