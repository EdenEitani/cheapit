'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInHours } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const res = await fetch('/api/bookings')
    const data: Booking[] = await res.json()

    const enriched = await Promise.all(
      data.map(async (b) => {
        const res2 = await fetch(`/api/bookings/${b.id}/price-checks?limit=1`)
        if (!res2.ok) return b
        const checks = await res2.json()
        const last = checks[0]
        return {
          ...b,
          lastPrice: last?.price_found ?? null,
          lastChecked: last?.checked_at ?? null,
          lastPlatform: last?.platform_found ?? null,
        }
      })
    )
    setBookings(enriched)
    setLoading(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)))
  }

  async function deleteBooking(id: string) {
    if (!confirm('Delete this booking?')) return
    await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    setBookings((prev) => prev.filter((b) => b.id !== id))
  }

  function getNights(b: Booking) {
    return Math.max(
      1,
      Math.round(
        (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )
  }

  function pricePaidPerNight(b: Booking) {
    return b.price_paid / getNights(b)
  }

  function priceStatus(b: BookingWithLastCheck) {
    if (b.lastPrice == null) return 'unknown'
    const ppn = pricePaidPerNight(b)
    if (b.lastPrice < ppn) return 'cheaper'
    if (b.lastPrice > ppn) return 'more'
    return 'same'
  }

  function cancellationUrgent(b: Booking) {
    if (!b.cancellation_deadline) return false
    return differenceInHours(parseISO(b.cancellation_deadline), new Date()) <= 48
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading bookings…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CheapIt</h1>
            <p className="text-gray-500 mt-1">
              Monitor hotel prices and rebook cheaper when available
            </p>
          </div>
          <Link href="/bookings/new">
            <Button>+ Add Booking</Button>
          </Link>
        </div>

        {bookings.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <p className="text-gray-400 text-lg mb-4">No bookings tracked yet</p>
              <Link href="/bookings/new">
                <Button>Add your first booking</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookings.map((b) => {
              const sym = CURRENCY_SYMBOLS[b.currency] ?? b.currency
              const ppn = pricePaidPerNight(b)
              const status = priceStatus(b)
              const n = getNights(b)
              const urgent = cancellationUrgent(b)

              return (
                <Card
                  key={b.id}
                  className={`transition-opacity ${!b.active ? 'opacity-60' : ''}`}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Link
                            href={`/bookings/${b.id}`}
                            className="text-lg font-semibold text-gray-900 hover:underline truncate"
                          >
                            {b.hotel_name}
                          </Link>
                          <span className="text-gray-500 text-sm">{b.hotel_city}</span>
                          {urgent && (
                            <Badge variant="destructive" className="shrink-0">
                              ⚠️ Deadline within 48h
                            </Badge>
                          )}
                          {!b.active && (
                            <Badge variant="secondary" className="shrink-0">
                              Paused
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-2 truncate">{b.room_description}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span>
                            {format(parseISO(b.check_in), 'd MMM yyyy')} →{' '}
                            {format(parseISO(b.check_out), 'd MMM yyyy')} ({n} night{n > 1 ? 's' : ''})
                          </span>
                          <span>
                            {b.guests} guest{b.guests > 1 ? 's' : ''}
                          </span>
                          {b.breakfast_included && <span>🍳 Breakfast incl.</span>}
                          {b.cancellation_deadline && (
                            <span>
                              Cancel by {format(parseISO(b.cancellation_deadline), 'd MMM')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-400 mb-0.5">Paid / night</div>
                        <div className="text-xl font-bold text-gray-800">
                          {sym}{Math.round(ppn)}
                        </div>
                        {b.lastPrice != null && (
                          <div
                            className={`text-sm font-medium mt-1 ${
                              status === 'cheaper'
                                ? 'text-green-600'
                                : status === 'more'
                                ? 'text-red-500'
                                : 'text-gray-400'
                            }`}
                          >
                            {status === 'cheaper' ? '↓ ' : status === 'more' ? '↑ ' : ''}
                            {sym}{Math.round(b.lastPrice)} now
                            {b.lastPlatform && (
                              <span className="text-gray-400 font-normal">
                                {' '}· {b.lastPlatform}
                              </span>
                            )}
                          </div>
                        )}
                        {b.lastChecked ? (
                          <div className="text-xs text-gray-400 mt-1">
                            {format(parseISO(b.lastChecked), 'd MMM HH:mm')}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-1">Not checked yet</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={b.active}
                          onCheckedChange={(v) => toggleActive(b.id, v)}
                        />
                        <span className="text-sm text-gray-500">
                          {b.active ? 'Monitoring' : 'Paused'}
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <Link href={`/bookings/${b.id}`}>
                          <Button variant="outline" size="sm">
                            Details
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteBooking(b.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
