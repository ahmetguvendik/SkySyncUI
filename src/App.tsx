import React, { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchWithAuth, getErrorMessageFromResponse } from './api/client'
import { getCurrentTraceparent, runWithTraceContext } from './tracing'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import './App.css'

const FLIGHT_LIST_PAGE_SIZE = 20
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
  const [flightsPage, setFlightsPage] = useState(1)
  const [flightSearchDeparture, setFlightSearchDeparture] = useState('')
  const [flightSearchDestination, setFlightSearchDestination] = useState('')
  const [flightSearchDate, setFlightSearchDate] = useState('')
  const [flightSearchReturnDate, setFlightSearchReturnDate] = useState('')
  const [tripType, setTripType] = useState<TripType>('oneWay')
  const [returnFlights, setReturnFlights] = useState<
    { id: string; flightNumber: string; departure: string; destination: string; departureTime: string; arrivalTime: string; basePrice: number; status: string; availableSeats: number; totalSeats: number }[]
  >([])
  const [lastFlightSearches, setLastFlightSearches] = useState<LastSearch[]>(() => getLastFlightSearches())

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
  const [activeView, setActiveView] = useState<'list' | 'create' | 'reservations' | 'airports'>('list')

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

  const MAX_SELECTABLE_SEATS = 3

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

  const fetchFlights = async (page: number) => {
    try {
      const dep = flightSearchDeparture.trim().toUpperCase()
      const dest = flightSearchDestination.trim().toUpperCase()
      const date = flightSearchDate.trim()
      const returnDate = flightSearchReturnDate.trim()

      if (!dep || !dest || !date) {
        setFlightsError('Lütfen kalkış, varış ve kalkış tarihini girin.')
        setFlights([])
        return
      }

      if (tripType === 'roundTrip' && !returnDate) {
        setFlightsError('Gidiş-dönüş için dönüş tarihini girin.')
        setFlights([])
        return
      }

      setFlightsLoading(true)
      setFlightsError(null)
      setReturnFlights([])
      const outboundList = await doFetchFlights(dep, dest, date, page)
      setFlights(outboundList)

      if (tripType === 'roundTrip' && returnDate) {
        const returnList = await doFetchFlights(dest, dep, returnDate, 1)
        setReturnFlights(returnList)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.'
      setFlightsError(message)
      setFlights([])
    } finally {
      setFlightsLoading(false)
    }
  }

  const loadFromLastSearch = (s: LastSearch) => {
    setFlightSearchDeparture(s.departure)
    setFlightSearchDestination(s.destination)
    setFlightSearchDate(s.departureDate)
    setFlightSearchReturnDate(s.returnDate ?? '')
    setTripType(s.tripType ?? 'oneWay')
    setFlightsPage(1)
    setFlightsError(null)
    setFlightsLoading(true)
    setReturnFlights([])
    doFetchFlights(s.departure, s.destination, s.departureDate, 1)
      .then((outboundList) => {
        setFlights(outboundList)
        if (s.tripType === 'roundTrip' && s.returnDate) {
          return doFetchFlights(s.destination, s.departure, s.returnDate, 1).then((returnList) => {
            setReturnFlights(returnList)
          })
        }
      })
      .catch((err) => setFlightsError(err instanceof Error ? err.message : 'Hata oluştu.'))
      .finally(() => setFlightsLoading(false))
  }

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
              <button
                type="button"
                className={
                  activeView === 'airports'
                    ? 'view-toggle-button view-toggle-button-active'
                    : 'view-toggle-button'
                }
                onClick={() => setActiveView('airports')}
              >
                Havalimanları
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

        {activeView === 'list' && (
        <section className="card card-secondary">
          <div className="section-header">
            <h2 className="section-title">Uçuş Listesi</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <form
                className="form-grid flight-search-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  setFlightsPage(1)
                  fetchFlights(1)
                }}
              >
                <div className="form-field trip-type-field">
                  <label>Yolculuk tipi</label>
                  <div className="trip-type-toggle">
                    <button
                      type="button"
                      className={tripType === 'oneWay' ? 'trip-type-btn active' : 'trip-type-btn'}
                      onClick={() => {
                        setTripType('oneWay')
                        setFlightSearchReturnDate('')
                        setReturnFlights([])
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
                  <button type="submit" disabled={flightsLoading}>
                    {flightsLoading ? 'Aranıyor...' : 'Uçuş Ara'}
                  </button>
                </div>
              </form>
              {lastFlightSearches.length > 0 && (
                <div className="last-searches">
                  <span className="muted-text" style={{ marginRight: '0.5rem' }}>Son aramalar:</span>
                  {lastFlightSearches.map((s, i) => (
                    <button
                      key={`${s.departure}-${s.destination}-${s.departureDate}-${s.returnDate ?? ''}-${i}`}
                      type="button"
                      className="ghost-button last-search-btn"
                      onClick={() => loadFromLastSearch(s)}
                      disabled={flightsLoading}
                    >
                      {s.departure} → {s.destination} ({s.departureDate}
                      {s.tripType === 'roundTrip' && s.returnDate ? ` / ${s.returnDate}` : ''})
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => fetchFlights(flightsPage)}
                  disabled={flightsLoading}
                >
                  {flightsLoading ? 'Yenileniyor...' : 'Listeyi Yenile'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (flightsPage <= 1 || flightsLoading) return
                    const nextPage = flightsPage - 1
                    setFlightsPage(nextPage)
                    fetchFlights(nextPage)
                  }}
                  disabled={flightsPage <= 1 || flightsLoading}
                >
                  Önceki
                </button>
                <span className="muted-text">Sayfa {flightsPage}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (flightsLoading) return
                    const nextPage = flightsPage + 1
                    setFlightsPage(nextPage)
                    fetchFlights(nextPage)
                  }}
                  disabled={flightsLoading}
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>

          {flightsError && <div className="alert alert-error">{flightsError}</div>}

          {flights.length === 0 && returnFlights.length === 0 && !flightsLoading && !flightsError && (
            <p className="muted-text">Henüz kayıtlı bir uçuş bulunmuyor.</p>
          )}

          {flights.length > 0 && (
            <div className="flights-section">
              {tripType === 'roundTrip' && (
                <h3 className="flights-section-title">Gidiş uçuşları ({flightSearchDeparture} → {flightSearchDestination})</h3>
              )}
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
                          className={
                            selectedFlightId === f.id && selectedFlightSeats
                              ? 'secondary-button secondary-button-active'
                              : 'secondary-button'
                          }
                          onClick={() => fetchSeats(f.id)}
                        >
                          {selectedFlightId === f.id && selectedFlightSeats
                            ? 'Koltukları Kapat'
                            : 'Koltukları Gör'}
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
              <h3 className="flights-section-title">Dönüş uçuşları ({flightSearchDestination} → {flightSearchDeparture})</h3>
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
                <div className="seats-header-right">
                  <div className="seats-legend">
                    <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-free" /> Boş</span>
                    <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-reserved" /> Dolu</span>
                    <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-premium" /> Premium</span>
                    <span className="seats-legend-item"><i className="seats-legend-dot seats-legend-economy" /> Economy</span>
                  </div>
                  <button
                    type="button"
                    className="seats-close-btn"
                    onClick={closeSeats}
                    title="Koltuk planını kapat"
                  >
                    Kapat
                  </button>
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
                          <input
                            type="text"
                            value={selectedFlightSeats.flightNumber}
                            disabled
                          />
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
