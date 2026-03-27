import { Booking } from './supabase'

export type PriceResult = {
  price: number          // per night
  platform: string
  url: string
  hotelNameFound: string // actual hotel name returned by Serpapi
  exactHotelMatch: boolean
}

async function searchHotels(booking: Booking, withFilters: boolean): Promise<any[] | null> {
  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: `${booking.hotel_name} ${booking.hotel_city}`,
    check_in_date: booking.check_in,
    check_out_date: booking.check_out,
    adults: String(booking.guests),
    currency: booking.currency,
    api_key: process.env.SERPAPI_KEY ?? '',
  })

  if (withFilters) {
    params.set('free_cancellation', 'true')
    if (booking.breakfast_included) params.set('amenities', '35')
  }

  const url = `https://serpapi.com/search.json?${params.toString()}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Serpapi ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  const properties: any[] = data.properties ?? []
  return properties.length > 0 ? properties : null
}

export async function fetchHotelPrice(booking: Booking): Promise<PriceResult | null> {
  // Try with free cancellation (+ breakfast) first; fall back without filters
  let properties = await searchHotels(booking, true)
  if (!properties) {
    properties = await searchHotels(booking, false)
  }
  if (!properties) return null

  // First property is the best name match from Google
  const property = properties[0]
  const hotelNameFound: string = property.name ?? booking.hotel_name

  // Loose name match: both sides contain the first significant word
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const firstWord = (s: string) => normalize(s).slice(0, 6)
  const exactHotelMatch =
    normalize(hotelNameFound).includes(firstWord(booking.hotel_name)) ||
    normalize(booking.hotel_name).includes(firstWord(hotelNameFound))

  // prices[] is the per-source breakdown; rate_per_night is already per-night
  const prices: any[] = property.prices ?? []

  // Filter to watched platforms, fall back to all
  const watchPlatforms = booking.watch_platforms.map((p) => p.toLowerCase())
  const matching = prices.filter((r: any) => {
    const source = (r.source ?? '').toLowerCase()
    return watchPlatforms.some((p) => source.includes(p))
  })
  const candidates = matching.length > 0 ? matching : prices

  let bestPrice: number
  let bestPlatform: string
  let bestUrl: string

  if (candidates.length > 0) {
    const cheapest = candidates.reduce((best: any, r: any) => {
      const a = r.rate_per_night?.extracted_lowest ?? Infinity
      const b = best.rate_per_night?.extracted_lowest ?? Infinity
      return a < b ? r : best
    })
    bestPrice = cheapest.rate_per_night?.extracted_lowest ?? 0
    bestPlatform = cheapest.source ?? 'Unknown'
    bestUrl = cheapest.link ?? ''
  } else {
    // Fall back to the property-level lowest rate
    bestPrice = property.rate_per_night?.extracted_lowest ?? 0
    bestPlatform = 'Google Hotels'
    bestUrl = property.link ?? ''
  }

  if (!bestPrice) return null

  return {
    price: Math.round(bestPrice * 100) / 100,
    platform: bestPlatform,
    url: bestUrl,
    hotelNameFound,
    exactHotelMatch,
  }
}
