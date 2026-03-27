import { Booking } from './supabase'

export type PriceResult = {
  price: number
  platform: string
  url: string
  roomDescription: string
}

export async function fetchHotelPrice(booking: Booking): Promise<PriceResult | null> {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: `${booking.hotel_name} ${booking.hotel_city}`,
    check_in_date: booking.check_in,
    check_out_date: booking.check_out,
    adults: String(booking.guests),
    currency: booking.currency,
    free_cancellation: 'true',
    api_key: process.env.SERPAPI_KEY ?? '',
  })

  if (booking.breakfast_included) {
    params.set('amenities', '35')
  }

  const url = `https://serpapi.com/search.json?${params.toString()}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Serpapi returned ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  const properties: any[] = data.properties ?? []

  if (properties.length === 0) return null

  // First result is the best name match
  const property = properties[0]
  const rates: any[] = property.rates ?? property.prices ?? []

  // Filter to watched platforms, fall back to all rates
  const watchPlatforms = booking.watch_platforms.map((p) => p.toLowerCase())

  const matchingRates = rates.filter((r: any) => {
    const source = (r.source ?? r.provider ?? '').toLowerCase()
    return watchPlatforms.some((p) => source.includes(p))
  })

  const candidateRates = matchingRates.length > 0 ? matchingRates : rates

  if (candidateRates.length === 0) return null

  // All prices stored per-night
  const cheapest = candidateRates.reduce((best: any, r: any) => {
    const price = (r.price ?? r.rate_per_night?.extracted_lowest ?? 0) / nights
    const bestPrice = (best.price ?? best.rate_per_night?.extracted_lowest ?? 0) / nights
    return price < bestPrice ? r : best
  })

  const rawPrice = cheapest.price ?? cheapest.rate_per_night?.extracted_lowest ?? 0
  const perNightPrice = rawPrice / nights

  return {
    price: Math.round(perNightPrice * 100) / 100,
    platform: cheapest.source ?? cheapest.provider ?? 'Unknown',
    url: cheapest.link ?? cheapest.url ?? '',
    roomDescription: property.name ?? booking.hotel_name,
  }
}
