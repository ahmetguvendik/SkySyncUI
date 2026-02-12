import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchWithAuth } from '../api/client'
import '../App.css'

const MAX_LAST_SEARCHES = 3
const LAST_FLIGHT_SEARCHES_KEY = 'skysync_last_flight_searches'
const AIRPORT_SUGGESTIONS_PAGE_SIZE = 8
const AIRPORT_SUGGESTION_DEBOUNCE_MS = 250

type TripType = 'oneWay' | 'roundTrip'
type LastSearch = { departure: string; destination: string; departureDate: string; returnDate?: string; tripType?: TripType }
type AirportOption = { id: string; code: string; name: string; city: string; country: string }

function getLastFlightSearches(): LastSearch[] {
  try {
    const raw = localStorage.getItem(LAST_FLIGHT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_LAST_SEARCHES) : []
  } catch {
    return []
  }
}

function saveLastFlightSearches(list: LastSearch[]) {
  try {
    localStorage.setItem(LAST_FLIGHT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_LAST_SEARCHES)))
  } catch {}
}

function normalizeAirportOption(item: Record<string, unknown>): AirportOption {
  return {
    id: String(item.id ?? item.Id ?? item.airportId ?? item.AirportId ?? ''),
    code: String(item.code ?? item.Code ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    city: String(item.city ?? item.City ?? ''),
    country: String(item.country ?? item.Country ?? ''),
  }
}

function extractAirportList(data: unknown): AirportOption[] {
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
    .map((item) => normalizeAirportOption(item))
    .filter((a) => a.code)

  return Array.from(new Map(list.map((a) => [a.code, a])).values())
}

function resolveAirportCode(inputValue: string, options: AirportOption[]): string {
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

const QUICK_BOXES = [
  { icon: '📋', title: 'Online İptal', desc: 'Rezervasyonunuzu dakikalar içinde iptal edin.', to: '/rezervasyonlar' },
  { icon: '✈', title: '3 Uçuş', desc: 'Tek seferde en fazla 3 koltuk rezervasyonu.', to: '/ucus-ara' },
  { icon: '🧳', title: 'Ek Bagaj', desc: '%50\'ye varan indirimle ek bagajdan yararlanın.', to: '#' },
  { icon: '📄', title: 'Fatura Görüntüleme', desc: 'Rezervasyonlarınıza ait faturalara kolayca ulaşın.', to: '/rezervasyonlar' },
]

const FEATURE_CARDS = [
  { title: 'Fırsat Bolluğu', desc: 'Her gün yeni fırsatlar ile en ucuz uçak biletini bulun.', icon: '🎯' },
  { title: 'Ucuz Uçak Bileti Bulun', desc: 'Ayın en ucuz uçak biletini aylık grafikle bulun.', icon: '📊' },
  { title: 'Hızlı ve Kolay', desc: '500\'den fazla havayolunun uçuşlarını karşılaştırın, en ucuz uçak biletini hemen satın alın.', icon: '⚡' },
  { title: 'Müşteri Hizmetleri', desc: 'Tüm sorularınız, uçak bileti değişikliği, iptal ve uçuş durumunuzu takip için daima yanınızdayız.', icon: '🎧' },
  { title: 'Ne Görürseniz O', desc: 'Uçak biletinizi ilk gördüğünüz fiyata alırsınız, sonrasında extra bir ücret eklenmez.', icon: '✅' },
  { title: 'Fiyat Alarmı', desc: 'Dilediğiniz destinasyonda alarmınızı kurun, uçak bileti fiyatı düştüğünde size haber verelim.', icon: '🔔' },
  { title: '9 Taksit ile Ödeme', desc: 'Uçak biletinizi kredi kartlarına 9 taksit ile alın.', icon: '💳' },
  { title: 'Güvenli Alışveriş', desc: 'Etstur güvencesiyle, uçak biletinizi güvenle alın!', icon: '🛡️' },
]

export default function FlightSearchForm() {
  const navigate = useNavigate()
  const [tripType, setTripType] = useState<TripType>('oneWay')
  const [flightSearchDeparture, setFlightSearchDeparture] = useState('')
  const [flightSearchDestination, setFlightSearchDestination] = useState('')
  const [flightSearchDate, setFlightSearchDate] = useState('')
  const [flightSearchReturnDate, setFlightSearchReturnDate] = useState('')
  const [lastFlightSearches, setLastFlightSearches] = useState<LastSearch[]>(() => getLastFlightSearches())
  const [departureAirportOptions, setDepartureAirportOptions] = useState<AirportOption[]>([])
  const [destinationAirportOptions, setDestinationAirportOptions] = useState<AirportOption[]>([])
  const [departureSuggestionsLoading, setDepartureSuggestionsLoading] = useState(false)
  const [destinationSuggestionsLoading, setDestinationSuggestionsLoading] = useState(false)
  const [departureSuggestionsOpen, setDepartureSuggestionsOpen] = useState(false)
  const [destinationSuggestionsOpen, setDestinationSuggestionsOpen] = useState(false)

  const searchAirports = useCallback(async (query: string, signal?: AbortSignal): Promise<AirportOption[]> => {
    const trimmed = query.trim()
    if (!trimmed) return []

    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', String(AIRPORT_SUGGESTIONS_PAGE_SIZE))
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

    const all = extractAirportList(data)
    const upper = trimmed.toUpperCase()
    return all
      .filter((a) => {
        const code = a.code.toUpperCase()
        const name = a.name.toUpperCase()
        const city = a.city.toUpperCase()
        const country = a.country.toUpperCase()
        return code.includes(upper) || name.includes(upper) || city.includes(upper) || country.includes(upper)
      })
      .slice(0, AIRPORT_SUGGESTIONS_PAGE_SIZE)
  }, [])

  useEffect(() => {
    const query = flightSearchDeparture.trim()
    if (!query) {
      setDepartureAirportOptions([])
      setDepartureSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setDepartureSuggestionsLoading(true)
      try {
        const list = await searchAirports(query, controller.signal)
        setDepartureAirportOptions(list)
      } catch (err) {
        const abortErr = err as { name?: string }
        if (abortErr?.name !== 'AbortError') setDepartureAirportOptions([])
      } finally {
        setDepartureSuggestionsLoading(false)
      }
    }, AIRPORT_SUGGESTION_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [flightSearchDeparture, searchAirports])

  useEffect(() => {
    const query = flightSearchDestination.trim()
    if (!query) {
      setDestinationAirportOptions([])
      setDestinationSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setDestinationSuggestionsLoading(true)
      try {
        const list = await searchAirports(query, controller.signal)
        setDestinationAirportOptions(list)
      } catch (err) {
        const abortErr = err as { name?: string }
        if (abortErr?.name !== 'AbortError') setDestinationAirportOptions([])
      } finally {
        setDestinationSuggestionsLoading(false)
      }
    }, AIRPORT_SUGGESTION_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [flightSearchDestination, searchAirports])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dep = resolveAirportCode(flightSearchDeparture, departureAirportOptions)
    const dest = resolveAirportCode(flightSearchDestination, destinationAirportOptions)
    const date = flightSearchDate.trim()
    const returnDate = flightSearchReturnDate.trim()

    if (!dep || !dest || !date) return
    if (tripType === 'roundTrip' && !returnDate) return

    const params = new URLSearchParams()
    params.set('departure', dep)
    params.set('destination', dest)
    params.set('date', date)
    params.set('tripType', tripType)
    if (tripType === 'roundTrip' && returnDate) {
      params.set('returnDate', returnDate)
    }

    const entry: LastSearch = {
      departure: dep,
      destination: dest,
      departureDate: date,
      ...(tripType === 'roundTrip' && returnDate ? { returnDate, tripType: 'roundTrip' as const } : {}),
    }
    const key = tripType === 'roundTrip' ? `${dep}-${dest}-${date}-${returnDate}` : `${dep}-${dest}-${date}`
    setLastFlightSearches((prev) => {
      const next = [
        entry,
        ...prev.filter((s) => {
          const sk = s.tripType === 'roundTrip' && s.returnDate
            ? `${s.departure}-${s.destination}-${s.departureDate}-${s.returnDate}`
            : `${s.departure}-${s.destination}-${s.departureDate}`
          return sk !== key
        }),
      ].slice(0, MAX_LAST_SEARCHES)
      saveLastFlightSearches(next)
      return next
    })

    navigate(`/ucus-sonuclari?${params.toString()}`)
  }

  const loadFromLastSearch = (s: LastSearch) => {
    setFlightSearchDeparture(s.departure)
    setFlightSearchDestination(s.destination)
    setFlightSearchDate(s.departureDate)
    setFlightSearchReturnDate(s.returnDate ?? '')
    setTripType(s.tripType ?? 'oneWay')

    const params = new URLSearchParams()
    params.set('departure', s.departure)
    params.set('destination', s.destination)
    params.set('date', s.departureDate)
    params.set('tripType', s.tripType ?? 'oneWay')
    if (s.tripType === 'roundTrip' && s.returnDate) {
      params.set('returnDate', s.returnDate)
    }
    navigate(`/ucus-sonuclari?${params.toString()}`)
  }

  return (
    <main className="app-container flight-search-page flight-search-form-page">
      {/* 1. En üstte: Uçuş arama formu */}
      <section className="card hero-search-section hero-search-box">
        <div className="hero-search-header">
          <h2 className="hero-search-title">Uçak Bileti Ara, Ucuz Uçuşları Keşfet</h2>
          <p className="hero-search-subtitle">Gidiş-dönüş veya tek yön biletinizi kolayca bulun</p>
        </div>

        <form className="form-grid flight-search-form" onSubmit={handleSubmit}>
          <div className="form-field trip-type-field">
            <label>Yolculuk tipi</label>
            <div className="trip-type-toggle">
              <button
                type="button"
                className={tripType === 'oneWay' ? 'trip-type-btn active' : 'trip-type-btn'}
                onClick={() => {
                  setTripType('oneWay')
                  setFlightSearchReturnDate('')
                }}
              >
                Tek yön
              </button>
              <button
                type="button"
                className={tripType === 'roundTrip' ? 'trip-type-btn active' : 'trip-type-btn'}
                onClick={() => setTripType('roundTrip')}
              >
                Gidiş-dönüş
              </button>
            </div>
          </div>
          <div className="form-field airport-autocomplete">
            <label htmlFor="search-departure">Kalkış (şehir veya IATA)</label>
            <input
              id="search-departure"
              type="text"
              autoComplete="off"
              placeholder="İstanbul / IST"
              value={flightSearchDeparture}
              onFocus={() => setDepartureSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setDepartureSuggestionsOpen(false), 120)}
              onChange={(e) => setFlightSearchDeparture(e.target.value)}
            />
            {departureSuggestionsOpen && flightSearchDeparture.trim().length > 0 && (
              <div className="airport-suggestions">
                {departureSuggestionsLoading && <div className="airport-suggestion-state">Havalimanları aranıyor...</div>}
                {!departureSuggestionsLoading && departureAirportOptions.length === 0 && (
                  <div className="airport-suggestion-state">Sonuç bulunamadı</div>
                )}
                {!departureSuggestionsLoading &&
                  departureAirportOptions.map((airport) => (
                    <button
                      key={`dep-${airport.id || airport.code}`}
                      type="button"
                      className="airport-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setFlightSearchDeparture(airport.code.toUpperCase())
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
            <label htmlFor="search-destination">Varış (şehir veya IATA)</label>
            <input
              id="search-destination"
              type="text"
              autoComplete="off"
              placeholder="Amsterdam / AMS"
              value={flightSearchDestination}
              onFocus={() => setDestinationSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setDestinationSuggestionsOpen(false), 120)}
              onChange={(e) => setFlightSearchDestination(e.target.value)}
            />
            {destinationSuggestionsOpen && flightSearchDestination.trim().length > 0 && (
              <div className="airport-suggestions">
                {destinationSuggestionsLoading && <div className="airport-suggestion-state">Havalimanları aranıyor...</div>}
                {!destinationSuggestionsLoading && destinationAirportOptions.length === 0 && (
                  <div className="airport-suggestion-state">Sonuç bulunamadı</div>
                )}
                {!destinationSuggestionsLoading &&
                  destinationAirportOptions.map((airport) => (
                    <button
                      key={`dest-${airport.id || airport.code}`}
                      type="button"
                      className="airport-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setFlightSearchDestination(airport.code.toUpperCase())
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
          <div className="form-field">
            <label htmlFor="search-date">Gidiş Tarihi</label>
            <input
              id="search-date"
              type="date"
              value={flightSearchDate}
              onChange={(e) => setFlightSearchDate(e.target.value)}
            />
          </div>
          {tripType === 'roundTrip' && (
            <div className="form-field">
              <label htmlFor="search-return-date">Dönüş Tarihi</label>
              <input
                id="search-return-date"
                type="date"
                value={flightSearchReturnDate}
                onChange={(e) => setFlightSearchReturnDate(e.target.value)}
              />
            </div>
          )}
          <div className="form-field" style={{ alignSelf: 'end' }}>
            <button type="submit" className="flight-search-btn">
              <span className="flight-search-btn-icon">✈</span>
              Uçuş Ara
            </button>
          </div>
        </form>

        {lastFlightSearches.length > 0 && (
          <div className="last-searches" style={{ marginTop: '1rem' }}>
            <span className="muted-text" style={{ marginRight: '0.5rem' }}>Son aramalar:</span>
            {lastFlightSearches.map((s, i) => (
              <button
                key={`${s.departure}-${s.destination}-${s.departureDate}-${s.returnDate ?? ''}-${i}`}
                type="button"
                className="ghost-button last-search-btn"
                onClick={() => loadFromLastSearch(s)}
              >
                {s.departure} → {s.destination} ({s.departureDate}
                {s.tripType === 'roundTrip' && s.returnDate ? ` / ${s.returnDate}` : ''})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Altında: 4 quick link kutusu */}
      <div className="flight-search-quick-boxes">
        {QUICK_BOXES.map((box) => (
          <Link
            key={box.title}
            to={box.to}
            className="flight-quick-box"
          >
            <span className="flight-quick-box-icon">{box.icon}</span>
            <span className="flight-quick-box-title">{box.title}</span>
            <span className="flight-quick-box-desc">{box.desc}</span>
          </Link>
        ))}
      </div>

      {/* 3. Altında: 8 özellik kartı */}
      <div className="flight-feature-cards">
        {FEATURE_CARDS.map((card) => (
          <div key={card.title} className="flight-feature-card">
            <span className="flight-feature-icon">{card.icon}</span>
            <h3 className="flight-feature-title">{card.title}</h3>
            <p className="flight-feature-desc">{card.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
