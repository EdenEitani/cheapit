import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const db = createServiceClient()
  const body = await req.json()

  const { data, error } = await db
    .from('bookings')
    .insert({
      hotel_name: body.hotel_name,
      hotel_city: body.hotel_city,
      check_in: body.check_in,
      check_out: body.check_out,
      room_description: body.room_description,
      guests: body.guests,
      price_paid: body.price_paid,
      currency: body.currency,
      platform: body.platform ?? null,
      breakfast_included: body.breakfast_included ?? false,
      cancellation_deadline: body.cancellation_deadline ?? null,
      watch_platforms: body.watch_platforms ?? ['booking.com', 'expedia.com', 'hotels.com'],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
