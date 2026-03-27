'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BookingForm, { BookingFormValues } from '@/components/booking-form'
import { Booking } from '@/lib/supabase'

function toLocalDatetime(iso: string | null): string {
  if (!iso) return ''
  // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
  return iso.slice(0, 16)
}

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initialValues, setInitialValues] = useState<Partial<BookingFormValues> | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((b: Booking) => {
        setInitialValues({
          hotel_name: b.hotel_name,
          hotel_city: b.hotel_city,
          hotel_url: b.hotel_url ?? '',
          check_in: b.check_in,
          check_out: b.check_out,
          room_description: b.room_description,
          guests: b.guests,
          price_paid: b.price_paid,
          currency: b.currency,
          platform: b.platform ?? '',
          breakfast_included: b.breakfast_included,
          cancellation_deadline: toLocalDatetime(b.cancellation_deadline),
          watch_platforms: b.watch_platforms,
        })
      })
      .catch(() => router.push('/'))
  }, [id, router])

  if (!initialValues) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  return <BookingForm initialValues={initialValues} bookingId={id} />
}
