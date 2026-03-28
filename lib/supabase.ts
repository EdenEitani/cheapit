import { createClient } from '@supabase/supabase-js'

export type Booking = {
  id: string
  hotel_name: string
  hotel_city: string
  check_in: string
  check_out: string
  room_description: string
  guests: number
  price_paid: number
  currency: string
  hotel_url: string | null
  platform: string | null
  breakfast_included: boolean
  cancellation_deadline: string | null
  watch_platforms: string[]
  active: boolean
  created_at: string
  deadline_alerted: boolean
}

export type PriceCheck = {
  id: string
  booking_id: string
  checked_at: string
  price_found: number | null
  room_description_found: string | null  // "match::HotelName" or "fuzzy::HotelName"
  platform_found: string | null
  url: string | null
  is_cheaper: boolean | null
  raw_response: Record<string, unknown> | null
}

export type Alert = {
  id: string
  booking_id: string
  price_check_id: string
  sent_at: string
  telegram_message: string
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}
