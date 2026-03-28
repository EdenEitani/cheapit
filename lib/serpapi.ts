import { Booking } from './supabase'

export type ProviderPrice = {
  source: string
  pricePerNight: number
  totalPrice: number
  url: string
  isWatched: boolean
}

export type PriceResult = {
  hotelName: string
  hotelLink: string
  exactHotelMatch: boolean
  cheapestWatched: ProviderPrice | null   // best price from watched platforms
  cheapestAny: ProviderPrice | null       // best price overall
  allPrices: ProviderPrice[]              // every provider found
  rawResponse: Record<string, unknown>   // full Serpapi JSON
}

async function doSearch(
  booking: Booking,
  withFilters: boolean,
  adults?: number
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: `${booking.hotel_name} ${booking.hotel_city}`,
    check_in_date: booking.check_in,
    check_out_date: booking.check_out,
    adults: String(adults ?? booking.guests),
    currency: booking.currency,
    api_key: process.env.SERPAPI_KEY ?? '',
  })

  if (withFilters) {
    params.set('free_cancellation', 'true')
    if (booking.breakfast_included) params.set('amenities', '35')
  }

  const response = await fetch(`https://serpapi.com/search.json?${params}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Serpapi ${response.status}: ${await response.text()}`)

  const data = await response.json()

  const hasResults =
    (data.type === 'hotel' && Array.isArray(data.featured_prices) && data.featured_prices.length > 0) ||
    (Array.isArray(data.properties) && data.properties.length > 0)

  return hasResults ? data : null
}

function parseResult(
  data: Record<string, unknown>,
  booking: Booking,
  nights: number
): PriceResult {
  let hotelName: string
  let hotelLink: string
  let rawPrices: any[]

  if (data.type === 'hotel') {
    hotelName = (data.name as string) ?? booking.hotel_name
    hotelLink = (data.link as string) ?? ''
    rawPrices = (data.featured_prices as any[]) ?? []
  } else {
    const prop = (data.properties as any[])[0]
    hotelName = prop.name ?? booking.hotel_name
    hotelLink = prop.link ?? ''
    rawPrices = prop.prices ?? prop.featured_prices ?? []
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const firstWord = (s: string) => normalize(s).slice(0, 6)
  const exactHotelMatch =
    normalize(hotelName).includes(firstWord(booking.hotel_name)) ||
    normalize(booking.hotel_name).includes(firstWord(hotelName))

  const watchPlatforms = booking.watch_platforms.map((p) => p.toLowerCase())

  const allPrices: ProviderPrice[] = rawPrices
    .map((r: any) => {
      const ppn: number = r.rate_per_night?.extracted_lowest ?? (r.price ?? 0) / nights
      const total: number = r.total_rate?.extracted_lowest ?? ppn * nights
      const source: string = r.source ?? r.provider ?? 'Unknown'
      const isWatched = watchPlatforms.some((p) => source.toLowerCase().includes(p))
      return { source, pricePerNight: Math.round(ppn * 100) / 100, totalPrice: Math.round(total), url: r.link ?? '', isWatched }
    })
    .filter((p) => p.pricePerNight > 0)
    .sort((a, b) => a.pricePerNight - b.pricePerNight)

  const watchedPrices = allPrices.filter((p) => p.isWatched)

  return {
    hotelName,
    hotelLink,
    exactHotelMatch,
    cheapestWatched: watchedPrices[0] ?? null,
    cheapestAny: allPrices[0] ?? null,
    allPrices,
    rawResponse: data as Record<string, unknown>,
  }
}

/**
 * Fetch hotel price, optionally using a different adult count (for normalization).
 * Tries with filters first, falls back without — both attempts run against the
 * same adult count.
 */
export async function fetchHotelPrice(
  booking: Booking,
  options?: { adultsOverride?: number }
): Promise<PriceResult | null> {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
    )
  )
  const adults = options?.adultsOverride

  // Try with filters first, fall back without
  let data = await doSearch(booking, true, adults)
  if (!data) data = await doSearch(booking, false, adults)
  if (!data) return null

  return parseResult(data, booking, nights)
}
