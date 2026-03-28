import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createServiceClient()
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const db = createServiceClient()
  const body = await req.json()

  // If the cancellation deadline is being changed, reset the alerted flag so
  // the user gets a fresh reminder for the new deadline window.
  const update = { ...body }
  if ('cancellation_deadline' in body) {
    update.deadline_alerted = false
  }

  const { data, error } = await db
    .from('bookings')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const db = createServiceClient()
  const { error } = await db.from('bookings').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
