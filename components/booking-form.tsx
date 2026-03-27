'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import BottomNav from '@/components/bottom-nav'

const WATCH_PLATFORM_OPTIONS = ['booking.com', 'expedia.com', 'hotels.com', 'vio.com', 'bluepillow.com']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS']
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', ILS: '₪' }

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

const inputCls = [
  'w-full h-14 bg-[#ebebed] rounded-xl px-4 text-sm font-body text-[#001e40]',
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#001e40]/20',
  'border-0 transition-all',
].join(' ')

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 font-body">{children}</p>
  )
}

function InputWithIcon({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span
        className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ fontSize: '1.2rem', color: '#94a3b8' }}
      >
        {icon}
      </span>
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
        watch_platforms: has ? prev.watch_platforms.filter((p) => p !== platform) : [...prev.watch_platforms, platform],
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
  const sym = CURRENCY_SYMBOLS[form.currency] ?? form.currency

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🐷</span>
            <span className="font-heading font-bold text-[#001e40] text-lg">Cheapit</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#001e40]/8 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#001e40]/40" style={{ fontSize: '1.3rem' }}>person</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Back link (edit mode) */}
        {bookingId && (
          <Link href={backHref} className="flex items-center gap-1 text-gray-400 text-sm font-body mb-4 hover:text-[#001e40] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
            Back
          </Link>
        )}

        {/* Heading */}
        <h1 className="font-heading font-extrabold text-[2rem] leading-tight text-[#001e40] mb-2">
          {bookingId ? 'Edit Booking' : 'Add New Booking'}
        </h1>
        {!bookingId && (
          <p className="text-gray-500 text-sm font-body mb-6 leading-relaxed">
            Enter your existing reservation details. We'll monitor price drops 24/7 and alert you when you can save.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hotel Name */}
          <div>
            <FieldLabel>Hotel Name</FieldLabel>
            <InputWithIcon icon="hotel">
              <input
                className={inputCls}
                placeholder="e.g. The Ritz-Carlton Grand Cayman"
                value={form.hotel_name}
                onChange={(e) => set('hotel_name', e.target.value)}
                required
              />
            </InputWithIcon>
          </div>

          {/* City */}
          <div>
            <FieldLabel>City</FieldLabel>
            <InputWithIcon icon="location_on">
              <input
                className={inputCls}
                placeholder="London"
                value={form.hotel_city}
                onChange={(e) => set('hotel_city', e.target.value)}
                required
              />
            </InputWithIcon>
          </div>

          {/* Check-in / Check-out */}
          <div>
            <FieldLabel>Check-in / Check-out</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <InputWithIcon icon="calendar_month">
                <input
                  type="date"
                  className={inputCls}
                  value={form.check_in}
                  onChange={(e) => set('check_in', e.target.value)}
                  required
                />
              </InputWithIcon>
              <InputWithIcon icon="calendar_month">
                <input
                  type="date"
                  className={inputCls}
                  value={form.check_out}
                  onChange={(e) => set('check_out', e.target.value)}
                  required
                />
              </InputWithIcon>
            </div>
          </div>

          {/* Booking Total + Currency */}
          <div>
            <FieldLabel>Booking Total</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm pointer-events-none">{sym}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${inputCls} pl-8`}
                  placeholder="1,240.00"
                  value={form.price_paid}
                  onChange={(e) => set('price_paid', e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: '1.2rem', color: '#94a3b8' }}>payments</span>
              </div>
              <select
                className={`${inputCls} pr-2`}
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-body">Full stay total — we divide by nights</p>
          </div>

          {/* Room description */}
          <div>
            <FieldLabel>Room Description</FieldLabel>
            <InputWithIcon icon="bed">
              <input
                className={inputCls}
                placeholder="Superior Double Room with City View"
                value={form.room_description}
                onChange={(e) => set('room_description', e.target.value)}
                required
              />
            </InputWithIcon>
          </div>

          {/* Guests */}
          <div>
            <FieldLabel>Guests</FieldLabel>
            <InputWithIcon icon="group">
              <input
                type="number"
                min={1}
                max={10}
                className={inputCls}
                value={form.guests}
                onChange={(e) => set('guests', e.target.value)}
              />
            </InputWithIcon>
          </div>

          {/* Hotel URL */}
          <div>
            <FieldLabel>Hotel URL <span className="normal-case font-normal text-gray-400">(optional)</span></FieldLabel>
            <InputWithIcon icon="link">
              <input
                type="url"
                className={inputCls}
                placeholder="https://booking.com/hotel/..."
                value={form.hotel_url}
                onChange={(e) => set('hotel_url', e.target.value)}
              />
            </InputWithIcon>
          </div>

          {/* Booked on */}
          <div>
            <FieldLabel>Booked on <span className="normal-case font-normal text-gray-400">(optional)</span></FieldLabel>
            <InputWithIcon icon="storefront">
              <input
                className={inputCls}
                placeholder="Booking.com"
                value={form.platform}
                onChange={(e) => set('platform', e.target.value)}
              />
            </InputWithIcon>
          </div>

          {/* Cancellation deadline */}
          <div>
            <FieldLabel>Cancellation Deadline <span className="normal-case font-normal text-gray-400">(optional)</span></FieldLabel>
            <InputWithIcon icon="event_busy">
              <input
                type="datetime-local"
                className={inputCls}
                value={form.cancellation_deadline}
                onChange={(e) => set('cancellation_deadline', e.target.value)}
              />
            </InputWithIcon>
          </div>

          {/* Options */}
          <label className="flex items-center gap-3 cursor-pointer bg-white rounded-xl px-4 py-3.5 border border-gray-100">
            <Checkbox
              checked={form.breakfast_included}
              onCheckedChange={(v) => set('breakfast_included', !!v)}
            />
            <div>
              <p className="text-sm font-semibold text-[#001e40] font-body">Breakfast included</p>
              <p className="text-xs text-gray-400 font-body">Filter results to match your booking</p>
            </div>
          </label>

          {/* Watch platforms */}
          <div>
            <FieldLabel>Platforms to Monitor</FieldLabel>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {WATCH_PLATFORM_OPTIONS.map((p) => (
                <label key={p} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                  <Checkbox
                    checked={form.watch_platforms.includes(p)}
                    onCheckedChange={() => togglePlatform(p)}
                  />
                  <span className="text-sm text-[#001e40] font-body capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Average savings info card */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3">
            <div className="w-10 h-10 bg-[#006e25] rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '1.1rem' }}>trending_down</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#001e40] font-body">Average Savings: $142</p>
              <p className="text-xs text-gray-400 font-body leading-relaxed mt-0.5">
                Users who monitor similar properties typically save up to 18% when rebooking 48 hours before the cancellation window closes.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl font-body">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 bg-[#001e40] hover:bg-[#003366] text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                  {bookingId ? 'save' : 'radar'}
                </span>
                {bookingId ? 'Save Changes' : 'Start Monitoring'}
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-body pb-2">
            Encrypted &amp; Secure · Powered by CheapIt Intelligence
          </p>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
