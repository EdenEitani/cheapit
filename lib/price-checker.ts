import { createServiceClient, Booking } from './supabase'
import { fetchHotelPrice } from './serpapi'
import { sendPriceDropAlert, sendDeadlineAlert } from './telegram'
import { startOfDay } from 'date-fns'

type CheckOptions = {
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
  const needsNormalization = booking.guests > 2
  const [result, normalizedResult] = await Promise.all([
    fetchHotelPrice(booking),
    needsNormalization ? fetchHotelPrice(booking, { adultsOverride: 2 }) : Promise.resolve(null),
  ])

  // Best price: prefer primary (actual guest count), fall back to normalised (2-adult)
  const best =
    result?.cheapestWatched ?? result?.cheapestAny ??
    normalizedResult?.cheapestWatched ?? normalizedResult?.cheapestAny ??
    null

  // Only mark cheaper when we found the exact same hotel — fuzzy matches are stored
  // for trend analysis but must not trigger false alerts.
  const exactMatch = result?.exactHotelMatch ?? false
  const isCheaper = exactMatch && best !== null && best.pricePerNight < pricePaidPerNight

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

  // Baseline checks never trigger alerts
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
 * Run price checks for all active bookings in parallel.
 * Sequential processing was the original approach but hit Vercel's timeout for
 * larger booking lists; Promise.allSettled lets every booking attempt run
 * concurrently and collects individual failures without aborting others.
 */
export async function runPriceChecks(): Promise<{
  checked: number
  alerts: number
  errors: string[]
}> {
  const db = createServiceClient()

  const { data: bookings, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('active', true)

  if (fetchError) throw new Error(`Failed to fetch bookings: ${fetchError.message}`)
  if (!bookings || bookings.length === 0) return { checked: 0, alerts: 0, errors: [] }

  const results = await Promise.allSettled(
    (bookings as Booking[]).map((b) => checkOneBooking(db, b))
  )

  let checked = 0
  let alerts = 0
  const errors: string[] = []

  results.forEach((r, i) => {
    const b = (bookings as Booking[])[i]
    if (r.status === 'fulfilled') {
      checked++
      if (r.value.alerted) alerts++
    } else {
      errors.push(`${b.hotel_name} (${b.id}): ${r.reason?.message ?? 'unknown error'}`)
    }
  })

  return { checked, alerts, errors }
}

/**
 * Send Telegram reminders for bookings whose cancellation deadline is within
 * 48 hours and haven't been alerted yet. Runs in parallel with price checks.
 *
 * Uses the `deadline_alerted` boolean on the bookings row to ensure we only
 * fire once per booking (reset to false when the booking is edited).
 */
export async function checkCancellationDeadlines(): Promise<{
  alerted: number
  errors: string[]
}> {
  const db = createServiceClient()
  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

  const { data: bookings, error } = await db
    .from('bookings')
    .select('*')
    .eq('active', true)
    .eq('deadline_alerted', false)
    .not('cancellation_deadline', 'is', null)
    .lte('cancellation_deadline', in48h)          // deadline is within 48 h
    .gt('cancellation_deadline', now.toISOString()) // deadline hasn't passed yet

  if (error) throw new Error(`Deadline query failed: ${error.message}`)
  if (!bookings || bookings.length === 0) return { alerted: 0, errors: [] }

  const results = await Promise.allSettled(
    (bookings as Booking[]).map(async (booking) => {
      const nights = Math.max(1, Math.round(
        (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
      ))
      const pricePaidPerNight = booking.price_paid / nights
      const hoursRemaining =
        (new Date(booking.cancellation_deadline!).getTime() - now.getTime()) / 3600000

      // Pull the most recent market price for context in the alert
      const { data: latestChecks } = await db
        .from('price_checks')
        .select('price_found')
        .eq('booking_id', booking.id)
        .not('price_found', 'is', null)
        .order('checked_at', { ascending: false })
        .limit(1)

      const latestPrice: number | null = latestChecks?.[0]?.price_found ?? null

      await sendDeadlineAlert({ booking, hoursRemaining, pricePaidPerNight, latestPrice })

      // Mark alerted so we don't fire again unless the booking is edited
      await db.from('bookings').update({ deadline_alerted: true }).eq('id', booking.id)
    })
  )

  let alerted = 0
  const errors: string[] = []

  results.forEach((r, i) => {
    const b = (bookings as Booking[])[i]
    if (r.status === 'fulfilled') {
      alerted++
    } else {
      errors.push(`${b.hotel_name} (${b.id}): ${r.reason?.message ?? 'unknown error'}`)
    }
  })

  return { alerted, errors }
}
