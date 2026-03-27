'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  bookingId?: string
}

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <span className="material-symbols-outlined text-navy/60" style={{ fontSize: '1.1rem' }}>{icon}</span>
        <h2 className="font-heading font-semibold text-navy text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
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
  const title = bookingId ? 'Edit booking' : 'Track a new booking'

  const inputCls = 'flex h-10 w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition-colors'

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-navy text-white sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href={backHref} className="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>
            Back
          </Link>
          <div className="w-px h-4 bg-white/20" />
          <h1 className="font-heading font-bold text-base">{title}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">

            {/* Hotel */}
            <SectionCard icon="hotel" title="Hotel details">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hotel_name" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Hotel name *</Label>
                    <input
                      id="hotel_name"
                      className={inputCls}
                      placeholder="The Ritz London"
                      value={form.hotel_name}
                      onChange={(e) => set('hotel_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hotel_city" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">City *</Label>
                    <input
                      id="hotel_city"
                      className={inputCls}
                      placeholder="London"
                      value={form.hotel_city}
                      onChange={(e) => set('hotel_city', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hotel_url" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">
                    Hotel URL <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                  </Label>
                  <input
                    id="hotel_url"
                    type="url"
                    className={inputCls}
                    placeholder="https://booking.com/hotel/..."
                    value={form.hotel_url}
                    onChange={(e) => set('hotel_url', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="room_description" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Room description *</Label>
                  <input
                    id="room_description"
                    className={inputCls}
                    placeholder="Superior Double Room with City View"
                    value={form.room_description}
                    onChange={(e) => set('room_description', e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Paste from your booking confirmation</p>
                </div>
              </div>
            </SectionCard>

            {/* Stay */}
            <SectionCard icon="calendar_month" title="Stay dates">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="check_in" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Check-in *</Label>
                    <input
                      id="check_in"
                      type="date"
                      className={inputCls}
                      value={form.check_in}
                      onChange={(e) => set('check_in', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="check_out" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Check-out *</Label>
                    <input
                      id="check_out"
                      type="date"
                      className={inputCls}
                      value={form.check_out}
                      onChange={(e) => set('check_out', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guests" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Guests</Label>
                  <input
                    id="guests"
                    type="number"
                    min={1}
                    max={10}
                    className={inputCls}
                    value={form.guests}
                    onChange={(e) => set('guests', e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Pricing */}
            <SectionCard icon="payments" title="Your booking price">
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="price_paid" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Total price paid *</Label>
                    <input
                      id="price_paid"
                      type="number"
                      min={0}
                      step="0.01"
                      className={inputCls}
                      placeholder="620"
                      value={form.price_paid}
                      onChange={(e) => set('price_paid', e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Full stay total — we divide by nights</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Currency</Label>
                    <select
                      id="currency"
                      className={inputCls}
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
                  <Label htmlFor="platform" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Booked on</Label>
                  <input
                    id="platform"
                    className={inputCls}
                    placeholder="Booking.com"
                    value={form.platform}
                    onChange={(e) => set('platform', e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Options */}
            <SectionCard icon="tune" title="Options">
              <div className="grid gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    id="breakfast"
                    checked={form.breakfast_included}
                    onCheckedChange={(v) => set('breakfast_included', !!v)}
                    className="rounded-md"
                  />
                  <div>
                    <span className="text-sm font-medium text-navy group-hover:text-navy-light transition-colors">Breakfast included</span>
                    <p className="text-xs text-muted-foreground">We'll filter results to match your booking</p>
                  </div>
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="cancellation_deadline" className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Cancellation deadline</Label>
                  <input
                    id="cancellation_deadline"
                    type="datetime-local"
                    className={inputCls}
                    value={form.cancellation_deadline}
                    onChange={(e) => set('cancellation_deadline', e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Watch platforms */}
            <SectionCard icon="travel_explore" title="Platforms to monitor">
              <div className="grid grid-cols-2 gap-3">
                {WATCH_PLATFORM_OPTIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                    <Checkbox
                      id={p}
                      checked={form.watch_platforms.includes(p)}
                      onCheckedChange={() => togglePlatform(p)}
                      className="rounded-md"
                    />
                    <span className="text-sm text-navy/80 group-hover:text-navy transition-colors capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </SectionCard>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span>
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-navy hover:bg-muted transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                      {bookingId ? 'save' : 'rocket_launch'}
                    </span>
                    {bookingId ? 'Save changes' : 'Start monitoring'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
