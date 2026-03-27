'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'

const WATCH_PLATFORM_OPTIONS = [
  'booking.com',
  'expedia.com',
  'hotels.com',
  'vio.com',
  'bluepillow.com',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS']

export type BookingFormValues = {
  hotel_name: string
  hotel_city: string
  hotel_url: string
  check_in: string
  check_out: string
  room_description: string
  guests: number | string
  price_paid: number | string
  currency: string
  platform: string
  breakfast_included: boolean
  cancellation_deadline: string
  watch_platforms: string[]
}

const DEFAULT_VALUES: BookingFormValues = {
  hotel_name: '',
  hotel_city: '',
  hotel_url: '',
  check_in: '',
  check_out: '',
  room_description: '',
  guests: 2,
  price_paid: '',
  currency: 'USD',
  platform: '',
  breakfast_included: false,
  cancellation_deadline: '',
  watch_platforms: ['booking.com', 'expedia.com', 'hotels.com'],
}

type Props = {
  initialValues?: Partial<BookingFormValues>
  bookingId?: string   // if set → edit mode (PATCH), else → create mode (POST)
}

export default function BookingForm({ initialValues, bookingId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<BookingFormValues>({ ...DEFAULT_VALUES, ...initialValues })

  function set(field: keyof BookingFormValues, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function togglePlatform(platform: string) {
    setForm((prev) => {
      const has = prev.watch_platforms.includes(platform)
      return {
        ...prev,
        watch_platforms: has
          ? prev.watch_platforms.filter((p) => p !== platform)
          : [...prev.watch_platforms, platform],
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.hotel_name || !form.hotel_city || !form.check_in || !form.check_out || !form.price_paid) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.watch_platforms.length === 0) {
      setError('Select at least one platform to watch.')
      return
    }

    setSaving(true)

    const payload = {
      ...form,
      price_paid: parseFloat(String(form.price_paid)),
      guests: Number(form.guests),
      hotel_url: form.hotel_url || null,
      cancellation_deadline: form.cancellation_deadline || null,
      platform: form.platform || null,
    }

    const res = await fetch(bookingId ? `/api/bookings/${bookingId}` : '/api/bookings', {
      method: bookingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save booking')
      setSaving(false)
      return
    }

    router.push(bookingId ? `/bookings/${bookingId}` : '/')
  }

  const backHref = bookingId ? `/bookings/${bookingId}` : '/'
  const title = bookingId ? 'Edit booking' : 'Track a booking'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-5">
            {/* Hotel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hotel details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hotel_name">Hotel name *</Label>
                    <Input
                      id="hotel_name"
                      placeholder="The Ritz London"
                      value={form.hotel_name}
                      onChange={(e) => set('hotel_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hotel_city">City *</Label>
                    <Input
                      id="hotel_city"
                      placeholder="London"
                      value={form.hotel_city}
                      onChange={(e) => set('hotel_city', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hotel_url">Hotel URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    id="hotel_url"
                    type="url"
                    placeholder="https://booking.com/hotel/..."
                    value={form.hotel_url}
                    onChange={(e) => set('hotel_url', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="room_description">Room description *</Label>
                  <Input
                    id="room_description"
                    placeholder="Superior Double Room with City View"
                    value={form.room_description}
                    onChange={(e) => set('room_description', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-400">Paste from your booking confirmation</p>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stay</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="check_in">Check-in *</Label>
                    <Input
                      id="check_in"
                      type="date"
                      value={form.check_in}
                      onChange={(e) => set('check_in', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="check_out">Check-out *</Label>
                    <Input
                      id="check_out"
                      type="date"
                      value={form.check_out}
                      onChange={(e) => set('check_out', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guests">Guests</Label>
                  <Input
                    id="guests"
                    type="number"
                    min={1}
                    max={10}
                    value={form.guests}
                    onChange={(e) => set('guests', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your booking price</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="price_paid">Total price paid *</Label>
                    <Input
                      id="price_paid"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="620"
                      value={form.price_paid}
                      onChange={(e) => set('price_paid', e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-400">Full stay total — we divide by nights</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="platform">Booked on</Label>
                  <Input
                    id="platform"
                    placeholder="Booking.com"
                    value={form.platform}
                    onChange={(e) => set('platform', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Options</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="breakfast"
                    checked={form.breakfast_included}
                    onCheckedChange={(v) => set('breakfast_included', !!v)}
                  />
                  <Label htmlFor="breakfast" className="font-normal cursor-pointer">
                    Breakfast included in my booking
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cancellation_deadline">Cancellation deadline</Label>
                  <Input
                    id="cancellation_deadline"
                    type="datetime-local"
                    value={form.cancellation_deadline}
                    onChange={(e) => set('cancellation_deadline', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Watch platforms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platforms to monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {WATCH_PLATFORM_OPTIONS.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <Checkbox
                        id={p}
                        checked={form.watch_platforms.includes(p)}
                        onCheckedChange={() => togglePlatform(p)}
                      />
                      <Label htmlFor={p} className="font-normal capitalize cursor-pointer">
                        {p}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 justify-end">
              <Link href={backHref}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : bookingId ? 'Save changes' : 'Start monitoring'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
