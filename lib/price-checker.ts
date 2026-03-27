import { createServiceClient, Booking } from './supabase'
import { fetchHotelPrice } from './serpapi'
import { sendPriceDropAlert } from './telegram'
import { startOfDay } from 'date-fns'

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
      const nights = Math.max(
        1,
        Math.round(
          (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
      const pricePaidPerNight = booking.price_paid / nights

      const result = await fetchHotelPrice(booking)

      const isCheaper = result !== null && result.price < pricePaidPerNight

      // Insert price check log
      const { data: priceCheck, error: checkError } = await db
        .from('price_checks')
        .insert({
          booking_id: booking.id,
          price_found: result?.price ?? null,
          room_description_found: result?.roomDescription ?? null,
          platform_found: result?.platform ?? null,
          url: result?.url ?? null,
          is_cheaper: isCheaper,
        })
        .select()
        .single()

      if (checkError) throw new Error(`Failed to insert price check: ${checkError.message}`)

      checked++

      if (isCheaper && result) {
        // Check if we already sent an alert today for this booking
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
            priceFound: result.price,
            platform: result.platform,
            url: result.url,
          })

          await db.from('alerts').insert({
            booking_id: booking.id,
            price_check_id: priceCheck.id,
            telegram_message: message,
          })

          alertsSent++
        }
      }
    } catch (err: any) {
      errors.push(`Booking ${booking.id} (${booking.hotel_name}): ${err.message}`)
    }
  }

  return { checked, alerts: alertsSent, errors }
}
