import { Booking } from './supabase'
import { format, parseISO } from 'date-fns'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  ILS: '₪',
}

export async function sendPriceDropAlert({
  booking,
  pricePaidPerNight,
  priceFound,
  platform,
  url,
}: {
  booking: Booking
  pricePaidPerNight: number
  priceFound: number
  platform: string
  url: string
}): Promise<string> {
  const sym = CURRENCY_SYMBOLS[booking.currency] ?? booking.currency
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )
  const saving = pricePaidPerNight - priceFound
  const savingPct = Math.round((saving / pricePaidPerNight) * 100)

  const checkIn = format(parseISO(booking.check_in), 'd MMM')
  const checkOut = format(parseISO(booking.check_out), 'd MMM')

  const deadlineStr = booking.cancellation_deadline
    ? format(parseISO(booking.cancellation_deadline), 'd MMM yyyy')
    : 'N/A'

  const message = [
    '🏨 *Price Drop Alert!*',
    '',
    `*Hotel:* ${booking.hotel_name}, ${booking.hotel_city}`,
    `*Room:* ${booking.room_description}`,
    `*Dates:* ${checkIn} → ${checkOut} (${nights} night${nights > 1 ? 's' : ''})`,
    `*Guests:* ${booking.guests}`,
    '',
    `💰 *You paid:* ${sym}${Math.round(pricePaidPerNight * nights)}`,
    `📉 *Now available:* ${sym}${Math.round(priceFound * nights)} on ${platform}`,
    `💸 *Saving:* ${sym}${Math.round(saving * nights)} (${savingPct}%)`,
    '',
    `⚠️ *Cancellation deadline:* ${deadlineStr}`,
    `🔗 [Book now](${url})`,
    '',
    `Free cancellation ✅${booking.breakfast_included ? ' | Breakfast included ✅' : ''}`,
  ].join('\n')

  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    }
  )

  if (!res.ok) {
    throw new Error(`Telegram API error: ${await res.text()}`)
  }

  return message
}
