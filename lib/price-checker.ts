import { createServiceClient, Booking } from './supabase'
import { fetchHotelPrice } from './serpapi'
import { sendPriceDropAlert } from './telegram'
import { startOfDay } from 'date-fns'

async function checkOneBooking(
  db: ReturnType<typeof createServiceClient>,
  booking: Booking
): Promise<{ alerted: boolean; priceFound: number | null }> {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
    )
  )
  const pricePaidPerNight = booking.price_paid / nights

  const result = await fetchHotelPrice(booking)

  // Use cheapest watched price for comparison; fall back to cheapest overall
  const best = result?.cheapestWatched ?? result?.cheapestAny ?? null
  const isCheaper = best !== null && best.pricePerNight < pricePaidPerNight

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
      raw_response: result?.rawResponse ?? null,
    })
    .select()
    .single()

  if (checkError) throw new Error(`Failed to insert price check: ${checkError.message}`)

  if (isCheaper && best && result) {
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

export async function runPriceCheckForBooking(bookingId: string) {
  const db = createServiceClient()
  const { data: booking, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (error || !booking) throw new Error('Booking not found')
  return checkOneBooking(db, booking as Booking)
}

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
