'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInHours } from 'date-fns'
import { Booking } from '@/lib/supabase'
import BottomNav from '@/components/bottom-nav'

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', ILS: '₪' }

const CARD_GRADIENTS = [
  ['#1a3a5c', '#0a1f35'],
  ['#1a4a3a', '#0a2a1f'],
  ['#3a1a4a', '#1f0a35'],
  ['#4a2a0a', '#2a150a'],
  ['#0a2a4a', '#051520'],
]

type BookingEnriched = Booking & {
  lastPrice?: number | null
  lastChecked?: string | null
}

function Wave() {
  return (
    <svg viewBox="0 0 400 28" className="w-full" style={{ display: 'block', marginTop: -1 }} preserveAspectRatio="none">
      <path d="M0,14 C60,28 120,0 180,14 C240,28 300,4 360,14 C380,18 392,12 400,14 L400,28 L0,28 Z" fill="#006e25" opacity="0.10" />
      <path d="M0,18 C50,8 100,24 160,16 C220,8 280,22 340,14 C370,10 390,18 400,16 L400,28 L0,28 Z" fill="#006e25" opacity="0.07" />
    </svg>
  )
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<BookingEnriched[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const res = await fetch('/api/bookings')
    const data: Booking[] = await res.json()
    const enriched = await Promise.all(
      data.map(async (b) => {
        const r = await fetch(`/api/bookings/${b.id}/price-checks?limit=1`)
        if (!r.ok) return b
        const checks = await r.json()
        const last = checks[0]
        return { ...b, lastPrice: last?.price_found ?? null, lastChecked: last?.checked_at ?? null }
      })
    )
    setBookings(enriched)
    setLoading(false)
  }

  function getNights(b: Booking) {
    return Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
  }
  function ppn(b: Booking) { return b.price_paid / getNights(b) }
  function status(b: BookingEnriched) {
    if (b.lastPrice == null) return 'unknown'
    if (b.lastPrice < ppn(b)) return 'cheaper'
    if (b.lastPrice > ppn(b)) return 'higher'
    return 'same'
  }
  function urgentDeadline(b: Booking) {
    return b.cancellation_deadline
      ? differenceInHours(parseISO(b.cancellation_deadline), new Date()) <= 48
      : false
  }

  const totalSavings = bookings.reduce((sum, b) => {
    if (status(b) === 'cheaper' && b.lastPrice != null) {
      return sum + Math.round((ppn(b) - b.lastPrice) * getNights(b))
    }
    return sum
  }, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🐷</span>
            <span className="font-heading font-bold text-[#001e40] text-lg">Cheapit</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#001e40]/8 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-[#001e40]/40" style={{ fontSize: '1.3rem' }}>person</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        {/* Hero */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-body">Your Portfolio</p>
        <h1 className="font-heading font-extrabold text-[2rem] leading-tight text-[#001e40] mb-5">
          Smart Savings<br />Overview
        </h1>

        {/* Total savings card */}
        {bookings.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-body mb-1">Total Savings Found</p>
            <p className="font-heading font-bold text-[2rem] text-[#006e25] leading-none">
              {totalSavings > 0
                ? `${CURRENCY_SYMBOLS[bookings[0]?.currency] ?? '$'}${totalSavings.toLocaleString()}`
                : '$0.00'}
            </p>
          </div>
        )}

        {/* Empty state */}
        {bookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-6">
            <div className="text-5xl mb-4">🏨</div>
            <h2 className="font-heading font-bold text-xl text-[#001e40] mb-2">No bookings yet</h2>
            <p className="text-gray-500 text-sm font-body mb-6">
              Add a hotel booking with free cancellation and we'll alert you when prices drop.
            </p>
            <Link
              href="/bookings/new"
              className="inline-flex items-center gap-2 bg-[#001e40] text-white font-bold px-6 py-3 rounded-xl text-sm"
            >
              Add your first booking
            </Link>
          </div>
        )}

        {/* Booking cards */}
        <div className="grid gap-4">
          {bookings.map((b, idx) => {
            const sym = CURRENCY_SYMBOLS[b.currency] ?? b.currency
            const n = getNights(b)
            const paidPpn = ppn(b)
            const s = status(b)
            const isUrgent = urgentDeadline(b)
            const saving = s === 'cheaper' && b.lastPrice != null ? Math.round(paidPpn - b.lastPrice) : 0
            const [topColor, bottomColor] = CARD_GRADIENTS[idx % CARD_GRADIENTS.length]

            return (
              <div key={b.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 ${!b.active ? 'opacity-60' : ''}`}>
                {/* Image area */}
                <div className="relative h-44" style={{ background: `linear-gradient(135deg, ${topColor}, ${bottomColor})` }}>
                  {/* Large initial watermark */}
                  <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                    <span className="font-heading font-black text-white/10 leading-none" style={{ fontSize: '7rem' }}>
                      {b.hotel_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Save badge */}
                  {s === 'cheaper' && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#006e25] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>trending_down</span>
                      Save {sym}{saving}/nt
                    </div>
                  )}
                  {isUrgent && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>schedule</span>
                      Deadline soon
                    </div>
                  )}
                  {!b.active && (
                    <div className="absolute top-3 right-3 bg-black/40 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      Paused
                    </div>
                  )}

                  {/* Bottom fade */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                {/* Content */}
                <div className="px-4 pt-3.5 pb-3">
                  <h3 className="font-heading font-bold text-[1.05rem] text-[#001e40] mb-0.5 truncate">{b.hotel_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-400 font-body mb-3">
                    <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>calendar_today</span>
                    {format(parseISO(b.check_in), 'd MMM')} — {format(parseISO(b.check_out), 'd MMM yyyy')} · {n}n
                  </div>

                  {/* Price row */}
                  <div className="flex items-stretch gap-3 mb-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-body">Original price</p>
                      <p className="font-heading font-bold text-sm text-[#001e40]">{sym}{Math.round(paidPpn)}/nt</p>
                    </div>
                    {b.lastPrice != null && (
                      <>
                        <div className="w-px bg-gray-100" />
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-body">Current low found</p>
                          <p className={`font-heading font-bold text-sm ${s === 'cheaper' ? 'text-[#006e25]' : 'text-[#001e40]'}`}>
                            {sym}{Math.round(b.lastPrice)}/nt
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        s === 'cheaper' ? 'bg-[#006e25]'
                        : isUrgent ? 'bg-amber-500'
                        : 'bg-gray-300'
                      }`} />
                      <span className={`text-[11px] font-bold tracking-wide ${
                        s === 'cheaper' ? 'text-[#006e25]'
                        : 'text-gray-400'
                      }`}>
                        {s === 'cheaper' ? 'PRICE IS DROPPING'
                          : s === 'higher' ? 'PRICE HIGHER NOW'
                          : b.lastChecked ? 'MONITORING' : 'NOT CHECKED YET'}
                      </span>
                    </div>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="bg-[#001e40] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#003366] transition-colors"
                    >
                      Check Now
                    </Link>
                  </div>
                </div>

                <Wave />
              </div>
            )
          })}
        </div>

        {/* Add new tracking */}
        {bookings.length > 0 && (
          <Link
            href="/bookings/new"
            className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-[#001e40]/50 border-2 border-dashed border-[#001e40]/15 rounded-2xl py-5 hover:border-[#001e40]/30 hover:text-[#001e40]/70 transition-all tracking-widest"
          >
            ADD NEW TRACKING
          </Link>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
