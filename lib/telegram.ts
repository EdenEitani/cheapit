import { Booking } from './supabase'
import { format, parseISO } from 'date-fns'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪',
}

async function sendTelegramMessage(text: string): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    }
  )
  if (!res.ok) throw new Error(`Telegram API error: ${await res.text()}`)
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
  const nights = Math.max(1, Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  ))
  const saving = pricePaidPerNight - priceFound
  const savingPct = Math.round((saving / pricePaidPerNight) * 100)
  const deadlineStr = booking.cancellation_deadline
    ? format(parseISO(booking.cancellation_deadline), 'd MMM yyyy')
    : 'N/A'

  const message = [
    '🏨 *Price Drop Alert!*',
    '',
    `*Hotel:* ${booking.hotel_name}, ${booking.hotel_city}`,
    `*Room:* ${booking.room_description}`,
    `*Dates:* ${format(parseISO(booking.check_in), 'd MMM')} → ${format(parseISO(booking.check_out), 'd MMM')} (${nights} night${nights > 1 ? 's' : ''})`,
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

  await sendTelegramMessage(message)
  return message
}

/**
 * Sent when the cancellation deadline is within 48 hours.
 * Includes the latest market price for context so the user can decide whether
 * to rebook before the window closes.
 */
export async function sendDeadlineAlert({
  booking,
  hoursRemaining,
  pricePaidPerNight,
  latestPrice,
}: {
  booking: Booking
  hoursRemaining: number
  pricePaidPerNight: number
  latestPrice: number | null
}): Promise<string> {
  const sym = CURRENCY_SYMBOLS[booking.currency] ?? booking.currency
  const nights = Math.max(1, Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  ))
  const deadlineStr = format(parseISO(booking.cancellation_deadline!), 'd MMM yyyy HH:mm')
  const hoursLabel = Math.round(hoursRemaining)

  let priceContext: string
  if (latestPrice != null) {
    const diff = pricePaidPerNight - latestPrice
    if (diff > 0) {
      priceContext = `📉 *Market rate:* ${sym}${Math.round(latestPrice)}/nt _(${sym}${Math.round(diff)}/nt cheaper — consider rebooking!)_`
    } else if (diff < 0) {
      priceContext = `📈 *Market rate:* ${sym}${Math.round(latestPrice)}/nt _(${sym}${Math.round(-diff)}/nt more expensive — your rate is good)_`
    } else {
      priceContext = `💰 *Market rate:* ${sym}${Math.round(latestPrice)}/nt (same as your rate)`
    }
  } else {
    priceContext = `💰 *You paid:* ${sym}${Math.round(pricePaidPerNight)}/nt _(no market data yet)_`
  }

  const message = [
    `⏰ *Cancellation Deadline in ${hoursLabel}h!*`,
    '',
    `*${booking.hotel_name}*, ${booking.hotel_city}`,
    `📅 ${format(parseISO(booking.check_in), 'd MMM')} → ${format(parseISO(booking.check_out), 'd MMM yyyy')} (${nights}n)`,
    '',
    `🚨 *Cancel by:* ${deadlineStr}`,
    '',
    priceContext,
    '',
    `If you want to rebook at a lower rate, act now before this deadline passes.`,
    ...(booking.hotel_url ? [`🔗 [Hotel link](${booking.hotel_url})`] : []),
  ].join('\n')

  await sendTelegramMessage(message)
  return message
}
