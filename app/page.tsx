'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInHours } from 'date-fns'
import { Booking } from '@/lib/supabase'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪',
}

type BookingWithLastCheck = Booking & {
  lastPrice?: number | null
  lastChecked?: string | null
  lastPlatform?: string | null
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<BookingWithLastCheck[]>([])
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
        return { ...b, lastPrice: last?.price_found ?? null, lastChecked: last?.checked_at ?? null, lastPlatform: last?.platform_found ?? null }
      })
    )
    setBookings(enriched)
    setLoading(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)))
  }

  async function deleteBooking(id: string) {
    if (!confirm('Delete this booking?')) return
    await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    setBookings((prev) => prev.filter((b) => b.id !== id))
  }

  function getNights(b: Booking) {
    return Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
  }

  function ppn(b: Booking) { return b.price_paid / getNights(b) }

  function status(b: BookingWithLastCheck) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-body">Loading your bookings…</p>
        </div>
      </div>
    )
  }

  const cheaper = bookings.filter(b => status(b) === 'cheaper')
  const urgent = bookings.filter(urgentDeadline)

  return (
    <div className="min-h-screen bg-surface">
      {/* Top nav */}
      <header className="bg-navy text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '1.5rem' }}>hotel</span>
            <div>
              <span className="font-heading font-bold text-lg leading-none">CheapIt</span>
              <p className="text-xs text-white/50 leading-none mt-0.5">price monitor</p>
            </div>
          </div>
          <Link
            href="/bookings/new"
            className="inline-flex items-center gap-1.5 bg-forest hover:bg-forest-light text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
            Add booking
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        {bookings.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-navy/60" style={{ fontSize: '1.1rem' }}>tracking</span>
                <span className="text-xs text-muted-foreground font-body uppercase tracking-wide">Tracked</span>
              </div>
              <div className="text-3xl font-heading font-bold text-navy">{bookings.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-forest" style={{ fontSize: '1.1rem' }}>savings</span>
                <span className="text-xs text-muted-foreground font-body uppercase tracking-wide">Price drops</span>
              </div>
              <div className="text-3xl font-heading font-bold text-forest">{cheaper.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '1.1rem' }}>timer</span>
                <span className="text-xs text-muted-foreground font-body uppercase tracking-wide">Deadline soon</span>
              </div>
              <div className="text-3xl font-heading font-bold text-amber-500">{urgent.length}</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {bookings.length === 0 ? (
          <div className="bg-white rounded-3xl border border-border shadow-sm text-center py-24 px-8">
            <span className="material-symbols-outlined text-navy/20 block mb-4" style={{ fontSize: '4rem' }}>hotel</span>
            <h2 className="font-heading font-bold text-xl text-navy mb-2">No bookings tracked yet</h2>
            <p className="text-muted-foreground font-body mb-8 max-w-sm mx-auto">
              Add a hotel booking with free cancellation and we'll alert you if a cheaper price appears.
            </p>
            <Link
              href="/bookings/new"
              className="inline-flex items-center gap-2 bg-navy hover:bg-navy-light text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
              Add your first booking
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {bookings.map((b) => {
              const sym = CURRENCY_SYMBOLS[b.currency] ?? b.currency
              const n = getNights(b)
              const paidPpn = ppn(b)
              const s = status(b)
              const isUrgent = urgentDeadline(b)
              const saving = s === 'cheaper' && b.lastPrice != null ? Math.round(paidPpn - b.lastPrice) : 0
              const savingPct = saving > 0 ? Math.round((saving / paidPpn) * 100) : 0

              return (
                <div
                  key={b.id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden ${
                    !b.active ? 'opacity-60' : ''
                  } ${s === 'cheaper' ? 'border-forest/30' : isUrgent ? 'border-amber-300' : 'border-border'}`}
                >
                  {/* Price drop banner */}
                  {s === 'cheaper' && (
                    <div className="bg-forest px-5 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-white text-sm font-semibold">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>trending_down</span>
                        Price drop available!
                      </div>
                      <span className="text-white/80 text-sm">Save {sym}{saving}/night ({savingPct}% off)</span>
                    </div>
                  )}
                  {isUrgent && s !== 'cheaper' && (
                    <div className="bg-amber-500 px-5 py-2.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-white" style={{ fontSize: '1rem' }}>schedule</span>
                      <span className="text-white text-sm font-semibold">Cancellation deadline within 48 hours</span>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <Link
                            href={`/bookings/${b.id}`}
                            className="font-heading font-bold text-lg text-navy hover:text-navy-light transition-colors truncate"
                          >
                            {b.hotel_name}
                          </Link>
                          <span className="text-muted-foreground text-sm">·</span>
                          <span className="text-muted-foreground text-sm">{b.hotel_city}</span>
                          {!b.active && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-body mb-3 truncate">{b.room_description}</p>

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-2.5 py-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>calendar_month</span>
                            {format(parseISO(b.check_in), 'd MMM')} → {format(parseISO(b.check_out), 'd MMM yyyy')}
                            <span className="text-muted-foreground/60 ml-0.5">({n}n)</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-2.5 py-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>group</span>
                            {b.guests}
                          </span>
                          {b.breakfast_included && (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>restaurant</span>
                              Breakfast
                            </span>
                          )}
                          {b.cancellation_deadline && (
                            <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 ${isUrgent ? 'bg-red-50 text-red-600 font-medium' : 'bg-surface text-muted-foreground'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>event_busy</span>
                              Cancel by {format(parseISO(b.cancellation_deadline), 'd MMM')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price block */}
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground mb-0.5">Paid / night</div>
                        <div className="font-heading font-bold text-2xl text-navy">{sym}{Math.round(paidPpn)}</div>
                        {b.lastPrice != null && (
                          <div className={`text-sm font-semibold mt-1 ${s === 'cheaper' ? 'text-forest' : s === 'higher' ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {s === 'cheaper' ? '↓ ' : s === 'higher' ? '↑ ' : '= '}
                            {sym}{Math.round(b.lastPrice)} now
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {b.lastChecked ? format(parseISO(b.lastChecked), 'd MMM HH:mm') : 'Not checked yet'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleActive(b.id, !b.active)}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          b.active
                            ? 'border-forest/40 text-forest bg-forest/5 hover:bg-forest/10'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                          {b.active ? 'pause' : 'play_arrow'}
                        </span>
                        {b.active ? 'Monitoring' : 'Paused'}
                      </button>

                      <div className="ml-auto flex items-center gap-2">
                        <Link
                          href={`/bookings/${b.id}`}
                          className="inline-flex items-center gap-1 text-sm text-navy border border-border hover:border-navy/40 hover:bg-navy/5 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>open_in_full</span>
                          Details
                        </Link>
                        <button
                          onClick={() => deleteBooking(b.id)}
                          className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>delete</span>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
