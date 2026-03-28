import { createServiceClient, Booking } from './supabase'
import { fetchHotelPrice } from './serpapi'
import { sendPriceDropAlert } from './telegram'
import { startOfDay } from 'date-fns'

type CheckOptions = {
  /**
   * Mark this check as the baseline snapshot taken on the day the booking was
   * saved. Baseline checks never trigger Telegram alerts — they exist purely to
   * anchor what the market rate looked like at booking time, which is used to
   * validate fuzzy-match comparisons in future checks.
   */
  isBaseline?: boolean
}

async function checkOneBooking(
  db: ReturnType<typeof createServiceClient>,
  booking: Booking,
  options: CheckOptions = {}
): Promise<{ alerted: boolean; priceFound: number | null }> {
  const { isBaseline = false } = options

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
    )
  )
  const pricePaidPerNight = booking.price_paid / nights

  // Run primary search and, when guests > 2, a normalised 2-adult search in parallel.
  // The normalised search gives us a standard market-rate reference even when
  // the hotel doesn't surface pricing for the actual guest count.
  const needsNormalization = booking.guests > 2

  const [result, normalizedResult] = await Promise.all([
    fetchHotelPrice(booking),
    needsNormalization ? fetchHotelPrice(booking, { adultsOverride: 2 }) : Promise.resolve(null),
  ])

  // Best price: prefer primary (actual guest count), fall back to normalised (2-adult)
  const best = result?.cheapestWatched ?? result?.cheapestAny
    ?? normalizedResult?.cheapestWatched ?? normalizedResult?.cheapestAny
    ?? null

  // Only mark as cheaper when we're confident it's the same hotel (exact match).
  // Fuzzy matches can refer to a completely different property, so we store the
  // price but avoid false "cheaper" alerts.
  const exactMatch = result?.exactHotelMatch ?? false
  const isCheaper = exactMatch && best !== null && best.pricePerNight < pricePaidPerNight

  // Pack all context into raw_response._meta so we don't need a schema migration.
  const rawResponse: Record<string, unknown> = {
    ...(result?.rawResponse ?? {}),
    _meta: {
      isBaseline,
      guestsSearched: booking.guests,
      exactHotelMatch: result?.exactHotelMatch ?? null,
      ...(normalizedResult
        ? {
            normalizedGuests: 2,
            normalizedCheapestWatched: normalizedResult.cheapestWatched,
            normalizedCheapestAny: normalizedResult.cheapestAny,
            normalizedAllPrices: normalizedResult.allPrices,
          }
        : {}),
    },
  }

  const { data: priceCheck, error: checkError } = await db
    .from('price_checks')
    .insert({
      booking_id: booking.id,
      price_found: best?.pricePerNight ?? null,
      room_description_found: result
        ? `${result.exactHotelMatch ? 'match' : 'fuzzy'}::${result.hotelName}`
        : null,
      platform_found: best?.source ?? null,
      url: best?.url ?? null,
      is_cheaper: isCheaper,
      raw_response: rawResponse,
    })
    .select()
    .single()

  if (checkError) throw new Error(`Failed to insert price check: ${checkError.message}`)

  // Baseline checks and fuzzy-match checks never trigger alerts.
  if (!isBaseline && isCheaper && best && result) {
    const todayStart = startOfDay(new Date()).toISOString()
    const { data: recentAlerts } = await db
      .from('alerts')
      .select('id')
      .eq('booking_id', booking.id)
      .gte('sent_at', todayStart)
      .limit(1)

    if (!recentAlerts || recentAlerts.length === 0) {
      const message = await sendPriceDropAlert({
        booking,
        pricePaidPerNight,
        priceFound: best.pricePerNight,
        platform: best.source,
        url: best.url,
      })
      await db.from('alerts').insert({
        booking_id: booking.id,
        price_check_id: priceCheck.id,
        telegram_message: message,
      })
      return { alerted: true, priceFound: best.pricePerNight }
    }
  }

  return { alerted: false, priceFound: best?.pricePerNight ?? null }
}

/**
 * Run a price check for a single booking by ID.
 * Pass `isBaseline: true` when called immediately after booking creation —
 * this captures the market rate on day zero for future trend comparison.
 */
export async function runPriceCheckForBooking(
  bookingId: string,
  options: CheckOptions = {}
) {
  const db = createServiceClient()
  const { data: booking, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (error || !booking) throw new Error('Booking not found')
  return checkOneBooking(db, booking as Booking, options)
}

/**
 * Run price checks for all active bookings (called by cron).
 */
export async function runPriceChecks(): Promise<{ checked: number; alerts: number; errors: string[] }> {
  const db = createServiceClient()
  const errors: string[] = []
  let checked = 0
  let alertsSent = 0

  const { data: bookings, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('active', true)

  if (fetchError) throw new Error(`Failed to fetch bookings: ${fetchError.message}`)
  if (!bookings || bookings.length === 0) return { checked: 0, alerts: 0, errors: [] }

  for (const booking of bookings as Booking[]) {
    try {
      const result = await checkOneBooking(db, booking)
      checked++
      if (result.alerted) alertsSent++
    } catch (err: any) {
      errors.push(`Booking ${booking.id} (${booking.hotel_name}): ${err.message}`)
    }
  }

  return { checked, alerts: alertsSent, errors }
}
