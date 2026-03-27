'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Booking, PriceCheck, Alert } from '@/lib/supabase'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪',
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [checks, setChecks] = useState<PriceCheck[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [bookingRes, checksRes, alertsRes] = await Promise.all([
      fetch(`/api/bookings/${id}`),
      fetch(`/api/bookings/${id}/price-checks`),
      fetch(`/api/bookings/${id}/alerts`),
    ])
    if (!bookingRes.ok) { router.push('/'); return }
    setBooking(await bookingRes.json())
    setChecks(await checksRes.json())
    setAlerts(await alertsRes.json())
    setLoading(false)
  }

  async function triggerCheck() {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await fetch(`/api/bookings/${id}/check`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setCheckResult(`Error: ${data.error}`)
      } else if (data.priceFound == null) {
        setCheckResult('No price found for this hotel/dates.')
      } else {
        const sym = CURRENCY_SYMBOLS[booking!.currency] ?? booking!.currency
        const nights = Math.max(1, Math.round(
          (new Date(booking!.check_out).getTime() - new Date(booking!.check_in).getTime()) / 86400000
        ))
        const ppn = booking!.price_paid / nights
        const diff = ppn - data.priceFound
        if (data.alerted) {
          setCheckResult(`Price drop found! ${sym}${Math.round(data.priceFound)}/night — Telegram alert sent.`)
        } else if (diff > 0) {
          setCheckResult(`Price drop found (${sym}${Math.round(data.priceFound)}/night) but alert already sent today.`)
        } else {
          setCheckResult(`No cheaper price found. Current: ${sym}${Math.round(data.priceFound)}/night.`)
        }
      }
      // Refresh checks list
      const checksRes = await fetch(`/api/bookings/${id}/price-checks`)
      setChecks(await checksRes.json())
    } catch {
      setCheckResult('Check failed — see console.')
    }
    setChecking(false)
  }

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  const sym = CURRENCY_SYMBOLS[booking.currency] ?? booking.currency
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
    )
  )
  const ppn = booking.price_paid / nights

  const chartData = [...checks]
    .reverse()
    .filter((c) => c.price_found != null)
    .map((c) => ({
      date: format(parseISO(c.checked_at), 'd MMM HH:mm'),
      price: Math.round(c.price_found!),
    }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerCheck}
              disabled={checking}
            >
              {checking ? 'Checking…' : '🔍 Check now'}
            </Button>
            <Link href={`/bookings/${id}/edit`}>
              <Button variant="outline" size="sm">✏️ Edit</Button>
            </Link>
          </div>
        </div>

        {checkResult && (
          <div className={`mb-4 px-4 py-3 rounded-md text-sm border ${
            checkResult.startsWith('Error')
              ? 'bg-red-50 border-red-200 text-red-700'
              : checkResult.includes('drop') || checkResult.includes('alert')
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}>
            {checkResult}
          </div>
        )}

        {/* Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {booking.hotel_url ? (
                      <a
                        href={booking.hotel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {booking.hotel_name} ↗
                      </a>
                    ) : (
                      booking.hotel_name
                    )}
                  </h1>
                </div>
                <p className="text-gray-500 mb-1">{booking.hotel_city}</p>
                <p className="text-gray-600">{booking.room_description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-3">
                  <span>
                    {format(parseISO(booking.check_in), 'd MMM yyyy')} →{' '}
                    {format(parseISO(booking.check_out), 'd MMM yyyy')} ({nights} night{nights > 1 ? 's' : ''})
                  </span>
                  <span>{booking.guests} guest{booking.guests > 1 ? 's' : ''}</span>
                  {booking.breakfast_included && <span>🍳 Breakfast incl.</span>}
                  {booking.platform && <span>Booked via {booking.platform}</span>}
                  {booking.cancellation_deadline && (
                    <span>
                      Cancel by {format(parseISO(booking.cancellation_deadline), 'd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-400 mb-0.5">You paid (total)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {sym}{Math.round(booking.price_paid)}
                </div>
                <div className="text-sm text-gray-500">{sym}{Math.round(ppn)} / night</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price History Chart */}
        {chartData.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Price history (per night)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={(v) => `${sym}${v}`} />
                  <Tooltip formatter={(v) => [`${sym}${Number(v)}`, 'Price found']} />
                  <ReferenceLine
                    y={Math.round(ppn)}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Paid ${sym}${Math.round(ppn)}`, position: 'right', fontSize: 11, fill: '#ef4444' }}
                  />
                  <Line type="monotone" dataKey="price" stroke="#3b82f6" dot={{ r: 3 }} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Price checks table */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Price check log</CardTitle>
            <span className="text-sm text-gray-400">{checks.length} checks</span>
          </CardHeader>
          <CardContent>
            {checks.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No checks yet — press &quot;Check now&quot; or wait for the daily cron
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checked at</TableHead>
                    <TableHead>Price / night</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-gray-600">
                        {format(parseISO(c.checked_at), 'd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.price_found != null ? `${sym}${Math.round(c.price_found)}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                            {c.platform_found ?? '—'}
                          </a>
                        ) : (
                          c.platform_found ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {c.is_cheaper ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Cheaper</Badge>
                        ) : c.price_found != null ? (
                          <Badge variant="secondary">Same / higher</Badge>
                        ) : (
                          <Badge variant="outline">No result</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alerts sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((a) => (
                  <div key={a.id} className="text-sm border rounded-md p-3 bg-gray-50">
                    <div className="text-xs text-gray-400 mb-1">
                      {format(parseISO(a.sent_at), 'd MMM yyyy HH:mm')}
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-gray-700">{a.telegram_message}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
