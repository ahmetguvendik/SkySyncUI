import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../App.css'

const MAX_LAST_SEARCHES = 3
const LAST_FLIGHT_SEARCHES_KEY = 'skysync_last_flight_searches'

type TripType = 'oneWay' | 'roundTrip'
type LastSearch = { departure: string; destination: string; departureDate: string; returnDate?: string; tripType?: TripType }

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dep = flightSearchDeparture.trim().toUpperCase()
    const dest = flightSearchDestination.trim().toUpperCase()
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
          <div className="form-field">
            <label htmlFor="search-departure">Kalkış (IATA)</label>
            <input
              id="search-departure"
              type="text"
              maxLength={3}
              placeholder="IST"
              value={flightSearchDeparture}
              onChange={(e) => setFlightSearchDeparture(e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-destination">Varış (IATA)</label>
            <input
              id="search-destination"
              type="text"
              maxLength={3}
              placeholder="AMS"
              value={flightSearchDestination}
              onChange={(e) => setFlightSearchDestination(e.target.value.toUpperCase())}
            />
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
